# リアルタイム・WebSocket設計

## 1. リアルタイム機能要件

### 1.1 リアルタイム通信が必要な機能

Climb Youアプリにおけるリアルタイム機能の要件：

```
┌─────────────────────────────────────────────────────────┐
│                 リアルタイム機能                          │
├─────────────────────────────────────────────────────────┤
│ 1. AI クエスト生成通知                                    │
│    - 毎朝6時の自動生成完了通知                             │
│    - 緊急時の再生成通知                                   │
│                                                         │
│ 2. 学習パターン分析結果                                   │
│    - 週次分析完了通知                                     │
│    - 重要な洞察の即座通知                                 │
│                                                         │
│ 3. 目標達成マイルストーン                                 │
│    - マイルストーン達成時の即座フィードバック               │
│    - 目標調整の提案通知                                   │
│                                                         │
│ 4. システム通知                                          │
│    - メンテナンス通知                                     │
│    - 重要な更新情報                                       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Firebase Realtime Database vs Firestore

本プロジェクトでは **Firebase Firestore** の **リアルタイムリスナー** を採用：

| 機能 | Firestore | Realtime Database |
|------|-----------|-------------------|
| データ構造 | ドキュメント型 | JSON型 |
| スケーラビリティ | 高 | 中 |
| クエリ機能 | 豊富 | 基本的 |
| オフライン対応 | 優秀 | 限定的 |
| コスト | 使用量ベース | 帯域ベース |

## 2. Firestore リアルタイムリスナー実装

### 2.1 リアルタイムデータサービス

```typescript
// services/realtime/realtimeService.ts
import { 
  onSnapshot, 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  Unsubscribe 
} from 'firebase/firestore';

class RealtimeService {
  private subscriptions: Map<string, Unsubscribe> = new Map();

  // ユーザーの日次クエストをリアルタイム監視
  subscribeToUserQuests(
    userId: string, 
    callback: (quests: Quest[]) => void
  ): string {
    const subscriptionId = `user-quests-${userId}`;
    
    const q = query(
      collection(db, 'users', userId, 'dailyQuests'),
      where('date', '==', format(new Date(), 'yyyy-MM-dd')),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const quests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Quest[];

      callback(quests);
    }, (error) => {
      console.error('Quest subscription error:', error);
    });

    this.subscriptions.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // AIインサイトのリアルタイム監視
  subscribeToAIInsights(
    userId: string,
    callback: (insights: AIInsight[]) => void
  ): string {
    const subscriptionId = `ai-insights-${userId}`;
    
    const q = query(
      collection(db, 'users', userId, 'aiInsights'),
      where('isNew', '==', true),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const insights = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as AIInsight[];

      if (insights.length > 0) {
        callback(insights);
        
        // 新規フラグをリセット
        insights.forEach(insight => {
          this.markInsightAsRead(userId, insight.id);
        });
      }
    });

    this.subscriptions.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // システム通知の監視
  subscribeToSystemNotifications(
    callback: (notifications: SystemNotification[]) => void
  ): string {
    const subscriptionId = 'system-notifications';
    
    const q = query(
      collection(db, 'systemNotifications'),
      where('active', '==', true),
      where('expiresAt', '>', new Date()),
      orderBy('priority', 'desc'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as SystemNotification[];

      callback(notifications);
    });

    this.subscriptions.set(subscriptionId, unsubscribe);
    return subscriptionId;
  }

  // 購読解除
  unsubscribe(subscriptionId: string): void {
    const unsubscribe = this.subscriptions.get(subscriptionId);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(subscriptionId);
    }
  }

  // 全購読解除
  unsubscribeAll(): void {
    this.subscriptions.forEach((unsubscribe) => unsubscribe());
    this.subscriptions.clear();
  }

  private async markInsightAsRead(userId: string, insightId: string) {
    try {
      await updateDoc(
        doc(db, 'users', userId, 'aiInsights', insightId),
        { isNew: false, readAt: new Date() }
      );
    } catch (error) {
      console.error('Failed to mark insight as read:', error);
    }
  }
}

export const realtimeService = new RealtimeService();
```

### 2.2 React Hooks統合

```typescript
// hooks/useRealtimeQuests.ts
export const useRealtimeQuests = () => {
  const userId = useUserStore(state => state.profile?.id);
  const setQuests = useQuestStore(state => state.setDailyQuests);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) return;

    setIsConnected(true);
    setError(null);

    const subscriptionId = realtimeService.subscribeToUserQuests(
      userId,
      (quests) => {
        setQuests(quests);
        setIsConnected(true);
      }
    );

    // エラーハンドリング
    const errorHandler = (error: Error) => {
      setError(error);
      setIsConnected(false);
    };

    return () => {
      realtimeService.unsubscribe(subscriptionId);
    };
  }, [userId, setQuests]);

  // 手動再接続
  const reconnect = useCallback(() => {
    if (userId) {
      setError(null);
      // 再接続ロジック（必要に応じて）
    }
  }, [userId]);

  return {
    isConnected,
    error,
    reconnect,
  };
};

// AIインサイトのリアルタイム監視
export const useRealtimeInsights = () => {
  const userId = useUserStore(state => state.profile?.id);
  const addInsight = useAIStore(state => state.addInsight);
  const [newInsights, setNewInsights] = useState<AIInsight[]>([]);

  useEffect(() => {
    if (!userId) return;

    const subscriptionId = realtimeService.subscribeToAIInsights(
      userId,
      (insights) => {
        // 新しいインサイトをストアに追加
        insights.forEach(insight => addInsight(insight));
        
        // UIに表示するための新しいインサイトを設定
        setNewInsights(insights);
        
        // 3秒後にクリア
        setTimeout(() => setNewInsights([]), 3000);
      }
    );

    return () => {
      realtimeService.unsubscribe(subscriptionId);
    };
  }, [userId, addInsight]);

  return {
    newInsights,
    clearNewInsights: () => setNewInsights([]),
  };
};
```

## 3. プッシュ通知統合

### 3.1 Expo Push Notifications

```typescript
// services/notifications/pushNotificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

class PushNotificationService {
  private expoPushToken: string | null = null;

  async initialize(): Promise<void> {
    if (!Device.isDevice) {
      console.warn('Must use physical device for Push Notifications');
      return;
    }

    // 既存の権限を確認
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 権限がない場合はリクエスト
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission denied');
      return;
    }

    // Expo Push Token を取得
    this.expoPushToken = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;

    // サーバーに登録
    await this.registerTokenWithServer(this.expoPushToken);

    // 通知ハンドラー設定
    this.setupNotificationHandlers();
  }

  private async registerTokenWithServer(token: string): Promise<void> {
    const userId = useUserStore.getState().profile?.id;
    if (!userId) return;

    try {
      await apiClient.post('/users/push-token', {
        userId,
        token,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Failed to register push token:', error);
    }
  }

  private setupNotificationHandlers(): void {
    // 通知受信時（アプリがフォアグラウンド）
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // 通知タップ時の処理
    Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      this.handleNotificationTap(data);
    });

    // フォアグラウンドでの通知受信
    Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data;
      this.handleForegroundNotification(data);
    });
  }

  private handleNotificationTap(data: any): void {
    const { type, payload } = data;

    switch (type) {
      case 'quest_generated':
        NavigationService.navigate('Today');
        break;
      case 'insight_ready':
        NavigationService.navigate('Growth', { 
          screen: 'InsightDetail', 
          params: { insightId: payload.insightId }
        });
        break;
      case 'milestone_reached':
        NavigationService.navigate('Goals', {
          screen: 'GoalDetail',
          params: { goalId: payload.goalId }
        });
        break;
    }
  }

  private handleForegroundNotification(data: any): void {
    // アプリ内通知として表示
    useNotificationStore.getState().addNotification({
      id: generateUUID(),
      title: data.title,
      message: data.message,
      type: data.type,
      createdAt: new Date(),
    });
  }

  // ローカル通知スケジュール
  async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Date | number,
    data?: any
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: typeof trigger === 'number' 
        ? { seconds: trigger } 
        : trigger,
    });
  }

  // 通知キャンセル
  async cancelNotification(notificationId: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  }

  // バッジ数更新
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count);
  }
}

export const pushNotificationService = new PushNotificationService();
```

### 3.2 スケジュール通知

```typescript
// services/notifications/scheduledNotifications.ts
class ScheduledNotificationService {
  // 日次クエスト生成通知
  async scheduleDailyQuestNotifications(): Promise<void> {
    const userId = useUserStore.getState().profile?.id;
    if (!userId) return;

    // 既存の通知をキャンセル
    await this.cancelDailyNotifications();

    // 毎朝6時に通知をスケジュール
    const notificationTime = new Date();
    notificationTime.setHours(6, 0, 0, 0);
    
    if (notificationTime <= new Date()) {
      // 今日の6時が過ぎている場合は明日
      notificationTime.setDate(notificationTime.getDate() + 1);
    }

    await pushNotificationService.scheduleLocalNotification(
      'Today\'s Quests are Ready! 🏔️',
      'Your personalized learning journey awaits',
      notificationTime,
      { type: 'daily_quests', userId }
    );
  }

  // リマインダー通知
  async scheduleQuestReminders(): Promise<void> {
    const currentHour = new Date().getHours();
    const reminderTimes = [14, 18, 20]; // 2PM, 6PM, 8PM

    for (const hour of reminderTimes) {
      if (hour > currentHour) {
        const reminderTime = new Date();
        reminderTime.setHours(hour, 0, 0, 0);

        await pushNotificationService.scheduleLocalNotification(
          'Keep Climbing! 🚀',
          'Complete your quests to reach your goals',
          reminderTime,
          { type: 'quest_reminder' }
        );
      }
    }
  }

  // 週次レポート通知
  async scheduleWeeklyReport(): Promise<void> {
    const nextSunday = new Date();
    nextSunday.setDate(nextSunday.getDate() + (7 - nextSunday.getDay()));
    nextSunday.setHours(19, 0, 0, 0); // 日曜日7PM

    await pushNotificationService.scheduleLocalNotification(
      'Your Weekly Growth Report is Ready! 📊',
      'See how much you\'ve grown this week',
      nextSunday,
      { type: 'weekly_report' }
    );
  }

  private async cancelDailyNotifications(): Promise<void> {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    
    for (const notification of scheduledNotifications) {
      const data = notification.content.data;
      if (data?.type === 'daily_quests') {
        await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
    }
  }
}

export const scheduledNotificationService = new ScheduledNotificationService();
```

## 4. 通知状態管理

### 4.1 通知ストア

```typescript
// stores/notificationStore.ts
interface NotificationState {
  // アプリ内通知
  inAppNotifications: InAppNotification[];
  
  // 通知設定
  preferences: NotificationPreferences;
  
  // 通知履歴
  history: NotificationHistory[];
  
  // 未読数
  unreadCount: number;
}

interface NotificationActions {
  addNotification: (notification: InAppNotification) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  updatePreferences: (preferences: Partial<NotificationPreferences>) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set, get) => ({
      inAppNotifications: [],
      preferences: {
        dailyQuests: true,
        insights: true,
        milestones: true,
        reminders: true,
        weeklyReports: true,
        quietHours: {
          enabled: true,
          start: '22:00',
          end: '07:00',
        },
      },
      history: [],
      unreadCount: 0,

      addNotification: (notification) => {
        set(state => ({
          inAppNotifications: [...state.inAppNotifications, notification],
          unreadCount: state.unreadCount + 1,
          history: [{
            id: notification.id,
            title: notification.title,
            receivedAt: new Date(),
            type: notification.type,
          }, ...state.history].slice(0, 100), // 最新100件
        }));

        // 5秒後に自動削除（種類によって調整）
        const autoRemoveDelay = notification.type === 'error' ? 8000 : 5000;
        setTimeout(() => {
          get().removeNotification(notification.id);
        }, autoRemoveDelay);
      },

      removeNotification: (id) => {
        set(state => ({
          inAppNotifications: state.inAppNotifications.filter(n => n.id !== id),
        }));
      },

      markAsRead: (id) => {
        set(state => ({
          inAppNotifications: state.inAppNotifications.map(n =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));
      },

      updatePreferences: (newPreferences) => {
        set(state => ({
          preferences: { ...state.preferences, ...newPreferences },
        }));
      },

      clearAll: () => {
        set({
          inAppNotifications: [],
          unreadCount: 0,
        });
      },
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({
        preferences: state.preferences,
        history: state.history,
      }),
    }
  )
);
```

### 4.2 通知UI コンポーネント

```typescript
// components/notifications/NotificationOverlay.tsx
export const NotificationOverlay = () => {
  const notifications = useNotificationStore(state => state.inAppNotifications);
  const removeNotification = useNotificationStore(state => state.removeNotification);

  return (
    <View className="absolute top-12 left-4 right-4 z-50">
      {notifications.map((notification) => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </View>
  );
};

const NotificationCard = ({ 
  notification, 
  onDismiss 
}: {
  notification: InAppNotification;
  onDismiss: () => void;
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-50);

  useEffect(() => {
    // 入場アニメーション
    opacity.value = withSpring(1);
    translateY.value = withSpring(0);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const typeStyles = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <Animated.View
      style={animatedStyle}
      className={`rounded-lg p-4 mb-2 shadow-lg ${typeStyles[notification.type]}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">
            {notification.title}
          </Text>
          {notification.message && (
            <Text className="text-white text-xs mt-1 opacity-90">
              {notification.message}
            </Text>
          )}
        </View>
        
        <TouchableOpacity onPress={onDismiss} className="ml-3">
          <CloseIcon size={16} color="white" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};
```

## 5. オフライン・オンライン同期

### 5.1 接続状態監視

```typescript
// hooks/useNetworkStatus.ts
export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected ?? false);
      setConnectionType(state.type);
      
      if (state.isConnected) {
        // オンラインになった時の処理
        handleOnlineReconnect();
      } else {
        // オフラインになった時の処理
        handleOfflineDisconnect();
      }
    });

    return () => unsubscribe();
  }, []);

  const handleOnlineReconnect = async () => {
    // リアルタイム接続を再開
    await realtimeService.reconnectAll();
    
    // オフライン中のデータを同期
    await syncOfflineData();
    
    // 通知表示
    useNotificationStore.getState().addNotification({
      id: generateUUID(),
      type: 'success',
      title: 'Back Online',
      message: 'Your data has been synchronized',
      createdAt: new Date(),
    });
  };

  const handleOfflineDisconnect = () => {
    // オフライン通知
    useNotificationStore.getState().addNotification({
      id: generateUUID(),
      type: 'warning',
      title: 'Offline Mode',
      message: 'Some features may be limited',
      createdAt: new Date(),
    });
  };

  return {
    isConnected,
    connectionType,
    isWifi: connectionType === 'wifi',
    isCellular: connectionType === 'cellular',
  };
};
```

### 5.2 データ同期戦略

```typescript
// services/sync/syncService.ts
class SyncService {
  private syncQueue: SyncOperation[] = [];
  private isSyncing = false;

  async syncOfflineData(): Promise<void> {
    if (this.isSyncing) return;
    
    this.isSyncing = true;
    
    try {
      // キューに蓄積された操作を実行
      while (this.syncQueue.length > 0) {
        const operation = this.syncQueue.shift();
        if (operation) {
          await this.executeSyncOperation(operation);
        }
      }
      
      // サーバーからの差分取得
      await this.fetchServerUpdates();
      
    } catch (error) {
      console.error('Sync failed:', error);
      
      // 失敗した操作はキューに戻す
      if (operation) {
        this.syncQueue.unshift(operation);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  addToSyncQueue(operation: SyncOperation): void {
    this.syncQueue.push({
      ...operation,
      timestamp: new Date(),
      retryCount: 0,
    });
    
    // ローカルストレージに保存（アプリ再起動に備えて）
    AsyncStorage.setItem('sync-queue', JSON.stringify(this.syncQueue));
  }

  private async executeSyncOperation(operation: SyncOperation): Promise<void> {
    switch (operation.type) {
      case 'complete_quest':
        await questService.syncQuestCompletion(operation.data);
        break;
      case 'update_goal':
        await goalService.syncGoalUpdate(operation.data);
        break;
      case 'user_progress':
        await userService.syncProgressUpdate(operation.data);
        break;
    }
  }

  private async fetchServerUpdates(): Promise<void> {
    const lastSyncTime = await AsyncStorage.getItem('last-sync-time');
    const timestamp = lastSyncTime ? new Date(lastSyncTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // サーバーから差分データを取得
    const updates = await apiClient.get('/sync/updates', {
      params: { since: timestamp.toISOString() }
    });
    
    // ローカルストアを更新
    await this.applyServerUpdates(updates.data);
    
    // 同期時間を記録
    await AsyncStorage.setItem('last-sync-time', new Date().toISOString());
  }
}

export const syncService = new SyncService();
```
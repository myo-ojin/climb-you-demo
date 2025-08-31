# データフロー・レイヤー設計

## 1. アプリケーションレイヤー構成

### 1.1 レイヤーアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                Presentation Layer                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Screens   │ │ Components  │ │    Hooks    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Application Layer                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │   Stores    │ │  Use Cases  │ │ Controllers │        │
│  │ (Zustand)   │ │             │ │             │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                Service Layer                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │ API Client  │ │    Cache    │ │ Validation  │        │
│  │             │ │ (React      │ │   (Zod)     │        │
│  │             │ │  Query)     │ │             │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│               Infrastructure Layer                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  OpenAI     │ │   Firebase  │ │   Local     │        │
│  │    API      │ │             │ │  Storage    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 1.2 レイヤー間の責務

#### Presentation Layer
- ユーザーインターフェースの表示
- ユーザー入力の受付
- 状態の可視化

#### Application Layer  
- ビジネスロジックの実行
- 状態管理
- ユースケースの調整

#### Service Layer
- 外部サービスとの通信
- データの変換・検証
- キャッシング

#### Infrastructure Layer
- 外部システムとの統合
- データ永続化
- ネットワーク通信

## 2. データフロー パターン

### 2.1 ユーザーアクション起点のフロー

```
User Action → Component → Hook → Store Action → Service → API
     ↓                                                    │
UI Update ← Component ← Hook ← Store State ← Response ←────┘
```

### 2.2 具体的なデータフロー例

#### クエスト完了フロー

```typescript
// 1. ユーザーアクション (Presentation)
const QuestCard = ({ quest }) => {
  const { completeQuest } = useQuestActions();
  
  const handleComplete = async () => {
    await completeQuest(quest.id, {
      completedAt: new Date(),
      timeSpent: 30,
      satisfaction: 4,
    });
  };

  return (
    <Button onPress={handleComplete}>
      Complete Quest
    </Button>
  );
};

// 2. カスタムフック (Application)
const useQuestActions = () => {
  const completeQuest = useQuestStore(state => state.completeQuest);
  const analyzeCompletion = useAIStore(state => state.analyzeCompletion);
  
  return {
    completeQuest: async (questId, data) => {
      // ストアアクション呼び出し
      await completeQuest(questId, data);
      
      // AI分析をトリガー（副作用）
      await analyzeCompletion({ questId, ...data });
    }
  };
};

// 3. ストアアクション (Application)
const questStore = create((set, get) => ({
  completeQuest: async (questId, completionData) => {
    // サービス層呼び出し
    const result = await questService.completeQuest(questId, completionData);
    
    // 状態更新
    set(state => ({
      completedQuests: [...state.completedQuests, result],
      dailyQuests: state.dailyQuests.filter(q => q.id !== questId),
    }));
  },
}));

// 4. サービス (Service Layer)
class QuestService {
  async completeQuest(questId: string, data: CompletionData) {
    // データ検証
    const validatedData = questCompletionSchema.parse(data);
    
    // API呼び出し
    const response = await apiClient.post(`/quests/${questId}/complete`, validatedData);
    
    // レスポンス変換
    return transformQuestResponse(response.data);
  }
}
```

### 2.3 AI駆動クエスト生成フロー

```
Scheduled Trigger → Background Service → AI Service → 
OpenAI API → Response Processing → Store Update → 
Local Cache → Push Notification
```

```typescript
// バックグラウンドタスク設定
export const setupQuestGeneration = () => {
  TaskManager.defineTask(QUEST_GENERATION_TASK, async () => {
    try {
      await generateDailyQuests();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
      console.error('Quest generation failed:', error);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
};

// AI駆動クエスト生成
const generateDailyQuests = async () => {
  // 1. ユーザーデータ収集
  const userProfile = await userService.getCurrentProfile();
  const recentHistory = await questService.getRecentCompletions(7);
  const learningPatterns = await aiService.getLearningPatterns();
  
  // 2. AI分析・生成リクエスト
  const questPrompt = buildQuestGenerationPrompt({
    userProfile,
    recentHistory,
    learningPatterns,
    date: new Date(),
  });
  
  // 3. OpenAI API呼び出し
  const aiResponse = await openAIClient.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: questPrompt }],
    temperature: 0.7,
  });
  
  // 4. レスポンス処理・検証
  const generatedQuests = parseAndValidateQuests(aiResponse.choices[0].message.content);
  
  // 5. ストア更新
  useQuestStore.getState().setDailyQuests(generatedQuests);
  
  // 6. 通知送信
  await sendQuestNotification(generatedQuests.length);
};
```

## 3. キャッシング戦略

### 3.1 React Query統合

```typescript
// services/cache/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // デフォルトキャッシング設定
      staleTime: 5 * 60 * 1000, // 5分間
      cacheTime: 10 * 60 * 1000, // 10分間
      retry: 3,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
    },
  },
});

// クエリキー管理
export const queryKeys = {
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    goals: () => [...queryKeys.user.all, 'goals'] as const,
  },
  quests: {
    all: ['quests'] as const,
    daily: (date: string) => [...queryKeys.quests.all, 'daily', date] as const,
    history: (limit: number) => [...queryKeys.quests.all, 'history', limit] as const,
  },
  ai: {
    all: ['ai'] as const,
    insights: () => [...queryKeys.ai.all, 'insights'] as const,
    analysis: (type: string) => [...queryKeys.ai.all, 'analysis', type] as const,
  },
};
```

### 3.2 階層化キャッシング

```typescript
// services/cache/cacheStrategy.ts
interface CacheStrategy {
  level: 'memory' | 'storage' | 'network';
  ttl: number;
  key: string;
}

class LayeredCache {
  private memoryCache = new Map();
  private storageCache = AsyncStorage;
  
  async get<T>(key: string, strategies: CacheStrategy[]): Promise<T | null> {
    for (const strategy of strategies) {
      const value = await this.getFromLevel(key, strategy);
      if (value && this.isValid(value, strategy.ttl)) {
        // 上位レベルにキャッシュを更新
        await this.setToUpperLevels(key, value, strategies, strategy);
        return value.data;
      }
    }
    return null;
  }
  
  async set<T>(key: string, data: T, strategies: CacheStrategy[]) {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
    };
    
    for (const strategy of strategies) {
      await this.setToLevel(key, cacheEntry, strategy);
    }
  }
  
  private async getFromLevel(key: string, strategy: CacheStrategy) {
    switch (strategy.level) {
      case 'memory':
        return this.memoryCache.get(key);
      case 'storage':
        const stored = await this.storageCache.getItem(key);
        return stored ? JSON.parse(stored) : null;
      case 'network':
        // ネットワークから取得（実装は省略）
        return null;
    }
  }
}

// 使用例
const cacheStrategy = [
  { level: 'memory', ttl: 60 * 1000, key: 'daily-quests' }, // 1分
  { level: 'storage', ttl: 5 * 60 * 1000, key: 'daily-quests' }, // 5分
  { level: 'network', ttl: Infinity, key: 'daily-quests' },
];
```

### 3.3 選択的キャッシュ無効化

```typescript
// hooks/useCacheInvalidation.ts
export const useCacheInvalidation = () => {
  const queryClient = useQueryClient();
  
  // クエスト完了時のキャッシュ無効化
  const invalidateOnQuestComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.quests.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.ai.insights() });
    queryClient.invalidateQueries({ queryKey: queryKeys.user.profile() });
  }, [queryClient]);
  
  // 目標更新時のキャッシュ無効化
  const invalidateOnGoalUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.user.goals() });
    queryClient.invalidateQueries({ queryKey: queryKeys.quests.daily(today()) });
  }, [queryClient]);
  
  // 強制更新
  const forceRefreshAll = useCallback(async () => {
    await queryClient.invalidateQueries();
    await queryClient.refetchQueries();
  }, [queryClient]);
  
  return {
    invalidateOnQuestComplete,
    invalidateOnGoalUpdate,
    forceRefreshAll,
  };
};
```

## 4. エラーハンドリング・フォールト トレラント

### 4.1 エラー分類・処理

```typescript
// types/errors.ts
export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation', 
  AI_SERVICE = 'ai_service',
  AUTHENTICATION = 'authentication',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code?: string;
  details?: any;
  retryable: boolean;
}

// services/errorHandler.ts
class ErrorHandler {
  static handle(error: any): AppError {
    if (error.response) {
      // HTTP エラー
      return this.handleHTTPError(error.response);
    }
    
    if (error.code === 'NETWORK_ERROR') {
      return {
        type: ErrorType.NETWORK,
        message: 'ネットワークに接続できません',
        retryable: true,
      };
    }
    
    if (error instanceof ZodError) {
      return {
        type: ErrorType.VALIDATION,
        message: 'データの形式が正しくありません',
        details: error.errors,
        retryable: false,
      };
    }
    
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || '予期しないエラーが発生しました',
      retryable: false,
    };
  }
  
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const appError = this.handle(error);
        
        if (!appError.retryable || attempt === maxAttempts) {
          throw appError;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
    throw new Error('Max retry attempts reached');
  }
}
```

### 4.2 グレースフル デグラデーション

```typescript
// services/fallback/questFallback.ts
class QuestFallbackService {
  // AI生成が失敗した場合のフォールバック
  async generateFallbackQuests(userProfile: UserProfile): Promise<Quest[]> {
    // 1. キャッシュされたテンプレートを使用
    const templates = await this.getFallbackTemplates(userProfile.goals);
    
    // 2. ユーザー履歴を基に生成
    if (templates.length === 0) {
      return this.generateFromHistory(userProfile);
    }
    
    // 3. 最低限のクエストを保証
    return this.ensureMinimumQuests(templates);
  }
  
  private async getFallbackTemplates(goals: Goal[]): Promise<Quest[]> {
    const templates = await AsyncStorage.getItem('quest-templates');
    if (!templates) return [];
    
    return JSON.parse(templates)
      .filter((template: any) => 
        goals.some(goal => goal.category === template.category)
      )
      .map((template: any) => ({
        ...template,
        id: generateUUID(),
        generatedAt: new Date(),
        isFallback: true,
      }));
  }
}

// オフライン対応
class OfflineModeManager {
  async enableOfflineMode() {
    const essentialData = await this.collectEssentialData();
    await AsyncStorage.setItem('offline-data', JSON.stringify(essentialData));
    
    useUIStore.getState().setOfflineMode(true);
  }
  
  private async collectEssentialData() {
    return {
      dailyQuests: useQuestStore.getState().dailyQuests,
      userProfile: useUserStore.getState().profile,
      recentInsights: useAIStore.getState().insights.slice(-5),
      lastSync: new Date().toISOString(),
    };
  }
  
  async syncOnReconnect() {
    const offlineData = await AsyncStorage.getItem('offline-data');
    if (!offlineData) return;
    
    const data = JSON.parse(offlineData);
    
    // オフライン中の変更を同期
    await this.syncOfflineChanges(data);
    
    // 最新データを取得
    await this.refreshOnlineData();
    
    useUIStore.getState().setOfflineMode(false);
  }
}
```

## 5. パフォーマンス最適化

### 5.1 データ取得最適化

```typescript
// hooks/useOptimizedData.ts
export const useOptimizedQuests = () => {
  const today = format(new Date(), 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: queryKeys.quests.daily(today),
    queryFn: () => questService.getDailyQuests(today),
    
    // 最適化オプション
    staleTime: 10 * 60 * 1000, // 10分間フレッシュ
    cacheTime: 30 * 60 * 1000, // 30分間キャッシュ保持
    refetchOnWindowFocus: false, // フォーカス時の再取得無効
    refetchOnReconnect: true, // 再接続時は再取得
    
    // 条件付き取得
    enabled: useUserStore(state => state.isAuthenticated),
    
    // 背景更新
    refetchInterval: 60 * 60 * 1000, // 1時間ごと
    refetchIntervalInBackground: false,
  });
};

// プリフェッチング
export const usePrefetchOptimization = () => {
  const queryClient = useQueryClient();
  
  const prefetchTomorrowQuests = useCallback(() => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    queryClient.prefetchQuery({
      queryKey: queryKeys.quests.daily(tomorrow),
      queryFn: () => questService.getDailyQuests(tomorrow),
      staleTime: 60 * 60 * 1000, // 1時間
    });
  }, [queryClient]);
  
  // アプリ起動時にプリフェッチ
  useEffect(() => {
    prefetchTomorrowQuests();
  }, [prefetchTomorrowQuests]);
  
  return { prefetchTomorrowQuests };
};
```

### 5.2 メモ化戦略

```typescript
// hooks/useMemoizedSelectors.ts
export const useMemoizedQuestStats = () => {
  return useQuestStore(
    useCallback(
      state => ({
        totalQuests: state.dailyQuests.length,
        completedToday: state.completedQuests.filter(
          q => isToday(new Date(q.completedAt))
        ).length,
        completionRate: calculateCompletionRate(state.completedQuests),
        currentStreak: state.currentStreak,
      }),
      []
    ),
    shallow
  );
};

// 計算コストの高い操作のメモ化
export const useExpensiveCalculations = () => {
  const completedQuests = useQuestStore(state => state.completedQuests);
  
  const analyticsData = useMemo(() => {
    return analyzeQuestPatterns(completedQuests); // 重い計算
  }, [completedQuests]);
  
  const learningTrends = useMemo(() => {
    return calculateLearningTrends(completedQuests); // 重い計算
  }, [completedQuests]);
  
  return { analyticsData, learningTrends };
};
```

## 6. 監視・ログ

### 6.1 データフロー監視

```typescript
// utils/monitoring.ts
class DataFlowMonitor {
  private static events: DataFlowEvent[] = [];
  
  static logEvent(event: DataFlowEvent) {
    this.events.push({
      ...event,
      timestamp: new Date(),
    });
    
    // 開発環境でのコンソール出力
    if (__DEV__) {
      console.log(`[${event.layer}] ${event.operation}`, event.data);
    }
    
    // 本番環境での分析サービス送信
    if (!__DEV__ && event.level === 'error') {
      this.sendToAnalytics(event);
    }
  }
  
  static getEventsByLayer(layer: string) {
    return this.events.filter(e => e.layer === layer);
  }
  
  static clearEvents() {
    this.events = [];
  }
}

// 使用例
export const withDataFlowLogging = <T extends (...args: any[]) => any>(
  fn: T,
  layer: string,
  operation: string
): T => {
  return ((...args: any[]) => {
    const start = Date.now();
    
    try {
      const result = fn(...args);
      
      if (result instanceof Promise) {
        return result
          .then(data => {
            DataFlowMonitor.logEvent({
              layer,
              operation,
              level: 'info',
              duration: Date.now() - start,
              data: { args, result: data },
            });
            return data;
          })
          .catch(error => {
            DataFlowMonitor.logEvent({
              layer,
              operation,
              level: 'error',
              duration: Date.now() - start,
              data: { args, error },
            });
            throw error;
          });
      }
      
      DataFlowMonitor.logEvent({
        layer,
        operation,
        level: 'info',
        duration: Date.now() - start,
        data: { args, result },
      });
      
      return result;
    } catch (error) {
      DataFlowMonitor.logEvent({
        layer,
        operation,
        level: 'error',
        duration: Date.now() - start,
        data: { args, error },
      });
      throw error;
    }
  }) as T;
};
```
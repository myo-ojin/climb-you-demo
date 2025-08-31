# パフォーマンス最適化設計

## 1. パフォーマンス要件

### 1.1 レスポンス時間目標

```
機能別パフォーマンス目標
├── アプリ起動
│   ├── 初回起動: 3秒以内
│   └── 通常起動: 1.5秒以内
├── AI機能
│   ├── プロファイリング分析: 5秒以内
│   ├── 日次クエスト生成: 3秒以内
│   └── 適応調整: 2秒以内
├── UI操作
│   ├── 画面遷移: 300ms以内
│   ├── タップ応答: 100ms以内
│   └── リスト描画: 500ms以内
└── データ同期
    ├── オンライン同期: 2秒以内
    └── オフライン復帰: 5秒以内
```

### 1.2 メモリ使用量制限

| デバイス分類 | RAM使用量上限 | 目標値 | 最適化レベル |
|-------------|------------|-------|------------|
| ハイエンド | 200MB | 150MB | 標準 |
| ミドルレンジ | 150MB | 120MB | 中レベル |
| ローエンド | 100MB | 80MB | 高レベル |

### 1.3 バッテリー効率目標

- アプリ使用時のバッテリー消費: 5%/時間以下
- バックグラウンド処理: 1%/時間以下  
- プッシュ通知待機: 0.5%/時間以下

## 2. React Native パフォーマンス最適化

### 2.1 レンダリング最適化

```typescript
// components/optimized/OptimizedComponents.tsx
import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, VirtualizedList } from 'react-native';

// 1. コンポーネントメモ化
export const QuestCard = memo<QuestCardProps>(({ quest, onComplete }) => {
  // プロップスが変更された場合のみ再描画
  const handleComplete = useCallback(() => {
    onComplete(quest.id);
  }, [quest.id, onComplete]);

  const questProgress = useMemo(() => {
    return calculateProgress(quest.completedSteps, quest.totalSteps);
  }, [quest.completedSteps, quest.totalSteps]);

  return (
    <View className="bg-white rounded-lg p-4 mb-3">
      <Text className="text-lg font-semibold">{quest.title}</Text>
      <ProgressBar progress={questProgress} />
      <Button onPress={handleComplete}>Complete</Button>
    </View>
  );
}, (prevProps, nextProps) => {
  // カスタム比較関数
  return (
    prevProps.quest.id === nextProps.quest.id &&
    prevProps.quest.completedSteps === nextProps.quest.completedSteps &&
    prevProps.quest.title === nextProps.quest.title
  );
});

// 2. 仮想化リスト実装
export const OptimizedQuestList = ({ quests }: { quests: Quest[] }) => {
  const renderQuest = useCallback(({ item, index }: { item: Quest; index: number }) => {
    return <QuestCard key={item.id} quest={item} onComplete={handleQuestComplete} />;
  }, []);

  const keyExtractor = useCallback((item: Quest) => item.id, []);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: QUEST_CARD_HEIGHT,
    offset: QUEST_CARD_HEIGHT * index,
    index,
  }), []);

  return (
    <FlatList
      data={quests}
      renderItem={renderQuest}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      
      // パフォーマンス最適化設定
      removeClippedSubviews={true}  // 画面外要素のクリップ
      maxToRenderPerBatch={10}      // バッチあたりの最大描画数
      updateCellsBatchingPeriod={50} // バッチ更新間隔
      windowSize={10}               // レンダリングウィンドウサイズ
      initialNumToRender={5}        // 初期描画アイテム数
      
      // メモリ効率化
      onEndReachedThreshold={0.5}   // 追加読み込みトリガー
      maintainVisibleContentPosition={
        minIndexForVisible: 0
      }
    />
  );
};

// 3. 重い計算のメモ化
const QUEST_CARD_HEIGHT = 120;

const useOptimizedQuestData = (rawQuests: Quest[]) => {
  return useMemo(() => {
    console.log('Processing quest data...');
    
    return rawQuests
      .filter(quest => quest.isActive)
      .sort((a, b) => a.priority - b.priority)
      .map(quest => ({
        ...quest,
        progress: calculateProgress(quest.completedSteps, quest.totalSteps),
        timeRemaining: calculateTimeRemaining(quest.dueDate),
        difficultyColor: getDifficultyColor(quest.difficulty),
      }));
  }, [rawQuests]);
};

// 4. 画像最適化コンポーネント
export const OptimizedImage = memo(({ source, ...props }) => {
  const [loaded, setLoaded] = useState(false);
  
  return (
    <View>
      <Image
        source={source}
        {...props}
        onLoad={() => setLoaded(true)}
        
        // 最適化設定
        resizeMode="contain"
        progressiveRenderingEnabled={true}
        fadeDuration={300}
        
        // プレースホルダー
        defaultSource={require('../assets/placeholder.png')}
      />
      {!loaded && <ActivityIndicator />}
    </View>
  );
});
```

### 2.2 状態管理最適化

```typescript
// stores/optimizedStore.ts

// 1. 選択的サブスクリプション
export const useQuestStore = create<QuestState & QuestActions>()(    
  subscribeWithSelector(
    (set, get) => ({
      // ... store implementation
    })
  )
);

// 2. shallow比較を使用した効率的なセレクター
export const useDashboardData = () => {
  return useQuestStore(
    useCallback(
      state => ({
        dailyQuests: state.dailyQuests,
        completedToday: state.completedToday,
        streak: state.currentStreak,
      }),
      []
    ),
    shallow // shallow比較でパフォーマンス向上
  );
};

// 3. 計算結果のメモ化
export const useQuestStats = () => {
  const quests = useQuestStore(state => state.dailyQuests);
  const completed = useQuestStore(state => state.completedQuests);
  
  return useMemo(() => ({
    totalQuests: quests.length,
    completedQuests: completed.filter(q => isToday(q.completedAt)).length,
    completionRate: completed.length / (quests.length + completed.length),
    averageTime: calculateAverageCompletionTime(completed),
  }), [quests.length, completed]);
};

// 4. 遅延初期化
const useLazyInitialization = () => {
  const [initialized, setInitialized] = useState(false);
  const [data, setData] = useState<any>(null);
  
  useEffect(() => {
    if (!initialized) {
      // 必要な時まで初期化を遅延
      const timer = setTimeout(() => {
        initializeExpensiveData().then(setData);
        setInitialized(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [initialized]);
  
  return data;
};
```

### 2.3 バンドル最適化

```typescript
// utils/lazyLoading.ts

// 1. 動的インポート
const MountainAnimation = lazy(() => import('../components/animations/MountainAnimation'));
const AIInsightChart = lazy(() => import('../components/charts/AIInsightChart'));
const GoalProgressChart = lazy(() => import('../components/charts/GoalProgressChart'));

// 2. 条件付きインポート
const loadAdvancedAnalytics = () => {
  if (userHasPremiumFeatures) {
    return import('../services/analytics/advancedAnalytics');
  }
  return Promise.resolve(null);
};

// 3. プリロード戦略
export const preloadCriticalComponents = () => {
  // 必要なコンポーネントを事前に読み込み
  const preloadPromises = [
    import('../screens/TodayScreen'),
    import('../screens/QuestDetailScreen'),
    import('../components/quest/QuestCard'),
  ];
  
  return Promise.all(preloadPromises);
};

// 4. サスペンス境界
export const SuspenseWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={
    <View className="flex-1 justify-center items-center">
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text className="mt-2 text-gray-600">Loading...</Text>
    </View>
  }>
    {children}
  </Suspense>
);
```

## 3. AI処理最適化

### 3.1 OpenAI API最適化

```typescript
// services/ai/optimizedAIService.ts
class OptimizedAIService {
  private requestQueue: AIRequest[] = [];
  private isProcessing = false;
  private responseCache = new Map<string, CachedResponse>();
  private readonly BATCH_SIZE = 3;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1時間

  // 1. リクエストバッチ処理
  async processAIRequest(request: AIRequest): Promise<any> {
    // キャッシュチェック
    const cacheKey = this.generateCacheKey(request);
    const cached = this.getCachedResponse(cacheKey);
    if (cached) {
      return cached.data;
    }

    // リクエストをキューに追加
    this.requestQueue.push(request);
    
    // バッチ処理をトリガー
    if (!this.isProcessing) {
      this.processBatch();
    }
    
    return new Promise((resolve) => {
      request.resolve = resolve;
    });
  }

  private async processBatch(): Promise<void> {
    if (this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      // バッチサイズごとに処理
      const batch = this.requestQueue.splice(0, this.BATCH_SIZE);
      
      // 並列処理でスループットを向上
      const results = await Promise.allSettled(
        batch.map(request => this.executeRequest(request))
      );
      
      // 結果を各リクエストに返す
      results.forEach((result, index) => {
        const request = batch[index];
        if (result.status === 'fulfilled') {
          request.resolve(result.value);
          
          // 結果をキャッシュ
          const cacheKey = this.generateCacheKey(request);
          this.cacheResponse(cacheKey, result.value);
        } else {
          request.resolve(null);
        }
      });
      
    } finally {
      this.isProcessing = false;
      
      // 残りのリクエストがある場合は継続処理
      if (this.requestQueue.length > 0) {
        setTimeout(() => this.processBatch(), 100);
      }
    }
  }

  private async executeRequest(request: AIRequest): Promise<any> {
    try {
      return await openAI.chat.completions.create({
        model: 'gpt-4o-mini', // より軽量なモデルを使用
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 500, // トークン数を制限
        
        // レスポンス時間を短縮
        timeout: 10000, // 10秒タイムアウト
      });
    } catch (error) {
      console.error('AI request failed:', error);
      throw error;
    }
  }

  // 2. インテリジェントキャッシング
  private getCachedResponse(key: string): CachedResponse | null {
    const cached = this.responseCache.get(key);
    if (!cached) return null;
    
    // TTL確認
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.responseCache.delete(key);
      return null;
    }
    
    return cached;
  }

  private cacheResponse(key: string, data: any): void {
    this.responseCache.set(key, {
      data,
      timestamp: Date.now(),
    });
    
    // キャッシュサイズ制限
    if (this.responseCache.size > 100) {
      const oldestKey = Array.from(this.responseCache.keys())[0];
      this.responseCache.delete(oldestKey);
    }
  }

  private generateCacheKey(request: AIRequest): string {
    // リクエスト内容からハッシュキーを生成
    const content = JSON.stringify({
      messages: request.messages,
      temperature: request.temperature,
      type: request.type,
    });
    
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // 3. プロンプト最適化
  optimizePrompt(originalPrompt: string, context: any): string {
    // 不要な情報を削除してトークン数を削減
    let optimizedPrompt = originalPrompt
      .replace(/\s+/g, ' ')  // 余分な空白を削除
      .trim();
    
    // 文脈に応じてプロンプトを短縮
    if (context.isQuickGeneration) {
      optimizedPrompt = this.shortenPrompt(optimizedPrompt);
    }
    
    return optimizedPrompt;
  }

  private shortenPrompt(prompt: string): string {
    // プロンプトの重要でない部分を削除
    return prompt
      .replace(/例えば[^。]*。/g, '')  // 例示を削除
      .replace(/詳しく説明すると[^。]*。/g, '')  // 詳細説明を削除
      .replace(/なお、[^。]*。/g, '');  // 補足情報を削除
  }
}

interface AIRequest {
  type: string;
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  resolve?: (value: any) => void;
}

interface CachedResponse {
  data: any;
  timestamp: number;
}

export const optimizedAIService = new OptimizedAIService();
```

### 3.2 プリコンピュート戦略

```typescript
// services/ai/precomputeService.ts
class PrecomputeService {
  // 1. 事前計算されたレスポンステンプレート
  private templates = {
    beginner: {
      questTypes: ['読書', '基本練習', '動画視聴'],
      difficulty: 'easy',
      duration: 15,
    },
    intermediate: {
      questTypes: ['実践課題', 'プロジェクト作業', '応用練習'],
      difficulty: 'medium', 
      duration: 30,
    },
    advanced: {
      questTypes: ['創作活動', '問題解決', '教えること'],
      difficulty: 'hard',
      duration: 45,
    },
  };

  // 2. 高速クエスト生成
  generateQuickQuests(userProfile: UserProfile): Quest[] {
    const level = this.determineUserLevel(userProfile);
    const template = this.templates[level];
    
    return template.questTypes.map((type, index) => ({
      id: generateUUID(),
      title: this.generateQuestTitle(type, userProfile.goals[0]),
      description: this.generateQuestDescription(type, level),
      type,
      difficulty: template.difficulty,
      estimatedTime: template.duration,
      category: userProfile.goals[0]?.category || 'general',
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }));
  }

  // 3. パターンベース生成
  private questPatterns = {
    learning: [
      '{topic}について{duration}分間学習する',
      '{topic}の基本概念を理解する',
      '{topic}に関する動画を視聴する',
    ],
    practice: [
      '{skill}を{duration}分間練習する',
      '{skill}の基本動作を反復練習する', 
      '{skill}を使った簡単な課題をこなす',
    ],
    creation: [
      '{topic}について短い文章を書く',
      '{skill}を使って何かを作成する',
      '{topic}に関するアイデアをまとめる',
    ],
  };

  private generateQuestTitle(type: string, goal: Goal): string {
    const patterns = this.questPatterns[type as keyof typeof this.questPatterns] || this.questPatterns.learning;
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    
    return pattern
      .replace('{topic}', goal.title)
      .replace('{skill}', goal.title)
      .replace('{duration}', '15');
  }

  // 4. オフライン用プリコンピュート
  async precomputeOfflineQuests(userProfile: UserProfile): Promise<void> {
    const questSets = {
      daily_basic: this.generateQuickQuests(userProfile),
      daily_alternative: this.generateAlternativeQuests(userProfile),
      emergency_fallback: this.generateEmergencyQuests(),
    };
    
    // オフライン用キャッシュに保存
    await AsyncStorage.setItem(
      'precomputed_quests',
      JSON.stringify(questSets)
    );
  }

  async getOfflineQuests(type: string = 'daily_basic'): Promise<Quest[]> {
    const cached = await AsyncStorage.getItem('precomputed_quests');
    if (!cached) return [];
    
    const questSets = JSON.parse(cached);
    return questSets[type] || [];
  }
}

export const precomputeService = new PrecomputeService();
```

## 4. データベース最適化

### 4.1 Firestore最適化戦略

```typescript
// services/database/optimizedFirestore.ts
class OptimizedFirestoreService {
  private batchOperations: any[] = [];
  private readonly BATCH_LIMIT = 500;
  
  // 1. バッチ処理による効率的な書き込み
  async batchWrite(operations: BatchOperation[]): Promise<void> {
    const chunks = this.chunkArray(operations, this.BATCH_LIMIT);
    
    for (const chunk of chunks) {
      const batch = db.batch();
      
      chunk.forEach(operation => {
        switch (operation.type) {
          case 'set':
            batch.set(operation.ref, operation.data);
            break;
          case 'update':
            batch.update(operation.ref, operation.data);
            break;
          case 'delete':
            batch.delete(operation.ref);
            break;
        }
      });
      
      await batch.commit();
    }
  }

  // 2. 効率的なクエリ設計
  async getOptimizedUserQuests(userId: string, date: string): Promise<Quest[]> {
    // 複合インデックスを活用
    const questsRef = collection(db, 'users', userId, 'dailyQuests');
    
    const q = query(
      questsRef,
      where('date', '==', date),
      where('active', '==', true),
      orderBy('priority', 'desc'),
      limit(20) // 必要最小限のデータのみ取得
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Quest[];
  }

  // 3. リアルタイムリスナーの最適化
  optimizedListener(userId: string, callback: (data: any) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    
    // 最小限のデータのみをリッスン
    const questsRef = collection(db, 'users', userId, 'dailyQuests');
    const limitedQuery = query(
      questsRef,
      where('date', '==', formatToday()),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );
    
    const unsubscribe = onSnapshot(limitedQuery, 
      (snapshot) => {
        // 変更されたドキュメントのみ処理
        const changes = snapshot.docChanges();
        if (changes.length > 0) {
          const updatedData = changes.map(change => ({
            type: change.type,
            doc: { id: change.doc.id, ...change.doc.data() }
          }));
          callback(updatedData);
        }
      },
      (error) => {
        console.error('Firestore listener error:', error);
      }
    );
    
    unsubscribes.push(unsubscribe);
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }

  // 4. データ構造最適化
  async optimizeDataStructure(userId: string): Promise<void> {
    // 非正規化による読み取り最適化
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // よく使用されるデータをユーザードキュメントに非正規化
      const optimizedData = {
        ...userData,
        cachedStats: {
          totalQuests: userData.totalQuests,
          currentStreak: userData.currentStreak,
          lastLoginDate: userData.lastLoginDate,
          updatedAt: new Date(),
        },
      };
      
      await setDoc(userRef, optimizedData, { merge: true });
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

interface BatchOperation {
  type: 'set' | 'update' | 'delete';
  ref: any;
  data?: any;
}

export const optimizedFirestore = new OptimizedFirestoreService();
```

### 4.2 ローカルキャッシュ最適化

```typescript
// services/cache/optimizedCache.ts
class OptimizedCacheService {
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MAX_MEMORY_SIZE = 50 * 1024 * 1024; // 50MB
  private readonly DEFAULT_TTL = 60 * 60 * 1000; // 1時間
  
  // 1. メモリ効率的なキャッシング
  async set(key: string, data: any, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(data);
    const size = new Blob([serialized]).size;
    
    // メモリ制限チェック
    if (this.getCurrentMemoryUsage() + size > this.MAX_MEMORY_SIZE) {
      await this.evictLRU(size);
    }
    
    const entry: CacheEntry = {
      data: serialized,
      size,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL,
      accessCount: 0,
      lastAccess: Date.now(),
    };
    
    this.memoryCache.set(key, entry);
    
    // 永続化が必要な重要データはディスクに保存
    if (this.isImportantData(key)) {
      await AsyncStorage.setItem(`cache_${key}`, serialized);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    // メモリキャッシュから確認
    let entry = this.memoryCache.get(key);
    
    if (!entry) {
      // ディスクキャッシュから復元
      const diskData = await AsyncStorage.getItem(`cache_${key}`);
      if (diskData) {
        entry = {
          data: diskData,
          size: new Blob([diskData]).size,
          timestamp: Date.now() - this.DEFAULT_TTL + 10000, // 10秒余裕
          ttl: this.DEFAULT_TTL,
          accessCount: 0,
          lastAccess: Date.now(),
        };
        this.memoryCache.set(key, entry);
      }
    }
    
    if (!entry) return null;
    
    // TTL確認
    if (Date.now() - entry.timestamp > entry.ttl) {
      await this.delete(key);
      return null;
    }
    
    // アクセス統計更新
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    return JSON.parse(entry.data);
  }

  // 2. インテリジェントな事前読み込み
  async prefetch(keys: string[]): Promise<void> {
    const prefetchPromises = keys.map(async (key) => {
      const cached = await this.get(key);
      if (!cached) {
        // キャッシュにない場合は取得
        return this.fetchAndCache(key);
      }
      return cached;
    });
    
    await Promise.allSettled(prefetchPromises);
  }

  // 3. LRU削除戦略
  private async evictLRU(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess); // 最後のアクセス時間でソート
    
    let freedSpace = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of entries) {
      keysToDelete.push(key);
      freedSpace += entry.size;
      
      if (freedSpace >= requiredSpace) {
        break;
      }
    }
    
    // 選択されたエントリを削除
    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }

  // 4. キャッシュヒット率監視
  private hitCount = 0;
  private missCount = 0;
  
  recordCacheHit(): void {
    this.hitCount++;
  }
  
  recordCacheMiss(): void {
    this.missCount++;
  }
  
  getCacheStats(): CacheStats {
    const total = this.hitCount + this.missCount;
    return {
      hitRate: total > 0 ? this.hitCount / total : 0,
      totalHits: this.hitCount,
      totalMisses: this.missCount,
      cacheSize: this.memoryCache.size,
      memoryUsage: this.getCurrentMemoryUsage(),
    };
  }

  private getCurrentMemoryUsage(): number {
    return Array.from(this.memoryCache.values())
      .reduce((total, entry) => total + entry.size, 0);
  }

  private isImportantData(key: string): boolean {
    const importantPrefixes = ['user_', 'quest_', 'ai_insight_'];
    return importantPrefixes.some(prefix => key.startsWith(prefix));
  }

  private async fetchAndCache(key: string): Promise<any> {
    // 実際のデータ取得ロジック（実装に応じて）
    return null;
  }

  private async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    await AsyncStorage.removeItem(`cache_${key}`);
  }
}

interface CacheEntry {
  data: string;
  size: number;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  cacheSize: number;
  memoryUsage: number;
}

export const optimizedCache = new OptimizedCacheService();
```

## 5. ネットワーク最適化

### 5.1 効率的なAPI通信

```typescript
// services/network/optimizedNetworking.ts
class OptimizedNetworkingService {
  private requestQueue: QueuedRequest[] = [];
  private isProcessing = false;
  private connectionType: string = 'unknown';
  
  constructor() {
    this.initializeNetworkMonitoring();
  }

  // 1. 接続品質に応じた最適化
  private initializeNetworkMonitoring(): void {
    NetInfo.addEventListener(state => {
      this.connectionType = state.type;
      this.adjustRequestStrategy(state);
    });
  }

  private adjustRequestStrategy(networkState: any): void {
    if (networkState.type === 'cellular') {
      // モバイル接続時は圧縮を強化
      this.enableCompression();
      this.reduceImageQuality();
    } else if (networkState.type === 'wifi') {
      // Wi-Fi接続時は通常品質
      this.disableCompression();
      this.normalImageQuality();
    }

    if (networkState.details?.isConnectionExpensive) {
      // 従量制接続時はトラフィックを削減
      this.enableDataSaver();
    }
  }

  // 2. リクエストキューイング
  async queueRequest(request: QueuedRequest): Promise<any> {
    // 優先度に基づいてソート
    this.requestQueue.push(request);
    this.requestQueue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return new Promise((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
  }

  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      // 接続品質に応じた同時リクエスト数調整
      const concurrent = this.getConcurrentLimit();
      
      while (this.requestQueue.length > 0) {
        const batch = this.requestQueue.splice(0, concurrent);
        
        const results = await Promise.allSettled(
          batch.map(req => this.executeRequest(req))
        );
        
        results.forEach((result, index) => {
          const request = batch[index];
          if (result.status === 'fulfilled') {
            request.resolve(result.value);
          } else {
            request.reject(result.reason);
          }
        });
        
        // レート制限を考慮した待機
        await this.throttleRequests();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private getConcurrentLimit(): number {
    switch (this.connectionType) {
      case 'wifi': return 6;
      case 'cellular': return 2;
      case 'ethernet': return 8;
      default: return 3;
    }
  }

  // 3. 応答圧縮
  private async executeRequest(request: QueuedRequest): Promise<any> {
    const headers = {
      'Content-Type': 'application/json',
      'Accept-Encoding': 'gzip, deflate, br',
      ...request.headers,
    };
    
    // リクエストボディの圧縮
    let body = request.body;
    if (body && typeof body === 'object') {
      body = JSON.stringify(body);
      
      if (body.length > 1024) { // 1KB以上は圧縮
        headers['Content-Encoding'] = 'gzip';
        body = await this.compressData(body);
      }
    }
    
    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body,
      timeout: this.getTimeoutForPriority(request.priority),
    });
    
    return this.parseResponse(response);
  }

  // 4. レスポンスキャッシング
  private responseCache = new Map<string, CachedResponse>();
  
  private async parseResponse(response: Response): Promise<any> {
    const cacheKey = this.generateCacheKey(response.url);
    
    if (response.status === 304) {
      // Not Modified - キャッシュから返す
      const cached = this.responseCache.get(cacheKey);
      return cached?.data;
    }
    
    const data = await response.json();
    
    // ETagがある場合はキャッシュ
    const etag = response.headers.get('etag');
    if (etag) {
      this.responseCache.set(cacheKey, {
        data,
        etag,
        timestamp: Date.now(),
      });
    }
    
    return data;
  }

  // 5. 画像の最適化読み込み
  async loadOptimizedImage(
    url: string, 
    size: { width: number; height: number },
    quality: number = 80
  ): Promise<string> {
    // デバイスの画面密度に応じてサイズ調整
    const scale = PixelRatio.get();
    const optimizedSize = {
      width: Math.round(size.width * scale),
      height: Math.round(size.height * scale),
    };
    
    // 接続品質に応じて品質調整
    let adjustedQuality = quality;
    if (this.connectionType === 'cellular') {
      adjustedQuality = Math.min(quality, 60);
    }
    
    // 最適化されたURLを生成
    const optimizedUrl = `${url}?w=${optimizedSize.width}&h=${optimizedSize.height}&q=${adjustedQuality}&f=webp`;
    
    return optimizedUrl;
  }

  private async compressData(data: string): Promise<string> {
    // 実際の実装では適切な圧縮ライブラリを使用
    return data;
  }

  private async throttleRequests(): Promise<void> {
    const delay = this.connectionType === 'cellular' ? 100 : 50;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getTimeoutForPriority(priority: number): number {
    return priority > 8 ? 5000 : priority > 5 ? 10000 : 15000;
  }
}

interface QueuedRequest {
  url: string;
  method: string;
  body?: any;
  headers?: Record<string, string>;
  priority: number; // 1-10, 10が最高優先度
  resolve?: (value: any) => void;
  reject?: (reason: any) => void;
}

interface CachedResponse {
  data: any;
  etag: string;
  timestamp: number;
}

export const optimizedNetworking = new OptimizedNetworkingService();
```

## 6. パフォーマンス監視

### 6.1 リアルタイム監視

```typescript
// services/monitoring/performanceMonitor.ts
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private observers: PerformanceObserver[] = [];
  
  startMonitoring(): void {
    this.setupJSMetrics();
    this.setupUIMetrics();
    this.setupNetworkMetrics();
    this.setupMemoryMetrics();
  }

  // 1. JavaScript実行性能
  private setupJSMetrics(): void {
    const startTime = performance.now();
    
    // フレームレート監視
    let frameCount = 0;
    let lastFrameTime = startTime;
    
    const trackFrame = () => {
      frameCount++;
      const now = performance.now();
      
      if (now - lastFrameTime >= 1000) { // 1秒ごと
        const fps = Math.round(frameCount * 1000 / (now - lastFrameTime));
        
        this.recordMetric({
          name: 'fps',
          value: fps,
          timestamp: now,
          category: 'ui_performance',
        });
        
        frameCount = 0;
        lastFrameTime = now;
      }
      
      requestAnimationFrame(trackFrame);
    };
    
    requestAnimationFrame(trackFrame);
  }

  // 2. UI応答性能
  private setupUIMetrics(): void {
    // タップ応答時間測定
    const originalHandler = TouchableOpacity.prototype.onPress;
    TouchableOpacity.prototype.onPress = function(event) {
      const startTime = performance.now();
      
      const result = originalHandler.call(this, event);
      
      const endTime = performance.now();
      performanceMonitor.recordMetric({
        name: 'tap_response_time',
        value: endTime - startTime,
        timestamp: endTime,
        category: 'ui_performance',
      });
      
      return result;
    };
  }

  // 3. ネットワーク性能
  private setupNetworkMetrics(): void {
    const originalFetch = global.fetch;
    
    global.fetch = async (...args) => {
      const startTime = performance.now();
      
      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();
        
        this.recordMetric({
          name: 'network_request_time',
          value: endTime - startTime,
          timestamp: endTime,
          category: 'network_performance',
          metadata: {
            url: args[0],
            status: response.status,
            size: response.headers.get('content-length'),
          },
        });
        
        return response;
      } catch (error) {
        const endTime = performance.now();
        
        this.recordMetric({
          name: 'network_request_error',
          value: endTime - startTime,
          timestamp: endTime,
          category: 'network_performance',
          metadata: {
            url: args[0],
            error: error.message,
          },
        });
        
        throw error;
      }
    };
  }

  // 4. メモリ使用量監視
  private setupMemoryMetrics(): void {
    setInterval(() => {
      if (performance.memory) {
        this.recordMetric({
          name: 'memory_usage',
          value: performance.memory.usedJSHeapSize,
          timestamp: performance.now(),
          category: 'memory_performance',
          metadata: {
            total: performance.memory.totalJSHeapSize,
            limit: performance.memory.jsHeapSizeLimit,
          },
        });
      }
    }, 5000); // 5秒ごと
  }

  // 5. メトリクス記録
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // メトリクス配列のサイズ制限
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500); // 最新500件保持
    }
    
    // 閾値を超えた場合の警告
    this.checkPerformanceThresholds(metric);
    
    // 分析サービスに送信（バッチ処理）
    this.queueForAnalytics(metric);
  }

  private checkPerformanceThresholds(metric: PerformanceMetric): void {
    const thresholds = {
      fps: 30,                    // 30fps以下で警告
      tap_response_time: 100,     // 100ms以上で警告 
      network_request_time: 5000, // 5秒以上で警告
      memory_usage: 100 * 1024 * 1024, // 100MB以上で警告
    };
    
    const threshold = thresholds[metric.name as keyof typeof thresholds];
    if (threshold && metric.value > threshold) {
      console.warn(`Performance warning: ${metric.name} = ${metric.value}`);
      
      // 重要なパフォーマンス問題はすぐに報告
      this.reportPerformanceIssue(metric);
    }
  }

  // 6. パフォーマンスレポート生成
  generatePerformanceReport(): PerformanceReport {
    const now = performance.now();
    const last5min = now - 5 * 60 * 1000;
    
    const recentMetrics = this.metrics.filter(m => m.timestamp > last5min);
    
    return {
      timestamp: now,
      summary: {
        avgFPS: this.calculateAverage(recentMetrics, 'fps'),
        avgTapResponse: this.calculateAverage(recentMetrics, 'tap_response_time'),
        avgNetworkTime: this.calculateAverage(recentMetrics, 'network_request_time'),
        currentMemory: this.getLatestValue(recentMetrics, 'memory_usage'),
      },
      details: {
        performanceIssues: this.getPerformanceIssues(recentMetrics),
        topSlowOperations: this.getTopSlowOperations(recentMetrics),
        memoryTrend: this.getMemoryTrend(recentMetrics),
      },
    };
  }

  private calculateAverage(metrics: PerformanceMetric[], name: string): number {
    const filtered = metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    
    const sum = filtered.reduce((acc, m) => acc + m.value, 0);
    return sum / filtered.length;
  }

  private getLatestValue(metrics: PerformanceMetric[], name: string): number {
    const filtered = metrics.filter(m => m.name === name);
    return filtered.length > 0 ? filtered[filtered.length - 1].value : 0;
  }
}

interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  category: string;
  metadata?: any;
}

interface PerformanceReport {
  timestamp: number;
  summary: {
    avgFPS: number;
    avgTapResponse: number;
    avgNetworkTime: number;
    currentMemory: number;
  };
  details: {
    performanceIssues: any[];
    topSlowOperations: any[];
    memoryTrend: any[];
  };
}

export const performanceMonitor = new PerformanceMonitor();
```
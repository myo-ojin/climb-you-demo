# 状態管理設計 - Zustand

## 1. Zustand採用理由

### 1.1 技術選定理由

- **軽量性**: Redux/MobXと比較して小さなバンドルサイズ
- **簡潔性**: ボイラープレートコードが最小限
- **TypeScript親和性**: 優れた型安全性とIntelliSense
- **React Native互換性**: ネイティブ環境での安定動作
- **学習コスト**: 開発チームの習得が容易

### 1.2 Redux/Context APIとの比較

| 機能 | Zustand | Redux | Context API |
|------|---------|-------|-------------|
| バンドルサイズ | 8kb | 70kb+ | Built-in |
| ボイラープレート | 最小 | 大量 | 中程度 |
| TypeScript | 優秀 | 良好 | 基本的 |
| DevTools | 対応 | 充実 | 限定的 |
| 学習コスト | 低 | 高 | 中 |

## 2. ストア設計パターン

### 2.1 ストア分割戦略

```typescript
// 機能別ストア分割
export interface AppState {
  // ユーザー関連状態
  user: UserState;
  // クエスト関連状態
  quest: QuestState;
  // AI機能関連状態
  ai: AIState;
  // UI状態
  ui: UIState;
  // 設定・環境設定
  preferences: PreferencesState;
}
```

### 2.2 ストアスライス実装

#### User Store
```typescript
// stores/userStore.ts
interface UserState {
  // 状態
  profile: UserProfile | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  learningStyle: LearningStyle | null;
  goals: Goal[];
  
  // ローディング・エラー状態
  isLoading: boolean;
  error: string | null;
}

interface UserActions {
  // 認証関連
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  
  // プロファイル管理
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  setLearningStyle: (style: LearningStyle) => void;
  
  // 目標管理
  addGoal: (goal: Omit<Goal, 'id'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  
  // オンボーディング
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  
  // ユーティリティ
  clearError: () => void;
  reset: () => void;
}

export const useUserStore = create<UserState & UserActions>()(
  devtools(
    persist(
      (set, get) => ({
        // 初期状態
        profile: null,
        isAuthenticated: false,
        onboardingComplete: false,
        learningStyle: null,
        goals: [],
        isLoading: false,
        error: null,

        // アクション実装
        login: async (credentials) => {
          set({ isLoading: true, error: null });
          try {
            const user = await authService.login(credentials);
            set({
              profile: user.profile,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error.message,
              isLoading: false,
            });
          }
        },

        updateProfile: async (updates) => {
          const currentProfile = get().profile;
          if (!currentProfile) return;

          set({ isLoading: true });
          try {
            const updatedProfile = await userService.updateProfile(updates);
            set({
              profile: updatedProfile,
              isLoading: false,
            });
          } catch (error) {
            set({
              error: error.message,
              isLoading: false,
            });
          }
        },

        // その他のアクション...
        logout: () => {
          authService.logout();
          set({
            profile: null,
            isAuthenticated: false,
            goals: [],
            onboardingComplete: false,
          });
        },

        reset: () => {
          set({
            profile: null,
            isAuthenticated: false,
            onboardingComplete: false,
            learningStyle: null,
            goals: [],
            isLoading: false,
            error: null,
          });
        },
      }),
      {
        name: 'user-store',
        storage: createJSONStorage(() => AsyncStorage),
        // 永続化対象の選択
        partialize: (state) => ({
          profile: state.profile,
          isAuthenticated: state.isAuthenticated,
          onboardingComplete: state.onboardingComplete,
          learningStyle: state.learningStyle,
        }),
      }
    ),
    { name: 'UserStore' }
  )
);
```

#### Quest Store
```typescript
// stores/questStore.ts
interface QuestState {
  // クエスト状態
  dailyQuests: Quest[];
  completedQuests: CompletedQuest[];
  currentStreak: number;
  totalCompleted: number;
  
  // AI生成関連
  isGenerating: boolean;
  lastGenerated: Date | null;
  
  // ローディング・エラー状態
  isLoading: boolean;
  error: string | null;
}

interface QuestActions {
  // クエスト取得・生成
  fetchDailyQuests: () => Promise<void>;
  generateQuests: (forceRegenerate?: boolean) => Promise<void>;
  
  // クエスト操作
  completeQuest: (questId: string, completionData: QuestCompletion) => Promise<void>;
  updateQuestProgress: (questId: string, progress: number) => void;
  skipQuest: (questId: string, reason: string) => Promise<void>;
  
  // データ管理
  refreshHistory: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useQuestStore = create<QuestState & QuestActions>()(
  devtools(
    (set, get) => ({
      // 初期状態
      dailyQuests: [],
      completedQuests: [],
      currentStreak: 0,
      totalCompleted: 0,
      isGenerating: false,
      lastGenerated: null,
      isLoading: false,
      error: null,

      // アクション実装
      generateQuests: async (forceRegenerate = false) => {
        const state = get();
        const today = new Date().toDateString();
        const lastGen = state.lastGenerated?.toDateString();
        
        // 既に今日生成済みかチェック
        if (!forceRegenerate && lastGen === today) {
          return;
        }

        set({ isGenerating: true, error: null });
        try {
          const userProfile = useUserStore.getState().profile;
          const learningHistory = state.completedQuests.slice(-7); // 直近7日
          
          const quests = await aiService.generateDailyQuests({
            userProfile,
            learningHistory,
            preferences: useUserStore.getState().learningStyle,
          });

          set({
            dailyQuests: quests,
            lastGenerated: new Date(),
            isGenerating: false,
          });
        } catch (error) {
          set({
            error: error.message,
            isGenerating: false,
          });
        }
      },

      completeQuest: async (questId, completionData) => {
        const quest = get().dailyQuests.find(q => q.id === questId);
        if (!quest) return;

        try {
          const completedQuest = await questService.completeQuest(questId, completionData);
          
          set(state => ({
            completedQuests: [...state.completedQuests, completedQuest],
            dailyQuests: state.dailyQuests.filter(q => q.id !== questId),
            totalCompleted: state.totalCompleted + 1,
            currentStreak: calculateNewStreak(state.completedQuests, completedQuest),
          }));

          // AI学習パターン分析をトリガー
          useAIStore.getState().analyzeCompletion(completedQuest);
        } catch (error) {
          set({ error: error.message });
        }
      },

      // その他のアクション...
    }),
    { name: 'QuestStore' }
  )
);
```

#### AI Store
```typescript
// stores/aiStore.ts
interface AIState {
  // 分析結果
  insights: AIInsight[];
  learningPatterns: LearningPattern;
  recommendations: Recommendation[];
  
  // 処理状態
  isAnalyzing: boolean;
  isLoadingInsights: boolean;
  
  // キャッシュ
  lastAnalysis: Date | null;
  
  error: string | null;
}

interface AIActions {
  // 分析関連
  analyzeProfile: (profileData: ProfileData) => Promise<AIInsight>;
  analyzeCompletion: (completion: CompletedQuest) => Promise<void>;
  generateWeeklyReport: () => Promise<WeeklyReport>;
  
  // 洞察取得
  fetchInsights: () => Promise<void>;
  getRecommendations: () => Promise<void>;
  
  // キャッシュ管理
  clearCache: () => void;
  refreshAnalysis: () => Promise<void>;
}

export const useAIStore = create<AIState & AIActions>()(
  devtools(
    (set, get) => ({
      insights: [],
      learningPatterns: {},
      recommendations: [],
      isAnalyzing: false,
      isLoadingInsights: false,
      lastAnalysis: null,
      error: null,

      analyzeProfile: async (profileData) => {
        set({ isAnalyzing: true, error: null });
        try {
          const insight = await aiService.analyzeProfile(profileData);
          set(state => ({
            insights: [...state.insights, insight],
            lastAnalysis: new Date(),
            isAnalyzing: false,
          }));
          return insight;
        } catch (error) {
          set({
            error: error.message,
            isAnalyzing: false,
          });
          throw error;
        }
      },

      analyzeCompletion: async (completion) => {
        // バックグラウンドで学習パターンを分析
        try {
          const patterns = await aiService.analyzeLearningPattern(completion);
          set(state => ({
            learningPatterns: { ...state.learningPatterns, ...patterns }
          }));
        } catch (error) {
          console.error('Learning pattern analysis failed:', error);
        }
      },
    }),
    { name: 'AIStore' }
  )
);
```

## 3. 複合ストア操作

### 3.1 ストア間連携

```typescript
// hooks/useStoreActions.ts
export const useStoreActions = () => {
  const userActions = useUserStore(state => state);
  const questActions = useQuestStore(state => state);
  const aiActions = useAIStore(state => state);

  // 複合操作: オンボーディング完了
  const completeOnboarding = async (data: OnboardingData) => {
    try {
      // 1. ユーザープロファイル保存
      await userActions.completeOnboarding(data);
      
      // 2. AIプロファイル分析
      const insight = await aiActions.analyzeProfile(data);
      
      // 3. 初回クエスト生成
      await questActions.generateQuests(true);
      
      return { success: true, insight };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // 複合操作: 日次初期化
  const initializeDailySession = async () => {
    const userProfile = userActions.profile;
    if (!userProfile) return;

    // クエスト生成（必要な場合のみ）
    await questActions.generateQuests();
    
    // インサイト更新
    await aiActions.fetchInsights();
  };

  return {
    completeOnboarding,
    initializeDailySession,
  };
};
```

### 3.2 選択的サブスクリプション

```typescript
// hooks/useOptimizedSelectors.ts

// 特定のデータのみを監視
export const useUserProfile = () => 
  useUserStore(state => state.profile);

export const useDailyQuests = () => 
  useQuestStore(state => state.dailyQuests);

// 複数ストアからの複合選択
export const useDashboardData = () => {
  const profile = useUserStore(state => state.profile);
  const quests = useQuestStore(state => state.dailyQuests);
  const insights = useAIStore(state => state.insights.slice(-3)); // 最新3件
  
  return useMemo(() => ({
    profile,
    quests,
    insights,
  }), [profile, quests, insights]);
};

// 計算結果のメモ化
export const useQuestStats = () => {
  return useQuestStore(
    state => ({
      completionRate: calculateCompletionRate(state.completedQuests),
      streak: state.currentStreak,
      totalCompleted: state.totalCompleted,
    }),
    shallow // shallowコンパレーターを使用
  );
};
```

## 4. 永続化戦略

### 4.1 選択的永続化

```typescript
// utils/persistence.ts
export const createPersistConfig = <T>(
  name: string,
  partializer?: (state: T) => Partial<T>
) => ({
  name,
  storage: createJSONStorage(() => AsyncStorage),
  partialize: partializer,
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.error(`Failed to rehydrate ${name}:`, error);
    }
  },
});

// ストア別永続化設定
export const userPersistConfig = createPersistConfig(
  'user-store',
  state => ({
    profile: state.profile,
    isAuthenticated: state.isAuthenticated,
    onboardingComplete: state.onboardingComplete,
    learningStyle: state.learningStyle,
  })
);

export const questPersistConfig = createPersistConfig(
  'quest-store',
  state => ({
    completedQuests: state.completedQuests.slice(-30), // 最新30件のみ
    currentStreak: state.currentStreak,
    totalCompleted: state.totalCompleted,
  })
);
```

### 4.2 データ移行・バージョニング

```typescript
// utils/migration.ts
interface MigrationOptions {
  version: number;
  migrate: (persistedState: any) => any;
}

export const createMigration = (migrations: MigrationOptions[]) => ({
  version: Math.max(...migrations.map(m => m.version)),
  migrate: (persistedState: any, version: number) => {
    return migrations
      .filter(m => m.version > version)
      .sort((a, b) => a.version - b.version)
      .reduce((state, migration) => migration.migrate(state), persistedState);
  },
});

// マイグレーション例
export const userStoreMigrations = createMigration([
  {
    version: 1,
    migrate: (state) => ({
      ...state,
      preferences: state.preferences || {},
    }),
  },
  {
    version: 2,
    migrate: (state) => ({
      ...state,
      learningStyle: migrateOldLearningStyleFormat(state.learningStyle),
    }),
  },
]);
```

## 5. デバッグ・開発ツール

### 5.1 DevTools統合

```typescript
// stores/devtools.ts
const devtoolsConfig = {
  enabled: __DEV__,
  name: 'Climb You App',
  serialize: {
    options: true,
  },
};

export const withDevtools = <T>(store: StateCreator<T>) =>
  __DEV__ ? devtools(store, devtoolsConfig) : store;
```

### 5.2 デバッグヘルパー

```typescript
// utils/storeDebug.ts
export const logStoreAction = (storeName: string, action: string, payload?: any) => {
  if (__DEV__) {
    console.group(`🏪 ${storeName} - ${action}`);
    if (payload) console.log('Payload:', payload);
    console.groupEnd();
  }
};

// ストア状態のスナップショット
export const takeStoreSnapshot = () => ({
  user: useUserStore.getState(),
  quest: useQuestStore.getState(),
  ai: useAIStore.getState(),
  timestamp: new Date().toISOString(),
});

// パフォーマンス監視
export const withPerformanceMonitoring = <T extends (...args: any[]) => any>(
  fn: T,
  actionName: string
): T => {
  return ((...args: any[]) => {
    const start = Date.now();
    const result = fn(...args);
    const duration = Date.now() - start;
    
    if (duration > 100) { // 100ms以上の処理を警告
      console.warn(`Slow action detected: ${actionName} took ${duration}ms`);
    }
    
    return result;
  }) as T;
};
```

## 6. テスト戦略

### 6.1 ストアテスト

```typescript
// __tests__/stores/userStore.test.ts
describe('UserStore', () => {
  beforeEach(() => {
    useUserStore.getState().reset();
  });

  it('should handle login successfully', async () => {
    const store = useUserStore.getState();
    const mockUser = { id: '1', name: 'Test User' };
    
    jest.spyOn(authService, 'login').mockResolvedValue(mockUser);
    
    await store.login({ email: 'test@example.com', password: 'password' });
    
    const state = useUserStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.profile).toEqual(mockUser);
  });

  it('should handle profile update', async () => {
    // テストケース実装
  });
});
```

### 6.2 統合テスト

```typescript
// __tests__/integration/onboarding.test.ts
describe('Onboarding Integration', () => {
  it('should complete full onboarding flow', async () => {
    const { completeOnboarding } = useStoreActions();
    
    const onboardingData = {
      profile: { name: 'Test User', age: 25 },
      learningStyle: 'visual',
      goals: [{ title: 'Learn React', deadline: '2024-12-31' }],
    };
    
    const result = await completeOnboarding(onboardingData);
    
    expect(result.success).toBe(true);
    expect(useUserStore.getState().onboardingComplete).toBe(true);
    expect(useQuestStore.getState().dailyQuests).toHaveLength(3);
  });
});
```
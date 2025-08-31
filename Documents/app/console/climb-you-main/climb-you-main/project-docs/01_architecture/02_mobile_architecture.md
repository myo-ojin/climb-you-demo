# モバイルアプリアーキテクチャ

## 1. React Native アプリケーション構造

### 1.1 プロジェクト構成

```
climb-you-app/
├── src/
│   ├── components/          # 再利用可能コンポーネント
│   │   ├── ui/             # 基本UIコンポーネント
│   │   ├── quest/          # クエスト関連コンポーネント
│   │   ├── progress/       # 進捗表示コンポーネント
│   │   └── ai/             # AI機能コンポーネント
│   ├── screens/            # 画面コンポーネント
│   │   ├── onboarding/     # オンボーディング画面
│   │   ├── today/          # ホーム画面
│   │   ├── growth/         # インサイト画面
│   │   ├── goals/          # 目標管理画面
│   │   └── history/        # 履歴画面
│   ├── services/           # 外部サービス連携
│   │   ├── openai/         # OpenAI API
│   │   ├── firebase/       # Firebase関連
│   │   └── storage/        # ローカルストレージ
│   ├── stores/             # 状態管理 (Zustand)
│   ├── types/              # TypeScript型定義
│   ├── utils/              # ユーティリティ関数
│   ├── hooks/              # カスタムフック
│   └── constants/          # 定数定義
├── assets/                 # 静的リソース
├── app.config.js          # Expo設定
└── package.json
```

## 2. コンポーネントアーキテクチャ

### 2.1 レイヤー構造

```
Presentation Layer (Screens)
         │
         ▼
Component Layer (Reusable Components)
         │
         ▼
Business Logic Layer (Hooks & Services)
         │
         ▼
Data Layer (Stores & APIs)
```

### 2.2 コンポーネント設計パターン

#### Atomic Design適用

```
Atoms (基本要素)
├── Button
├── Input
├── Text
└── Icon

Molecules (組み合わせ)
├── QuestCard
├── ProgressBar
└── ProfileInput

Organisms (機能単位)
├── QuestList
├── MountainProgress
└── OnboardingWizard

Templates (レイアウト)
├── ScreenTemplate
├── TabTemplate
└── ModalTemplate

Pages (画面)
├── TodayScreen
├── GrowthScreen
└── GoalsScreen
```

## 3. 状態管理アーキテクチャ (Zustand)

### 3.1 ストア構造

```typescript
// stores/index.ts
export interface AppState {
  user: UserState;
  quests: QuestState;
  ai: AIState;
  preferences: PreferencesState;
}

// stores/userStore.ts
interface UserState {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  actions: {
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => void;
    updateProfile: (profile: Partial<UserProfile>) => void;
  };
}

// stores/questStore.ts
interface QuestState {
  dailyQuests: Quest[];
  completedQuests: Quest[];
  isLoading: boolean;
  actions: {
    generateQuests: () => Promise<void>;
    completeQuest: (questId: string) => void;
    refreshQuests: () => Promise<void>;
  };
}
```

### 3.2 状態の永続化

```typescript
// ローカルストレージとの同期
const usePersistedStore = create<AppState>()(
  persist(
    (set, get) => ({
      // store implementation
    }),
    {
      name: 'climb-you-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        preferences: state.preferences,
      }),
    }
  )
);
```

## 4. ナビゲーション設計

### 4.1 ナビゲーション構造

```typescript
// navigation/AppNavigator.tsx
const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : !onboardingComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Stack.Screen name="Main" component={MainNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// メインタブナビゲーション
const MainNavigator = () => {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Growth" component={GrowthScreen} />
      <Tab.Screen name="Goals" component={GoalsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
};
```

### 4.2 画面遷移パターン

```typescript
// 型安全なナビゲーション
type RootStackParamList = {
  Today: undefined;
  QuestDetail: { questId: string };
  Profile: undefined;
  AIInsight: { analysisId: string };
};

// ナビゲーションフック
const useAppNavigation = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  
  return {
    navigateToQuestDetail: (questId: string) =>
      navigation.navigate('QuestDetail', { questId }),
    navigateToAIInsight: (analysisId: string) =>
      navigation.navigate('AIInsight', { analysisId }),
  };
};
```

## 5. スタイリング アーキテクチャ

### 5.1 NativeWind + デザイントークン

```typescript
// styles/tokens.ts
export const designTokens = {
  colors: {
    primary: {
      50: '#f0f9ff',
      500: '#3b82f6',
      900: '#1e3a8a',
    },
    mountain: {
      sky: '#87CEEB',
      peak: '#8B4513',
      trail: '#228B22',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    sizes: {
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
    },
  },
};

// Tailwind設定
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: designTokens.colors,
      spacing: designTokens.spacing,
    },
  },
};
```

### 5.2 スタイルコンポーネント例

```typescript
// components/ui/Button.tsx
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  onPress: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant,
  size,
  onPress,
  children,
}) => {
  const baseClasses = 'rounded-lg font-medium active:opacity-70';
  const variantClasses = {
    primary: 'bg-primary-500 text-white',
    secondary: 'bg-gray-200 text-gray-900',
    ghost: 'bg-transparent text-primary-500',
  };
  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-md',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <Pressable
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
      onPress={onPress}
    >
      <Text className="text-center font-medium">{children}</Text>
    </Pressable>
  );
};
```

## 6. データ統合アーキテクチャ

### 6.1 React Query統合

```typescript
// hooks/useQuests.ts
export const useQuests = () => {
  const questStore = useQuestStore();
  
  return useQuery({
    queryKey: ['quests', 'daily'],
    queryFn: async () => {
      const quests = await questService.getDailyQuests();
      questStore.setQuests(quests);
      return quests;
    },
    staleTime: 5 * 60 * 1000, // 5分間
    cacheTime: 10 * 60 * 1000, // 10分間
  });
};

// AI分析のミューテーション
export const useAIAnalysis = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: aiService.analyzeProfile,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['quests']);
      // ストア更新
    },
    onError: (error) => {
      // エラーハンドリング
    },
  });
};
```

### 6.2 オフライン対応

```typescript
// services/offline/offlineManager.ts
class OfflineManager {
  private queue: OfflineAction[] = [];

  async addToQueue(action: OfflineAction) {
    this.queue.push(action);
    await AsyncStorage.setItem('offline-queue', JSON.stringify(this.queue));
  }

  async processQueue() {
    if (!NetInfo.isConnected.fetch()) return;

    for (const action of this.queue) {
      try {
        await this.executeAction(action);
        this.removeFromQueue(action.id);
      } catch (error) {
        console.error('Failed to sync offline action:', error);
      }
    }
  }
}
```

## 7. パフォーマンス最適化

### 7.1 レンダリング最適化

```typescript
// コンポーネントメモ化
export const QuestCard = React.memo<QuestCardProps>(({ quest }) => {
  return (
    <View className="bg-white rounded-lg p-4 mb-3 shadow-sm">
      <Text className="text-lg font-semibold">{quest.title}</Text>
      <Text className="text-gray-600">{quest.description}</Text>
    </View>
  );
});

// 仮想化リスト
export const QuestList = ({ quests }: { quests: Quest[] }) => {
  const renderQuest = useCallback(({ item }: { item: Quest }) => (
    <QuestCard quest={item} />
  ), []);

  return (
    <FlatList
      data={quests}
      renderItem={renderQuest}
      keyExtractor={(item) => item.id}
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  );
};
```

### 7.2 画像・アセット最適化

```typescript
// 動的インポートによるコード分割
const MountainAnimation = React.lazy(() => import('./MountainAnimation'));

// 画像の遅延読み込み
export const OptimizedImage = ({ source, ...props }) => {
  return (
    <Image
      source={source}
      {...props}
      progressiveRenderingEnabled={true}
      fadeDuration={300}
    />
  );
};
```

## 8. エラー処理・監視

### 8.1 エラーバウンダリ

```typescript
// components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // エラー報告サービスに送信
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.props.onRetry} />;
    }

    return this.props.children;
  }
}
```

### 8.2 アプリ監視

```typescript
// utils/monitoring.ts
export const logUserAction = (action: string, metadata?: any) => {
  console.log(`User action: ${action}`, metadata);
  // Analytics service への送信
};

export const trackPerformance = (operation: string, duration: number) => {
  console.log(`Performance: ${operation} took ${duration}ms`);
  // パフォーマンス監視サービスへの送信
};
```
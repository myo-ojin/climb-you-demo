# ナビゲーション設計

## 1. ナビゲーション構造

### 1.1 全体ナビゲーションフロー

```
App Launch
    │
    ▼
Authentication Check
    │
    ├─── Not Authenticated ──→ Auth Stack
    │                              │
    │                              ├─── Login
    │                              ├─── Register  
    │                              └─── Forgot Password
    │
    └─── Authenticated
             │
             ▼
        Onboarding Check
             │
             ├─── Not Complete ──→ Onboarding Stack
             │                         │
             │                         ├─── Welcome
             │                         ├─── Profile Setup
             │                         ├─── Learning Style
             │                         ├─── Goals Setting
             │                         └─── AI Analysis
             │
             └─── Complete ──→ Main App
                                   │
                                   └─── Tab Navigator
                                           │
                                           ├─── Today (Stack)
                                           ├─── Growth (Stack)
                                           ├─── Goals (Stack)
                                           └─── History (Stack)
```

### 1.2 React Navigation 7.x 実装

```typescript
// navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useUserStore } from '../stores/userStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { isAuthenticated, onboardingComplete, isLoading } = useUserStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen 
            name="Auth" 
            component={AuthNavigator}
            options={{ animationTypeForReplace: 'pop' }}
          />
        ) : !onboardingComplete ? (
          <Stack.Screen 
            name="Onboarding" 
            component={OnboardingNavigator}
            options={{ gestureEnabled: false }}
          />
        ) : (
          <Stack.Screen 
            name="Main" 
            component={MainNavigator}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
```

## 2. 型安全なナビゲーション

### 2.1 パラメータ型定義

```typescript
// types/navigation.ts
export type RootStackParamList = {
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  Welcome: undefined;
  ProfileSetup: undefined;
  LearningStyle: undefined;
  GoalsSetup: undefined;
  AIAnalysis: { profileData: OnboardingData };
  Complete: { insights: AIInsight };
};

export type MainTabParamList = {
  Today: undefined;
  Growth: undefined;
  Goals: undefined;
  History: undefined;
};

export type TodayStackParamList = {
  TodayHome: undefined;
  QuestDetail: { questId: string };
  QuestComplete: { questId: string; completionData: CompletionData };
  MountainView: undefined;
};

export type GrowthStackParamList = {
  GrowthHome: undefined;
  InsightDetail: { insightId: string };
  LearningPatterns: undefined;
  WeeklyReport: { weekOf: string };
};

export type GoalsStackParamList = {
  GoalsHome: undefined;
  GoalDetail: { goalId: string };
  CreateGoal: undefined;
  EditGoal: { goalId: string };
  GoalProgress: { goalId: string };
};

export type HistoryStackParamList = {
  HistoryHome: undefined;
  MonthView: { month: string; year: string };
  QuestHistory: { questId: string };
  AchievementDetail: { achievementId: string };
};
```

### 2.2 ナビゲーションフック

```typescript
// hooks/useTypedNavigation.ts
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// 型安全なナビゲーションフック
export const useAppNavigation = () => {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
};

export const useTodayNavigation = () => {
  return useNavigation<NativeStackNavigationProp<TodayStackParamList>>();
};

export const useGrowthNavigation = () => {
  return useNavigation<NativeStackNavigationProp<GrowthStackParamList>>();
};

// ナビゲーションヘルパー
export const useNavigationHelpers = () => {
  const todayNav = useTodayNavigation();
  const growthNav = useGrowthNavigation();
  
  return {
    // クエスト詳細へ遷移
    navigateToQuestDetail: (questId: string) => {
      todayNav.navigate('QuestDetail', { questId });
    },
    
    // インサイト詳細へ遷移
    navigateToInsightDetail: (insightId: string) => {
      growthNav.navigate('InsightDetail', { insightId });
    },
    
    // 戻る（安全な戻り）
    safeGoBack: (navigation: any) => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('TodayHome');
      }
    },
  };
};
```

## 3. タブナビゲーション

### 3.1 メインタブ構成

```typescript
// navigation/MainNavigator.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MountainIcon, TrendingUpIcon, TargetIcon, HistoryIcon } from '../components/icons';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#f0f0f0',
          borderTopWidth: 1,
          paddingTop: 8,
          paddingBottom: 8,
          height: 64,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Today"
        component={TodayNavigator}
        options={{
          title: 'Today',
          tabBarIcon: ({ color, size, focused }) => (
            <MountainIcon 
              color={color} 
              size={size} 
              filled={focused}
            />
          ),
          tabBarBadge: useTodayBadgeCount(),
        }}
      />
      
      <Tab.Screen
        name="Growth"
        component={GrowthNavigator}
        options={{
          title: 'Growth',
          tabBarIcon: ({ color, size, focused }) => (
            <TrendingUpIcon 
              color={color} 
              size={size} 
              filled={focused}
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="Goals"
        component={GoalsNavigator}
        options={{
          title: 'Goals',
          tabBarIcon: ({ color, size, focused }) => (
            <TargetIcon 
              color={color} 
              size={size} 
              filled={focused}
            />
          ),
        }}
      />
      
      <Tab.Screen
        name="History"
        component={HistoryNavigator}
        options={{
          title: 'History',
          tabBarIcon: ({ color, size, focused }) => (
            <HistoryIcon 
              color={color} 
              size={size} 
              filled={focused}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

// タブバッジ数の動的計算
const useTodayBadgeCount = () => {
  const dailyQuests = useQuestStore(state => state.dailyQuests);
  const uncompletedCount = dailyQuests.filter(q => !q.completed).length;
  return uncompletedCount > 0 ? uncompletedCount : undefined;
};
```

### 3.2 各タブのスタックナビゲーター

```typescript
// navigation/TodayNavigator.tsx
export const TodayNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTitleStyle: {
          fontSize: 18,
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="TodayHome"
        component={TodayScreen}
        options={{
          title: 'Today\'s Quests',
          headerRight: () => <ProfileButton />,
        }}
      />
      
      <Stack.Screen
        name="QuestDetail"
        component={QuestDetailScreen}
        options={({ route }) => ({
          title: 'Quest Detail',
          headerBackTitle: 'Back',
        })}
      />
      
      <Stack.Screen
        name="QuestComplete"
        component={QuestCompleteScreen}
        options={{
          title: 'Complete Quest',
          presentation: 'modal',
          gestureEnabled: false,
        }}
      />
      
      <Stack.Screen
        name="MountainView"
        component={MountainViewScreen}
        options={{
          title: 'Your Progress',
          presentation: 'fullScreenModal',
        }}
      />
    </Stack.Navigator>
  );
};
```

## 4. 遷移アニメーション

### 4.1 カスタムアニメーション

```typescript
// utils/navigationAnimations.ts
import type { StackNavigationOptions } from '@react-navigation/stack';

export const slideFromRight: StackNavigationOptions = {
  gestureDirection: 'horizontal',
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 300,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 300,
      },
    },
  },
  cardStyleInterpolator: ({ current, layouts }) => {
    return {
      cardStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.width, 0],
            }),
          },
        ],
      },
    };
  },
};

export const fadeIn: StackNavigationOptions = {
  transitionSpec: {
    open: {
      animation: 'timing',
      config: {
        duration: 250,
      },
    },
    close: {
      animation: 'timing',
      config: {
        duration: 200,
      },
    },
  },
  cardStyleInterpolator: ({ current }) => ({
    cardStyle: {
      opacity: current.progress,
    },
  }),
};

export const modalPresentation: StackNavigationOptions = {
  presentation: 'modal',
  gestureEnabled: true,
  gestureDirection: 'vertical',
  cardStyleInterpolator: ({ current, layouts }) => {
    return {
      cardStyle: {
        transform: [
          {
            translateY: current.progress.interpolate({
              inputRange: [0, 1],
              outputRange: [layouts.screen.height, 0],
            }),
          },
        ],
      },
    };
  },
};
```

### 4.2 条件付きアニメーション

```typescript
// navigation/AnimatedNavigator.tsx
export const AnimatedNavigator = ({ children }: { children: React.ReactNode }) => {
  const { reduceMotion } = useAccessibilitySettings();
  const { isLowPowerMode } = useDeviceSettings();
  
  const shouldAnimate = !reduceMotion && !isLowPowerMode;
  
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        animation: {
          ...DefaultTheme.animation,
          scale: shouldAnimate ? 1 : 0,
        },
      }}
    >
      {children}
    </NavigationContainer>
  );
};
```

## 5. ディープリンク・ユニバーサルリンク

### 5.1 リンク設定

```typescript
// navigation/linking.ts
import { LinkingOptions } from '@react-navigation/native';

export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['climbYou://', 'https://climbYou.app'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          Today: {
            screens: {
              TodayHome: 'today',
              QuestDetail: 'quest/:questId',
              MountainView: 'progress',
            },
          },
          Growth: {
            screens: {
              GrowthHome: 'growth',
              InsightDetail: 'insight/:insightId',
              WeeklyReport: 'report/:weekOf',
            },
          },
          Goals: {
            screens: {
              GoalsHome: 'goals',
              GoalDetail: 'goal/:goalId',
              CreateGoal: 'goals/new',
            },
          },
          History: {
            screens: {
              HistoryHome: 'history',
              MonthView: 'history/:month/:year',
            },
          },
        },
      },
    },
  },
  
  // カスタムリンク処理
  async getInitialURL() {
    // アプリが閉じている状態からの起動
    const url = await Linking.getInitialURL();
    return url;
  },
  
  subscribe(listener) {
    // アプリが開いている状態でのリンク
    const onReceiveURL = ({ url }: { url: string }) => listener(url);
    
    const subscription = Linking.addEventListener('url', onReceiveURL);
    return () => subscription?.remove();
  },
};

// ディープリンクハンドラー
export const useDeepLinkHandler = () => {
  const navigation = useNavigation();
  
  const handleDeepLink = useCallback((url: string) => {
    const route = parseDeepLink(url);
    
    if (route) {
      // 認証チェック
      const isAuthenticated = useUserStore.getState().isAuthenticated;
      
      if (!isAuthenticated && route.requiresAuth) {
        // 認証後にリダイレクトするためのURLを保存
        useNavigationStore.getState().setPendingDeepLink(url);
        navigation.navigate('Auth', { screen: 'Login' });
        return;
      }
      
      // 適切な画面に遷移
      navigation.navigate(route.screen as any, route.params);
    }
  }, [navigation]);
  
  return { handleDeepLink };
};
```

## 6. ナビゲーション状態管理

### 6.1 ナビゲーション状態ストア

```typescript
// stores/navigationStore.ts
interface NavigationState {
  currentRoute: string;
  previousRoute: string | null;
  navigationHistory: string[];
  pendingDeepLink: string | null;
  tabBadges: Record<string, number>;
}

interface NavigationActions {
  setCurrentRoute: (route: string) => void;
  setPendingDeepLink: (url: string | null) => void;
  updateTabBadge: (tab: string, count: number) => void;
  clearNavigationHistory: () => void;
  goBackToRoute: (route: string) => void;
}

export const useNavigationStore = create<NavigationState & NavigationActions>()(
  (set, get) => ({
    currentRoute: 'TodayHome',
    previousRoute: null,
    navigationHistory: [],
    pendingDeepLink: null,
    tabBadges: {},

    setCurrentRoute: (route) => {
      const current = get().currentRoute;
      set({
        previousRoute: current,
        currentRoute: route,
        navigationHistory: [...get().navigationHistory, route].slice(-10), // 最新10件
      });
    },

    setPendingDeepLink: (url) => set({ pendingDeepLink: url }),
    
    updateTabBadge: (tab, count) => {
      set(state => ({
        tabBadges: {
          ...state.tabBadges,
          [tab]: count,
        },
      }));
    },

    clearNavigationHistory: () => set({ navigationHistory: [] }),
  })
);
```

### 6.2 ナビゲーション監視

```typescript
// hooks/useNavigationTracking.ts
export const useNavigationTracking = () => {
  const setCurrentRoute = useNavigationStore(state => state.setCurrentRoute);
  
  const navigationRef = useNavigationContainerRef();
  
  const onNavigationStateChange = useCallback((state: any) => {
    if (state) {
      const currentRoute = getCurrentRoute(state);
      setCurrentRoute(currentRoute);
      
      // 分析イベント送信
      trackScreenView(currentRoute);
      
      // パフォーマンス監視
      measureNavigationTime(currentRoute);
    }
  }, [setCurrentRoute]);
  
  return {
    navigationRef,
    onNavigationStateChange,
  };
};

// ナビゲーション パフォーマンス監視
const measureNavigationTime = (routeName: string) => {
  const startTime = Date.now();
  
  // 画面描画完了を待つ
  requestAnimationFrame(() => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Navigation to ${routeName}: ${duration}ms`);
    
    // 遅い遷移を警告
    if (duration > 500) {
      console.warn(`Slow navigation detected: ${routeName} took ${duration}ms`);
    }
  });
};
```

## 7. アクセシビリティ対応

### 7.1 ナビゲーション アクセシビリティ

```typescript
// components/navigation/AccessibleTabBar.tsx
export const AccessibleTabBar = () => {
  const { announceForAccessibility } = useAccessibilityAnnouncements();
  
  const onTabPress = useCallback((tabName: string) => {
    announceForAccessibility(`${tabName} tab selected`);
  }, [announceForAccessibility]);
  
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarAccessibilityRole: 'tablist',
        tabBarItemStyle: {
          accessibilityRole: 'tab',
        },
      }}
    >
      {/* タブ実装 */}
    </Tab.Navigator>
  );
};

// スクリーンリーダー対応
export const useScreenReaderNavigation = () => {
  const navigation = useNavigation();
  const { isScreenReaderEnabled } = useAccessibilityInfo();
  
  const navigateWithAnnouncement = useCallback((
    screenName: string,
    params?: any
  ) => {
    navigation.navigate(screenName, params);
    
    if (isScreenReaderEnabled) {
      // 画面遷移を音声で通知
      setTimeout(() => {
        AccessibilityInfo.announceForAccessibility(
          `Navigated to ${screenName} screen`
        );
      }, 500);
    }
  }, [navigation, isScreenReaderEnabled]);
  
  return { navigateWithAnnouncement };
};
```

### 7.2 フォーカス管理

```typescript
// hooks/useFocusManagement.ts
export const useFocusManagement = () => {
  const [focusedElement, setFocusedElement] = useState<string | null>(null);
  
  const manageFocusOnNavigation = useCallback((routeName: string) => {
    // 画面遷移後のフォーカス管理
    switch (routeName) {
      case 'QuestDetail':
        // クエスト詳細画面ではタイトルにフォーカス
        setFocusedElement('quest-title');
        break;
      case 'TodayHome':
        // ホーム画面では最初のクエストにフォーカス
        setFocusedElement('first-quest');
        break;
      default:
        setFocusedElement('screen-header');
    }
  }, []);
  
  return {
    focusedElement,
    manageFocusOnNavigation,
  };
};
```
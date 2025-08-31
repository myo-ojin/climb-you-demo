# エラーハンドリング・ポリシー

## 1. エラー分類体系

### 1.1 エラーカテゴリ

```typescript
// types/errors.ts
export enum ErrorCategory {
  // ネットワーク関連
  NETWORK = 'network',
  
  // API関連
  API_SERVER = 'api_server',
  API_CLIENT = 'api_client',
  
  // AI サービス関連
  AI_SERVICE = 'ai_service',
  AI_QUOTA = 'ai_quota',
  
  // 認証・認可
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  
  // データ検証
  VALIDATION = 'validation',
  
  // ストレージ
  STORAGE_LOCAL = 'storage_local',
  STORAGE_REMOTE = 'storage_remote',
  
  // UI・UX
  UI_RENDERING = 'ui_rendering',
  USER_INPUT = 'user_input',
  
  // システム
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',        // ユーザー体験に軽微な影響
  MEDIUM = 'medium',  // 機能の一部が利用不可
  HIGH = 'high',      // 重要機能が利用不可
  CRITICAL = 'critical' // アプリが使用不可
}

export interface AppError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;    // ユーザー向けメッセージ
  code?: string;
  details?: any;
  timestamp: Date;
  retryable: boolean;
  retryCount?: number;
  maxRetries?: number;
  context?: ErrorContext;
}

export interface ErrorContext {
  userId?: string;
  screenName?: string;
  actionName?: string;
  additionalData?: Record<string, any>;
}
```

### 1.2 エラー処理方針

| カテゴリ | 処理方針 | ユーザー体験 | 自動復旧 |
|----------|----------|--------------|----------|
| Network | 自動リトライ + オフライン対応 | 「オフラインモード」表示 | ○ |
| AI Service | フォールバック + 代替案提供 | 「標準クエスト」提供 | ○ |
| Authentication | 自動再認証 + ログイン画面 | シームレス or ログイン促進 | △ |
| Validation | 入力修正案提示 | エラー箇所ハイライト | × |
| Storage | データ同期 + 警告表示 | 「データ保存中...」 | ○ |

## 2. エラーハンドリング実装

### 2.1 中央エラーハンドラー

```typescript
// services/error/errorHandler.ts
class ErrorHandler {
  private static instance: ErrorHandler;
  private errorQueue: AppError[] = [];
  private reportingService: ErrorReportingService;

  constructor() {
    this.reportingService = new ErrorReportingService();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // メインエラーハンドリングメソッド
  async handleError(error: any, context?: ErrorContext): Promise<AppError> {
    const appError = this.normalizeError(error, context);
    
    // エラーログ
    this.logError(appError);
    
    // エラー報告（重要度に応じて）
    if (appError.severity === ErrorSeverity.HIGH || 
        appError.severity === ErrorSeverity.CRITICAL) {
      await this.reportingService.reportError(appError);
    }
    
    // ユーザー通知
    this.notifyUser(appError);
    
    // 自動復旧試行
    if (appError.retryable && (appError.retryCount ?? 0) < (appError.maxRetries ?? 3)) {
      await this.attemptRecovery(appError);
    }
    
    // エラーキューに追加
    this.errorQueue.push(appError);
    
    return appError;
  }

  private normalizeError(error: any, context?: ErrorContext): AppError {
    const id = generateUUID();
    const timestamp = new Date();
    
    // ネットワークエラー
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      return {
        id,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        message: error.message || 'Network connection failed',
        userMessage: 'インターネット接続を確認してください',
        timestamp,
        retryable: true,
        maxRetries: 3,
        context
      };
    }
    
    // HTTPエラー
    if (error.response) {
      return this.handleHTTPError(error.response, id, timestamp, context);
    }
    
    // OpenAI APIエラー
    if (error.type === 'openai_error') {
      return this.handleOpenAIError(error, id, timestamp, context);
    }
    
    // バリデーションエラー（Zod）
    if (error instanceof ZodError) {
      return {
        id,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        message: 'Validation failed',
        userMessage: '入力内容を確認してください',
        details: error.errors,
        timestamp,
        retryable: false,
        context
      };
    }
    
    // その他のエラー
    return {
      id,
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: error.message || 'Unknown error occurred',
      userMessage: '予期しないエラーが発生しました',
      timestamp,
      retryable: false,
      context
    };
  }

  private handleHTTPError(response: any, id: string, timestamp: Date, context?: ErrorContext): AppError {
    const status = response.status;
    
    switch (status) {
      case 400:
        return {
          id,
          category: ErrorCategory.API_CLIENT,
          severity: ErrorSeverity.LOW,
          message: 'Bad request',
          userMessage: '入力内容に問題があります',
          code: 'BAD_REQUEST',
          timestamp,
          retryable: false,
          context
        };
        
      case 401:
        return {
          id,
          category: ErrorCategory.AUTHENTICATION,
          severity: ErrorSeverity.HIGH,
          message: 'Authentication failed',
          userMessage: '再度ログインしてください',
          code: 'UNAUTHORIZED',
          timestamp,
          retryable: true,
          maxRetries: 1,
          context
        };
        
      case 403:
        return {
          id,
          category: ErrorCategory.AUTHORIZATION,
          severity: ErrorSeverity.HIGH,
          message: 'Access forbidden',
          userMessage: 'この操作は許可されていません',
          code: 'FORBIDDEN',
          timestamp,
          retryable: false,
          context
        };
        
      case 429:
        return {
          id,
          category: ErrorCategory.API_SERVER,
          severity: ErrorSeverity.MEDIUM,
          message: 'Rate limit exceeded',
          userMessage: 'しばらく時間をおいてから再度お試しください',
          code: 'RATE_LIMIT',
          timestamp,
          retryable: true,
          maxRetries: 2,
          context
        };
        
      case 500:
      case 502:
      case 503:
        return {
          id,
          category: ErrorCategory.API_SERVER,
          severity: ErrorSeverity.HIGH,
          message: 'Server error',
          userMessage: 'サーバーで問題が発生しています。しばらくお待ちください',
          code: `SERVER_ERROR_${status}`,
          timestamp,
          retryable: true,
          maxRetries: 3,
          context
        };
        
      default:
        return {
          id,
          category: ErrorCategory.API_SERVER,
          severity: ErrorSeverity.MEDIUM,
          message: `HTTP ${status}`,
          userMessage: '通信エラーが発生しました',
          code: `HTTP_${status}`,
          timestamp,
          retryable: status >= 500,
          context
        };
    }
  }

  private handleOpenAIError(error: any, id: string, timestamp: Date, context?: ErrorContext): AppError {
    if (error.code === 'quota_exceeded') {
      return {
        id,
        category: ErrorCategory.AI_QUOTA,
        severity: ErrorSeverity.HIGH,
        message: 'AI service quota exceeded',
        userMessage: 'AI機能が一時的に利用できません。標準クエストを提供します',
        code: 'AI_QUOTA_EXCEEDED',
        timestamp,
        retryable: false,
        context
      };
    }
    
    return {
      id,
      category: ErrorCategory.AI_SERVICE,
      severity: ErrorSeverity.MEDIUM,
      message: error.message || 'AI service error',
      userMessage: 'AI分析に問題が発生しました。基本機能をご利用ください',
      code: error.code,
      timestamp,
      retryable: true,
      maxRetries: 2,
      context
    };
  }

  private notifyUser(error: AppError): void {
    // 重要度に応じて通知方法を変更
    switch (error.severity) {
      case ErrorSeverity.LOW:
        // トースト通知
        useNotificationStore.getState().addNotification({
          id: error.id,
          type: 'warning',
          title: 'Warning',
          message: error.userMessage,
          createdAt: error.timestamp,
        });
        break;
        
      case ErrorSeverity.MEDIUM:
        // モーダル通知
        useUIStore.getState().showErrorModal({
          title: 'Error',
          message: error.userMessage,
          actions: error.retryable ? ['retry', 'cancel'] : ['ok'],
        });
        break;
        
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        // 全画面エラー
        useUIStore.getState().showErrorScreen({
          title: 'Something went wrong',
          message: error.userMessage,
          canRetry: error.retryable,
        });
        break;
    }
  }

  private async attemptRecovery(error: AppError): Promise<void> {
    switch (error.category) {
      case ErrorCategory.NETWORK:
        await this.recoverNetworkError(error);
        break;
        
      case ErrorCategory.AUTHENTICATION:
        await this.recoverAuthError(error);
        break;
        
      case ErrorCategory.AI_SERVICE:
        await this.recoverAIError(error);
        break;
    }
  }

  private async recoverNetworkError(error: AppError): Promise<void> {
    // ネットワーク復旧を待つ
    const isConnected = await NetInfo.fetch().then(state => state.isConnected);
    
    if (isConnected) {
      // 元の操作を再試行
      if (error.context?.actionName) {
        await this.retryAction(error.context);
      }
    } else {
      // オフラインモードに切り替え
      useUIStore.getState().enableOfflineMode();
    }
  }

  private async recoverAuthError(error: AppError): Promise<void> {
    // トークンリフレッシュを試行
    try {
      await authService.refreshToken();
    } catch (refreshError) {
      // リフレッシュ失敗時はログイン画面に遷移
      NavigationService.reset('Auth');
    }
  }

  private async recoverAIError(error: AppError): Promise<void> {
    // フォールバック機能を有効化
    useAIStore.getState().enableFallbackMode();
    
    // 標準クエストを生成
    const fallbackQuests = await questService.generateFallbackQuests();
    useQuestStore.getState().setDailyQuests(fallbackQuests);
  }

  private logError(error: AppError): void {
    console.error('🚨 Application Error:', {
      id: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      timestamp: error.timestamp,
      context: error.context,
    });
  }

  // エラー統計取得
  getErrorStats(): ErrorStats {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = this.errorQueue.filter(e => e.timestamp > last24Hours);
    
    return {
      total: recentErrors.length,
      byCategory: this.groupErrorsByCategory(recentErrors),
      bySeverity: this.groupErrorsBySeverity(recentErrors),
      topErrors: this.getTopErrors(recentErrors),
    };
  }

  // エラーキューをクリア
  clearErrorQueue(): void {
    this.errorQueue = [];
  }
}

export const errorHandler = ErrorHandler.getInstance();
```

### 2.2 React Error Boundary

```typescript
// components/ErrorBoundary.tsx
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level: 'app' | 'screen' | 'component';
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateUUID(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // エラーハンドラーに報告
    errorHandler.handleError(error, {
      screenName: this.getCurrentScreenName(),
      actionName: 'component_render',
      additionalData: {
        level: this.props.level,
        componentStack: errorInfo.componentStack,
        retryCount: this.retryCount,
      },
    });
    
    // カスタムエラーハンドラー実行
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private getCurrentScreenName(): string {
    // ナビゲーション状態から現在の画面名を取得
    return useNavigationStore.getState().currentRoute;
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: null,
      });
    } else {
      // 最大リトライ回数に達した場合はアプリを再起動
      this.handleRestart();
    }
  };

  private handleRestart = () => {
    // アプリの状態をリセットして再起動
    useUserStore.getState().reset();
    useQuestStore.getState().reset();
    useAIStore.getState().reset();
    
    // ルートレベルの場合はアプリ再読み込み
    if (this.props.level === 'app') {
      Updates.reloadAsync();
    } else {
      // 画面レベルの場合はホーム画面に戻る
      NavigationService.reset('Main');
    }
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <FallbackComponent
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onRestart={this.handleRestart}
          retryCount={this.retryCount}
          maxRetries={this.maxRetries}
          level={this.props.level}
        />
      );
    }

    return this.props.children;
  }
}

// レベル別エラーバウンダリー
export const AppErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary level="app" fallback={CriticalErrorFallback}>
    {children}
  </ErrorBoundary>
);

export const ScreenErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary level="screen" fallback={ScreenErrorFallback}>
    {children}
  </ErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ErrorBoundary level="component" fallback={ComponentErrorFallback}>
    {children}
  </ErrorBoundary>
);
```

### 2.3 エラーフォールバックUI

```typescript
// components/error/ErrorFallbacks.tsx

// クリティカルエラー（アプリ全体）
export const CriticalErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  onRestart,
  retryCount,
  maxRetries
}) => {
  return (
    <View className="flex-1 bg-red-50 justify-center items-center p-6">
      <View className="bg-white rounded-lg p-6 shadow-lg max-w-sm">
        <View className="items-center mb-4">
          <ErrorIcon size={48} color="#ef4444" />
          <Text className="text-xl font-bold text-gray-900 mt-2">
            Something went wrong
          </Text>
        </View>
        
        <Text className="text-gray-600 text-center mb-6">
          The app encountered a critical error and needs to restart.
        </Text>
        
        {__DEV__ && (
          <ScrollView className="max-h-32 mb-4">
            <Text className="text-xs text-red-600 font-mono">
              {error?.message}
            </Text>
          </ScrollView>
        )}
        
        <View className="space-y-3">
          {retryCount < maxRetries && (
            <Button
              variant="primary"
              size="md"
              onPress={onRetry}
              className="w-full"
            >
              Try Again ({maxRetries - retryCount} attempts left)
            </Button>
          )}
          
          <Button
            variant="secondary"
            size="md"
            onPress={onRestart}
            className="w-full"
          >
            Restart App
          </Button>
        </View>
      </View>
    </View>
  );
};

// 画面レベルエラー
export const ScreenErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  retryCount,
  maxRetries
}) => {
  const navigation = useNavigation();
  
  return (
    <View className="flex-1 bg-gray-50 justify-center items-center p-6">
      <View className="bg-white rounded-lg p-6 shadow-sm max-w-sm">
        <View className="items-center mb-4">
          <WarningIcon size={32} color="#f59e0b" />
          <Text className="text-lg font-semibold text-gray-900 mt-2">
            Page Error
          </Text>
        </View>
        
        <Text className="text-gray-600 text-center mb-6">
          This page couldn't load properly.
        </Text>
        
        <View className="space-y-3">
          {retryCount < maxRetries && (
            <Button
              variant="primary"
              size="sm"
              onPress={onRetry}
              className="w-full"
            >
              Retry
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="sm"
            onPress={() => navigation.goBack()}
            className="w-full"
          >
            Go Back
          </Button>
        </View>
      </View>
    </View>
  );
};

// コンポーネントレベルエラー
export const ComponentErrorFallback: React.FC<ErrorFallbackProps> = ({
  onRetry,
  retryCount,
  maxRetries
}) => {
  return (
    <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-2">
      <View className="flex-row items-center">
        <AlertIcon size={16} color="#f59e0b" />
        <Text className="text-sm text-yellow-800 ml-2 flex-1">
          This component failed to load
        </Text>
        
        {retryCount < maxRetries && (
          <TouchableOpacity onPress={onRetry} className="ml-2">
            <RefreshIcon size={16} color="#f59e0b" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};
```

## 3. フォールト トレラント設計

### 3.1 サーキットブレーカー

```typescript
// services/resilience/circuitBreaker.ts
enum CircuitState {
  CLOSED = 'closed',     // 正常状態
  OPEN = 'open',         // 故障状態
  HALF_OPEN = 'half_open' // テスト状態
}

class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private successCount = 0;

  constructor(
    private threshold: number = 5,      // 故障閾値
    private timeout: number = 60000,    // リセットタイムアウト（ms）
    private monitor: number = 3         // テスト時の成功必要回数
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.monitor) {
        this.state = CircuitState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.lastFailureTime && 
           (Date.now() - this.lastFailureTime.getTime()) >= this.timeout;
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// 使用例
export const aiServiceBreaker = new CircuitBreaker(3, 30000, 2);
export const questServiceBreaker = new CircuitBreaker(5, 60000, 3);
```

### 3.2 リトライメカニズム

```typescript
// utils/retry.ts
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  jitter: true,
};

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // リトライ条件をチェック
      if (finalConfig.retryCondition && !finalConfig.retryCondition(error)) {
        throw error;
      }
      
      // 最後の試行の場合は例外をスロー
      if (attempt === finalConfig.maxAttempts) {
        throw error;
      }
      
      // 指数バックオフで待機
      const delay = calculateDelay(attempt, finalConfig);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function calculateDelay(attempt: number, config: RetryConfig): number {
  const baseDelay = Math.min(
    config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
    config.maxDelay
  );
  
  if (config.jitter) {
    // ジッターを追加（雷群効果を防ぐ）
    return baseDelay + Math.random() * baseDelay * 0.1;
  }
  
  return baseDelay;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 特定のエラーコードでリトライ
export const retryableErrors = ['NETWORK_ERROR', 'TIMEOUT', 'SERVER_ERROR'];

export const isRetryableError = (error: any): boolean => {
  if (error.code && retryableErrors.includes(error.code)) {
    return true;
  }
  
  if (error.response?.status >= 500) {
    return true;
  }
  
  return false;
};
```

### 3.3 タイムアウト管理

```typescript
// utils/timeout.ts
export class TimeoutManager {
  private static timeouts = new Map<string, NodeJS.Timeout>();

  static withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage = 'Operation timed out'
  ): Promise<T> {
    const timeoutId = generateUUID();
    
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => {
        const timeout = setTimeout(() => {
          this.timeouts.delete(timeoutId);
          reject(new Error(timeoutMessage));
        }, timeoutMs);
        
        this.timeouts.set(timeoutId, timeout);
      })
    ]).finally(() => {
      const timeout = this.timeouts.get(timeoutId);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(timeoutId);
      }
    });
  }

  static clearAll(): void {
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}

// 使用例
export const timeoutConfig = {
  ai_generation: 30000,    // 30秒
  api_request: 10000,      // 10秒
  auth_token: 5000,        // 5秒
  file_upload: 60000,      // 60秒
};
```

## 4. 監視・アラート

### 4.1 エラー監視サービス

```typescript
// services/monitoring/errorReporting.ts
class ErrorReportingService {
  private errorBuffer: AppError[] = [];
  private isReporting = false;
  
  async reportError(error: AppError): Promise<void> {
    // バッファに追加
    this.errorBuffer.push(error);
    
    // バッチ処理で送信
    if (!this.isReporting) {
      this.isReporting = true;
      setTimeout(() => this.flushErrors(), 1000);
    }
  }
  
  private async flushErrors(): Promise<void> {
    if (this.errorBuffer.length === 0) {
      this.isReporting = false;
      return;
    }
    
    const errorsToSend = [...this.errorBuffer];
    this.errorBuffer = [];
    
    try {
      await this.sendErrorBatch(errorsToSend);
    } catch (reportingError) {
      console.error('Failed to report errors:', reportingError);
      // 送信失敗時はバッファに戻す
      this.errorBuffer.unshift(...errorsToSend);
    } finally {
      this.isReporting = false;
      
      // まだエラーがある場合は再実行
      if (this.errorBuffer.length > 0) {
        setTimeout(() => this.flushErrors(), 5000);
      }
    }
  }
  
  private async sendErrorBatch(errors: AppError[]): Promise<void> {
    const payload = {
      timestamp: new Date().toISOString(),
      appVersion: Constants.expoConfig?.version,
      platform: Platform.OS,
      errors: errors.map(this.sanitizeError),
    };
    
    await fetch('/api/errors/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }
  
  private sanitizeError(error: AppError): any {
    return {
      id: error.id,
      category: error.category,
      severity: error.severity,
      message: error.message,
      code: error.code,
      timestamp: error.timestamp,
      context: {
        ...error.context,
        // 個人情報を除去
        userId: error.context?.userId ? 'redacted' : undefined,
      },
    };
  }
}

export const errorReporting = new ErrorReportingService();
```

### 4.2 パフォーマンス監視

```typescript
// hooks/useErrorMonitoring.ts
export const useErrorMonitoring = () => {
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = errorHandler.getErrorStats();
      setErrorStats(stats);
      
      // エラー率が閾値を超えた場合にアラート
      if (stats.total > 10) { // 24時間で10件以上
        console.warn('High error rate detected:', stats);
        
        // 必要に応じてユーザーに通知
        if (stats.bySeverity.critical > 0) {
          useNotificationStore.getState().addNotification({
            id: generateUUID(),
            type: 'error',
            title: 'System Alert',
            message: 'Multiple errors detected. App performance may be affected.',
            createdAt: new Date(),
          });
        }
      }
    }, 60000); // 1分ごと
    
    return () => clearInterval(interval);
  }, []);
  
  return errorStats;
};
```

## 5. 開発・テスト支援

### 5.1 エラーシミュレーション

```typescript
// utils/errorSimulation.ts
class ErrorSimulator {
  private isEnabled = __DEV__;
  
  // ネットワークエラーをシミュレート
  simulateNetworkError(): void {
    if (!this.isEnabled) return;
    
    throw new Error('Simulated network error');
  }
  
  // AI サービスエラーをシミュレート
  simulateAIError(type: 'quota' | 'timeout' | 'invalid'): void {
    if (!this.isEnabled) return;
    
    switch (type) {
      case 'quota':
        throw { type: 'openai_error', code: 'quota_exceeded' };
      case 'timeout':
        throw { type: 'openai_error', code: 'timeout' };
      case 'invalid':
        throw { type: 'openai_error', code: 'invalid_response' };
    }
  }
  
  // レンダリングエラーをシミュレート
  simulateRenderError(): void {
    if (!this.isEnabled) return;
    
    throw new Error('Simulated render error');
  }
  
  enable(): void {
    this.isEnabled = true;
  }
  
  disable(): void {
    this.isEnabled = false;
  }
}

export const errorSimulator = new ErrorSimulator();

// デバッグ用フック
export const useErrorSimulation = () => {
  return {
    simulateNetworkError: errorSimulator.simulateNetworkError.bind(errorSimulator),
    simulateAIError: errorSimulator.simulateAIError.bind(errorSimulator),
    simulateRenderError: errorSimulator.simulateRenderError.bind(errorSimulator),
  };
};
```

### 5.2 エラーテスト

```typescript
// __tests__/errorHandling.test.ts
describe('Error Handling', () => {
  beforeEach(() => {
    errorHandler.clearErrorQueue();
    jest.clearAllMocks();
  });
  
  describe('Network Errors', () => {
    it('should handle network timeout', async () => {
      const networkError = new Error('Network timeout');
      networkError.code = 'NETWORK_ERROR';
      
      const result = await errorHandler.handleError(networkError);
      
      expect(result.category).toBe(ErrorCategory.NETWORK);
      expect(result.retryable).toBe(true);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });
    
    it('should attempt retry for network errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, {
        maxAttempts: 2,
        baseDelay: 100,
        retryCondition: isRetryableError,
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('AI Service Errors', () => {
    it('should handle quota exceeded error', async () => {
      const aiError = {
        type: 'openai_error',
        code: 'quota_exceeded',
        message: 'Quota exceeded'
      };
      
      const result = await errorHandler.handleError(aiError);
      
      expect(result.category).toBe(ErrorCategory.AI_QUOTA);
      expect(result.retryable).toBe(false);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });
  });
  
  describe('Circuit Breaker', () => {
    it('should open circuit after threshold failures', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Service unavailable'));
      const breaker = new CircuitBreaker(2, 1000, 1);
      
      // 2回失敗させる
      await expect(breaker.execute(failingOperation)).rejects.toThrow();
      await expect(breaker.execute(failingOperation)).rejects.toThrow();
      
      expect(breaker.getState()).toBe('open');
      
      // 回路が開いている間は即座に失敗
      await expect(breaker.execute(failingOperation)).rejects.toThrow('Circuit breaker is OPEN');
    });
  });
});
```
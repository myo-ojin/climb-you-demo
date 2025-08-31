# 環境設定・シークレット管理

## 1. 環境構成

### 1.1 開発環境の分離

```
環境構成
├── Development（開発環境）
│   ├── Local Development（ローカル開発）
│   ├── Development Server（開発サーバー）
│   └── Feature Branch Testing
├── Staging（ステージング環境）
│   ├── Integration Testing
│   ├── QA Testing
│   └── Pre-production Validation
└── Production（本番環境）
    ├── Production API
    ├── Production Database
    └── Production Analytics
```

### 1.2 環境別設定

```typescript
// config/environments.ts
export interface Environment {
  name: 'development' | 'staging' | 'production';
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };
  openai: {
    model: string;
    maxTokens: number;
    temperature: number;
  };
  firebase: {
    projectId: string;
    region: string;
  };
  features: {
    aiAnalytics: boolean;
    offlineMode: boolean;
    debugMode: boolean;
    analyticsCollection: boolean;
  };
  performance: {
    enableProfiling: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    maxCacheSize: number;
  };
}

// 開発環境設定
const developmentConfig: Environment = {
  name: 'development',
  api: {
    baseUrl: 'https://dev-api.climbYou.app',
    timeout: 30000,
    retries: 3,
  },
  openai: {
    model: 'gpt-4o-mini', // 開発時は軽量モデル
    maxTokens: 500,
    temperature: 0.8,
  },
  firebase: {
    projectId: 'climb-you-dev',
    region: 'asia-northeast1',
  },
  features: {
    aiAnalytics: true,
    offlineMode: true,
    debugMode: true,
    analyticsCollection: false, // 開発時は分析データ収集無効
  },
  performance: {
    enableProfiling: true,
    logLevel: 'debug',
    maxCacheSize: 50 * 1024 * 1024, // 50MB
  },
};

// ステージング環境設定
const stagingConfig: Environment = {
  name: 'staging',
  api: {
    baseUrl: 'https://staging-api.climbYou.app',
    timeout: 15000,
    retries: 2,
  },
  openai: {
    model: 'gpt-4o',
    maxTokens: 800,
    temperature: 0.7,
  },
  firebase: {
    projectId: 'climb-you-staging',
    region: 'asia-northeast1',
  },
  features: {
    aiAnalytics: true,
    offlineMode: true,
    debugMode: false,
    analyticsCollection: true,
  },
  performance: {
    enableProfiling: false,
    logLevel: 'info',
    maxCacheSize: 30 * 1024 * 1024, // 30MB
  },
};

// 本番環境設定
const productionConfig: Environment = {
  name: 'production',
  api: {
    baseUrl: 'https://api.climbYou.app',
    timeout: 10000,
    retries: 1,
  },
  openai: {
    model: 'gpt-4o',
    maxTokens: 1000,
    temperature: 0.7,
  },
  firebase: {
    projectId: 'climb-you-prod',
    region: 'asia-northeast1',
  },
  features: {
    aiAnalytics: true,
    offlineMode: true,
    debugMode: false,
    analyticsCollection: true,
  },
  performance: {
    enableProfiling: false,
    logLevel: 'error',
    maxCacheSize: 20 * 1024 * 1024, // 20MB
  },
};

// 環境判定・設定取得
class EnvironmentManager {
  private currentEnv: Environment;
  
  constructor() {
    this.currentEnv = this.determineEnvironment();
  }
  
  private determineEnvironment(): Environment {
    // Expo の環境変数から判定
    const releaseChannel = Constants.expoConfig?.extra?.releaseChannel;
    const buildProfile = Constants.expoConfig?.extra?.buildProfile;
    
    if (__DEV__ || buildProfile === 'development') {
      return developmentConfig;
    }
    
    if (releaseChannel === 'staging' || buildProfile === 'staging') {
      return stagingConfig;
    }
    
    return productionConfig;
  }
  
  get config(): Environment {
    return this.currentEnv;
  }
  
  isDevelopment(): boolean {
    return this.currentEnv.name === 'development';
  }
  
  isStaging(): boolean {
    return this.currentEnv.name === 'staging';
  }
  
  isProduction(): boolean {
    return this.currentEnv.name === 'production';
  }
  
  // 機能フラグの確認
  isFeatureEnabled(feature: keyof Environment['features']): boolean {
    return this.currentEnv.features[feature];
  }
  
  // API設定取得
  getApiConfig() {
    return this.currentEnv.api;
  }
  
  // OpenAI設定取得
  getOpenAIConfig() {
    return this.currentEnv.openai;
  }
}

export const envManager = new EnvironmentManager();
```

## 2. シークレット管理

### 2.1 Expo SecureStore活用

```typescript
// services/secrets/secretManager.ts
import * as SecureStore from 'expo-secure-store';
import { envManager } from '../config/environments';

interface SecretConfig {
  key: string;
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
}

class SecretManager {
  private readonly secrets: Record<string, SecretConfig> = {
    OPENAI_API_KEY: {
      key: 'openai_api_key',
      requireAuthentication: true,
      authenticationPrompt: 'OpenAI APIキーにアクセスするため認証してください',
    },
    FIREBASE_API_KEY: {
      key: 'firebase_api_key',
      requireAuthentication: false,
    },
    USER_ENCRYPTION_KEY: {
      key: 'user_encryption_key',
      requireAuthentication: true,
      authenticationPrompt: 'ユーザーデータ暗号化キーにアクセスするため認証してください',
    },
    ANALYTICS_TOKEN: {
      key: 'analytics_token',
      requireAuthentication: false,
    },
  };

  // シークレットの安全な保存
  async setSecret(secretName: keyof typeof this.secrets, value: string): Promise<void> {
    const config = this.secrets[secretName];
    if (!config) {
      throw new Error(`Unknown secret: ${secretName}`);
    }

    const options: SecureStore.SecureStoreOptions = {};
    
    if (config.requireAuthentication) {
      options.requireAuthentication = true;
      options.authenticationPrompt = config.authenticationPrompt || 'セキュアストレージにアクセスするため認証してください';
    }

    // 暗号化してから保存
    const encryptedValue = await this.encryptSecret(value);
    await SecureStore.setItemAsync(config.key, encryptedValue, options);
  }

  // シークレットの安全な取得
  async getSecret(secretName: keyof typeof this.secrets): Promise<string | null> {
    const config = this.secrets[secretName];
    if (!config) {
      throw new Error(`Unknown secret: ${secretName}`);
    }

    try {
      const encryptedValue = await SecureStore.getItemAsync(config.key);
      if (!encryptedValue) {
        return null;
      }

      // 復号化して返す
      return await this.decryptSecret(encryptedValue);
    } catch (error) {
      console.error(`Failed to retrieve secret ${secretName}:`, error);
      return null;
    }
  }

  // シークレットの削除
  async deleteSecret(secretName: keyof typeof this.secrets): Promise<void> {
    const config = this.secrets[secretName];
    if (!config) {
      throw new Error(`Unknown secret: ${secretName}`);
    }

    await SecureStore.deleteItemAsync(config.key);
  }

  // すべてのシークレットを削除（アプリ削除時など）
  async deleteAllSecrets(): Promise<void> {
    const deletePromises = Object.values(this.secrets).map(config => 
      SecureStore.deleteItemAsync(config.key).catch(() => {})
    );
    
    await Promise.all(deletePromises);
  }

  // 初期セットアップ時のシークレット配置
  async initializeSecrets(): Promise<void> {
    try {
      // 開発環境でのみ、環境変数からシークレットを読み込み
      if (envManager.isDevelopment()) {
        await this.loadSecretsFromEnv();
      } else {
        // 本番・ステージング環境では手動設定が必要
        await this.validateRequiredSecrets();
      }
    } catch (error) {
      console.error('Failed to initialize secrets:', error);
      throw error;
    }
  }

  private async loadSecretsFromEnv(): Promise<void> {
    const envSecrets = {
      OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      FIREBASE_API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    };

    for (const [key, value] of Object.entries(envSecrets)) {
      if (value) {
        await this.setSecret(key as keyof typeof this.secrets, value);
      }
    }
  }

  private async validateRequiredSecrets(): Promise<void> {
    const requiredSecrets = ['OPENAI_API_KEY', 'FIREBASE_API_KEY'] as const;
    
    for (const secretName of requiredSecrets) {
      const value = await this.getSecret(secretName);
      if (!value) {
        throw new Error(`Required secret ${secretName} is not configured`);
      }
    }
  }

  // シークレットの暗号化
  private async encryptSecret(value: string): Promise<string> {
    // 実装では適切な暗号化ライブラリを使用
    // 例：expo-crypto + AES暗号化
    return btoa(value); // 簡易実装（実際はAES等を使用）
  }

  // シークレットの復号化
  private async decryptSecret(encryptedValue: string): Promise<string> {
    // 実装では適切な復号化ライブラリを使用
    return atob(encryptedValue); // 簡易実装（実際はAES等を使用）
  }

  // シークレット管理状況の確認
  async getSecretsStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const secretName of Object.keys(this.secrets)) {
      try {
        const value = await this.getSecret(secretName as keyof typeof this.secrets);
        status[secretName] = !!value;
      } catch {
        status[secretName] = false;
      }
    }
    
    return status;
  }
}

export const secretManager = new SecretManager();
```

### 2.2 環境変数の管理

```typescript
// app.config.js
import 'dotenv/config';

const IS_DEV = process.env.NODE_ENV === 'development';
const IS_STAGING = process.env.BUILD_PROFILE === 'staging';
const IS_PRODUCTION = process.env.BUILD_PROFILE === 'production';

export default ({
  config,
}: {
  config?: {
    name?: string;
    slug?: string;
  };
}) => {
  // 環境別の基本設定
  const baseConfig = {
    name: IS_PRODUCTION ? 'Climb You' : 
          IS_STAGING ? 'Climb You (Staging)' : 
          'Climb You (Dev)',
    
    slug: 'climb-you',
    
    version: '1.0.0',
    
    orientation: 'portrait',
    
    icon: IS_PRODUCTION ? './assets/icon.png' : 
          IS_STAGING ? './assets/icon-staging.png' : 
          './assets/icon-dev.png',
    
    userInterfaceStyle: 'automatic',
    
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    
    ios: {
      supportsTablet: true,
      bundleIdentifier: IS_PRODUCTION ? 'com.climbYou.app' : 
                       IS_STAGING ? 'com.climbYou.staging' : 
                       'com.climbYou.dev',
    },
    
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF',
      },
      package: IS_PRODUCTION ? 'com.climbYou.app' : 
              IS_STAGING ? 'com.climbYou.staging' : 
              'com.climbYou.dev',
    },
    
    web: {
      favicon: './assets/favicon.png',
    },
    
    // 環境固有の設定
    extra: {
      buildProfile: process.env.BUILD_PROFILE || 'development',
      releaseChannel: process.env.RELEASE_CHANNEL,
      
      // 開発時のみ環境変数を公開
      ...(IS_DEV && {
        openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
        firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      }),
    },
    
    // EAS Build設定
    updates: {
      fallbackToCacheTimeout: 0,
      url: IS_PRODUCTION ? 'https://u.expo.dev/your-production-project-id' :
           IS_STAGING ? 'https://u.expo.dev/your-staging-project-id' :
           undefined,
    },
  };
  
  return baseConfig;
};
```

### 2.3 Firebase設定管理

```typescript
// config/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { envManager } from './environments';
import { secretManager } from '../services/secrets/secretManager';

// 環境別Firebase設定
const firebaseConfigs = {
  development: {
    apiKey: '', // SecureStoreから動的に取得
    authDomain: 'climb-you-dev.firebaseapp.com',
    projectId: 'climb-you-dev',
    storageBucket: 'climb-you-dev.appspot.com',
    messagingSenderId: '123456789',
    appId: '1:123456789:web:abcdef123456',
    measurementId: 'G-XXXXXXXXXX',
  },
  staging: {
    apiKey: '', // SecureStoreから動的に取得
    authDomain: 'climb-you-staging.firebaseapp.com',
    projectId: 'climb-you-staging',
    storageBucket: 'climb-you-staging.appspot.com',
    messagingSenderId: '987654321',
    appId: '1:987654321:web:fedcba654321',
    measurementId: 'G-YYYYYYYYYY',
  },
  production: {
    apiKey: '', // SecureStoreから動的に取得
    authDomain: 'climb-you.firebaseapp.com',
    projectId: 'climb-you',
    storageBucket: 'climb-you.appspot.com',
    messagingSenderId: '555666777',
    appId: '1:555666777:web:abcdef987654',
    measurementId: 'G-ZZZZZZZZZZ',
  },
};

class FirebaseManager {
  private app: any = null;
  private auth: any = null;
  private firestore: any = null;
  
  async initialize(): Promise<void> {
    try {
      // 既に初期化済みの場合はスキップ
      if (getApps().length > 0) {
        this.app = getApps()[0];
        this.auth = getAuth(this.app);
        this.firestore = getFirestore(this.app);
        return;
      }
      
      // APIキーを安全に取得
      const apiKey = await secretManager.getSecret('FIREBASE_API_KEY');
      if (!apiKey) {
        throw new Error('Firebase API key not found in secure storage');
      }
      
      // 環境に応じた設定を取得
      const config = firebaseConfigs[envManager.config.name];
      const firebaseConfig = {
        ...config,
        apiKey, // セキュアストレージから取得したAPIキー
      };
      
      // Firebase初期化
      this.app = initializeApp(firebaseConfig);
      this.auth = getAuth(this.app);
      this.firestore = getFirestore(this.app);
      
      console.log(`Firebase initialized for ${envManager.config.name} environment`);
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      throw error;
    }
  }
  
  getAuth() {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    return this.auth;
  }
  
  getFirestore() {
    if (!this.firestore) {
      throw new Error('Firebase not initialized');
    }
    return this.firestore;
  }
}

export const firebaseManager = new FirebaseManager();
```

## 3. 設定値の動的更新

### 3.1 リモート設定機能

```typescript
// services/config/remoteConfig.ts
interface RemoteConfig {
  // AI設定
  aiSettings: {
    questGenerationModel: string;
    maxTokensPerRequest: number;
    temperature: number;
    enableAdvancedAnalysis: boolean;
  };
  
  // UI設定
  uiSettings: {
    enableExperimentalFeatures: boolean;
    showPerformanceMetrics: boolean;
    themeVariant: 'default' | 'high-contrast' | 'dark';
  };
  
  // 機能フラグ
  featureFlags: {
    enableOfflineMode: boolean;
    enableBiometricAuth: boolean;
    enableAdvancedAnalytics: boolean;
    enableSocialFeatures: boolean;
  };
  
  // メンテナンス情報
  maintenance: {
    isMaintenanceMode: boolean;
    maintenanceMessage: string;
    allowedVersions: string[];
  };
}

class RemoteConfigManager {
  private config: RemoteConfig | null = null;
  private lastFetch: Date | null = null;
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1時間
  
  async initialize(): Promise<void> {
    try {
      await this.fetchConfig();
      
      // 定期的な更新（バックグラウンド）
      this.schedulePeriodicUpdates();
    } catch (error) {
      console.error('Remote config initialization failed:', error);
      // フォールバック設定を使用
      this.config = this.getDefaultConfig();
    }
  }
  
  async fetchConfig(force = false): Promise<void> {
    // キャッシュが有効で強制更新でない場合はスキップ
    if (!force && this.lastFetch && 
        Date.now() - this.lastFetch.getTime() < this.CACHE_DURATION) {
      return;
    }
    
    try {
      const response = await fetch(`${envManager.getApiConfig().baseUrl}/config`, {
        headers: {
          'X-App-Version': Constants.expoConfig?.version || '1.0.0',
          'X-Platform': Platform.OS,
        },
      });
      
      if (response.ok) {
        const newConfig = await response.json();
        this.config = newConfig;
        this.lastFetch = new Date();
        
        // ローカルキャッシュに保存
        await AsyncStorage.setItem('remote_config', JSON.stringify(newConfig));
        
        console.log('Remote config updated successfully');
      }
    } catch (error) {
      console.error('Failed to fetch remote config:', error);
      // ローカルキャッシュから読み込み
      await this.loadFromCache();
    }
  }
  
  private async loadFromCache(): Promise<void> {
    try {
      const cached = await AsyncStorage.getItem('remote_config');
      if (cached) {
        this.config = JSON.parse(cached);
      }
    } catch (error) {
      console.error('Failed to load config from cache:', error);
    }
  }
  
  // 設定値の取得
  get<K extends keyof RemoteConfig>(section: K): RemoteConfig[K] {
    if (!this.config) {
      return this.getDefaultConfig()[section];
    }
    return this.config[section];
  }
  
  // 特定の機能フラグの確認
  isFeatureEnabled(feature: keyof RemoteConfig['featureFlags']): boolean {
    return this.get('featureFlags')[feature] || false;
  }
  
  // メンテナンス状態の確認
  isMaintenanceMode(): boolean {
    return this.get('maintenance').isMaintenanceMode;
  }
  
  // バージョンサポート状況の確認
  isVersionSupported(): boolean {
    const currentVersion = Constants.expoConfig?.version || '1.0.0';
    const allowedVersions = this.get('maintenance').allowedVersions;
    
    return allowedVersions.length === 0 || allowedVersions.includes(currentVersion);
  }
  
  private schedulePeriodicUpdates(): void {
    // アプリがフォアグラウンドになったときに更新
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        this.fetchConfig().catch(() => {});
      }
    });
    
    // 定期的な更新（6時間ごと）
    setInterval(() => {
      this.fetchConfig().catch(() => {});
    }, 6 * 60 * 60 * 1000);
  }
  
  private getDefaultConfig(): RemoteConfig {
    return {
      aiSettings: {
        questGenerationModel: 'gpt-4o-mini',
        maxTokensPerRequest: 500,
        temperature: 0.7,
        enableAdvancedAnalysis: false,
      },
      uiSettings: {
        enableExperimentalFeatures: false,
        showPerformanceMetrics: envManager.isDevelopment(),
        themeVariant: 'default',
      },
      featureFlags: {
        enableOfflineMode: true,
        enableBiometricAuth: true,
        enableAdvancedAnalytics: !envManager.isDevelopment(),
        enableSocialFeatures: false,
      },
      maintenance: {
        isMaintenanceMode: false,
        maintenanceMessage: '',
        allowedVersions: [],
      },
    };
  }
}

export const remoteConfigManager = new RemoteConfigManager();
```

## 4. 設定の検証・監査

### 4.1 設定検証システム

```typescript
// services/config/configValidator.ts
interface ValidationRule {
  check: () => Promise<boolean>;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

class ConfigValidator {
  private validationRules: ValidationRule[] = [
    {
      check: async () => {
        const openaiKey = await secretManager.getSecret('OPENAI_API_KEY');
        return !!openaiKey && openaiKey.length > 0;
      },
      message: 'OpenAI API key is required',
      severity: 'error',
    },
    {
      check: async () => {
        const firebaseKey = await secretManager.getSecret('FIREBASE_API_KEY');
        return !!firebaseKey && firebaseKey.length > 0;
      },
      message: 'Firebase API key is required',
      severity: 'error',
    },
    {
      check: async () => {
        try {
          await firebaseManager.initialize();
          return true;
        } catch {
          return false;
        }
      },
      message: 'Firebase connection test failed',
      severity: 'warning',
    },
    {
      check: async () => {
        return envManager.isFeatureEnabled('offlineMode');
      },
      message: 'Offline mode is disabled',
      severity: 'info',
    },
    {
      check: async () => {
        const version = Constants.expoConfig?.version;
        return !!version && version !== '1.0.0';
      },
      message: 'Using default version number',
      severity: 'warning',
    },
  ];
  
  async validateConfiguration(): Promise<ValidationResult> {
    const results: ValidationIssue[] = [];
    
    console.log('🔍 Starting configuration validation...');
    
    for (const rule of this.validationRules) {
      try {
        const isValid = await rule.check();
        
        if (!isValid) {
          results.push({
            message: rule.message,
            severity: rule.severity,
            timestamp: new Date(),
          });
        }
      } catch (error) {
        results.push({
          message: `Validation check failed: ${rule.message}`,
          severity: 'error',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    const hasErrors = results.some(r => r.severity === 'error');
    const hasWarnings = results.some(r => r.severity === 'warning');
    
    const result: ValidationResult = {
      isValid: !hasErrors,
      hasWarnings,
      issues: results,
      validatedAt: new Date(),
    };
    
    // 結果をログ出力
    this.logValidationResults(result);
    
    return result;
  }
  
  private logValidationResults(result: ValidationResult): void {
    if (result.isValid) {
      console.log('✅ Configuration validation passed');
    } else {
      console.error('❌ Configuration validation failed');
    }
    
    if (result.issues.length > 0) {
      console.group('Validation Issues:');
      result.issues.forEach(issue => {
        const icon = {
          error: '🚨',
          warning: '⚠️',
          info: 'ℹ️',
        }[issue.severity];
        
        console.log(`${icon} ${issue.message}`);
        if (issue.error) {
          console.log(`   Error: ${issue.error}`);
        }
      });
      console.groupEnd();
    }
  }
  
  // アプリ起動時の検証
  async validateAtStartup(): Promise<void> {
    const result = await this.validateConfiguration();
    
    if (!result.isValid) {
      // 重要な設定エラーがある場合は設定画面を表示
      useUIStore.getState().showConfigurationScreen(result.issues);
    } else if (result.hasWarnings) {
      // 警告がある場合は通知のみ
      useNotificationStore.getState().addNotification({
        id: generateUUID(),
        type: 'warning',
        title: 'Configuration Warning',
        message: `${result.issues.length} configuration issues detected`,
        createdAt: new Date(),
      });
    }
  }
}

interface ValidationIssue {
  message: string;
  severity: 'error' | 'warning' | 'info';
  timestamp: Date;
  error?: string;
}

interface ValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  issues: ValidationIssue[];
  validatedAt: Date;
}

export const configValidator = new ConfigValidator();
```

### 4.2 設定監査ログ

```typescript
// services/config/configAudit.ts
interface ConfigChangeEvent {
  timestamp: Date;
  type: 'secret_set' | 'secret_deleted' | 'config_updated' | 'feature_toggled';
  details: {
    key?: string;
    oldValue?: any;
    newValue?: any;
    source: 'user' | 'remote' | 'system';
  };
  userId?: string;
  sessionId: string;
}

class ConfigAuditLogger {
  private auditLog: ConfigChangeEvent[] = [];
  private readonly MAX_LOG_SIZE = 1000;
  
  // 設定変更の記録
  logConfigChange(
    type: ConfigChangeEvent['type'],
    details: ConfigChangeEvent['details'],
    userId?: string
  ): void {
    const event: ConfigChangeEvent = {
      timestamp: new Date(),
      type,
      details,
      userId,
      sessionId: this.getSessionId(),
    };
    
    this.auditLog.push(event);
    
    // ログサイズ制限
    if (this.auditLog.length > this.MAX_LOG_SIZE) {
      this.auditLog = this.auditLog.slice(-this.MAX_LOG_SIZE / 2);
    }
    
    // 重要な変更はリアルタイムで送信
    if (this.isCriticalChange(type)) {
      this.sendAuditEvent(event).catch(() => {});
    }
    
    // ローカルストレージに保存
    this.saveAuditLog().catch(() => {});
  }
  
  // 監査ログの取得
  getAuditLog(filter?: {
    since?: Date;
    userId?: string;
    type?: ConfigChangeEvent['type'];
  }): ConfigChangeEvent[] {
    let filtered = [...this.auditLog];
    
    if (filter) {
      if (filter.since) {
        filtered = filtered.filter(e => e.timestamp >= filter.since!);
      }
      if (filter.userId) {
        filtered = filtered.filter(e => e.userId === filter.userId);
      }
      if (filter.type) {
        filtered = filtered.filter(e => e.type === filter.type);
      }
    }
    
    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
  
  // 監査レポートの生成
  generateAuditReport(period: { start: Date; end: Date }): AuditReport {
    const events = this.getAuditLog({
      since: period.start,
    }).filter(e => e.timestamp <= period.end);
    
    const summary = {
      totalChanges: events.length,
      byType: this.groupByType(events),
      byUser: this.groupByUser(events),
      criticalChanges: events.filter(e => this.isCriticalChange(e.type)),
    };
    
    return {
      period,
      summary,
      events,
      generatedAt: new Date(),
    };
  }
  
  private async saveAuditLog(): Promise<void> {
    try {
      const logData = {
        events: this.auditLog.slice(-100), // 最新100件のみ保存
        savedAt: new Date().toISOString(),
      };
      
      await AsyncStorage.setItem('config_audit_log', JSON.stringify(logData));
    } catch (error) {
      console.error('Failed to save audit log:', error);
    }
  }
  
  private async loadAuditLog(): Promise<void> {
    try {
      const saved = await AsyncStorage.getItem('config_audit_log');
      if (saved) {
        const logData = JSON.parse(saved);
        this.auditLog = logData.events.map((e: any) => ({
          ...e,
          timestamp: new Date(e.timestamp),
        }));
      }
    } catch (error) {
      console.error('Failed to load audit log:', error);
    }
  }
  
  private async sendAuditEvent(event: ConfigChangeEvent): Promise<void> {
    try {
      await fetch(`${envManager.getApiConfig().baseUrl}/audit/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...event,
          appVersion: Constants.expoConfig?.version,
          platform: Platform.OS,
        }),
      });
    } catch (error) {
      console.error('Failed to send audit event:', error);
    }
  }
  
  private isCriticalChange(type: ConfigChangeEvent['type']): boolean {
    return ['secret_set', 'secret_deleted'].includes(type);
  }
  
  private getSessionId(): string {
    // セッションIDの生成・取得ロジック
    return 'session_' + Date.now();
  }
  
  private groupByType(events: ConfigChangeEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
  
  private groupByUser(events: ConfigChangeEvent[]): Record<string, number> {
    return events.reduce((acc, event) => {
      const user = event.userId || 'system';
      acc[user] = (acc[user] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

interface AuditReport {
  period: { start: Date; end: Date };
  summary: {
    totalChanges: number;
    byType: Record<string, number>;
    byUser: Record<string, number>;
    criticalChanges: ConfigChangeEvent[];
  };
  events: ConfigChangeEvent[];
  generatedAt: Date;
}

export const configAuditLogger = new ConfigAuditLogger();
```

## 5. アプリ起動時の設定初期化

```typescript
// services/initialization/appInitializer.ts
class AppInitializer {
  private isInitialized = false;
  
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    console.log('🚀 Starting app initialization...');
    
    try {
      // 1. 環境設定の確認
      console.log('📝 Environment:', envManager.config.name);
      
      // 2. シークレット管理の初期化
      await secretManager.initializeSecrets();
      console.log('🔐 Secrets initialized');
      
      // 3. Firebase初期化
      await firebaseManager.initialize();
      console.log('🔥 Firebase initialized');
      
      // 4. リモート設定の取得
      await remoteConfigManager.initialize();
      console.log('⚙️ Remote config initialized');
      
      // 5. 設定検証
      await configValidator.validateAtStartup();
      console.log('✅ Configuration validated');
      
      // 6. パフォーマンス監視開始（本番環境以外）
      if (!envManager.isProduction()) {
        performanceMonitor.startMonitoring();
        console.log('📊 Performance monitoring started');
      }
      
      // 7. 初期化完了
      this.isInitialized = true;
      console.log('✨ App initialization completed');
      
    } catch (error) {
      console.error('💥 App initialization failed:', error);
      
      // 初期化失敗時のエラーハンドリング
      useUIStore.getState().showInitializationError(error);
      throw error;
    }
  }
  
  isReady(): boolean {
    return this.isInitialized;
  }
}

export const appInitializer = new AppInitializer();

// App.tsx での使用例
export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  
  useEffect(() => {
    appInitializer
      .initialize()
      .then(() => setIsReady(true))
      .catch(setInitError);
  }, []);
  
  if (initError) {
    return <InitializationErrorScreen error={initError} />;
  }
  
  if (!isReady) {
    return <SplashScreen />;
  }
  
  return (
    <AppErrorBoundary>
      <AppNavigator />
    </AppErrorBoundary>
  );
}
```
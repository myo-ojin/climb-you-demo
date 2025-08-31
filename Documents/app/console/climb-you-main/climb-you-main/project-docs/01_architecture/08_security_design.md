# セキュリティ設計

## 1. セキュリティ要件・脅威モデル

### 1.1 保護対象資産

```
機密レベル: 高
├── ユーザーの学習データ
│   ├── 学習履歴・進捗情報
│   ├── 個人プロファイル情報
│   └── AI分析結果・インサイト
├── 認証情報
│   ├── パスワード・生体認証データ
│   ├── セッショントークン
│   └── OAuth認証情報
└── システム機密情報
    ├── OpenAI APIキー
    ├── Firebase設定情報
    └── 暗号化キー

機密レベル: 中
├── ユーザー行動データ
│   ├── アプリ利用統計
│   ├── 画面遷移ログ
│   └── エラー・クラッシュログ
└── システム設定情報
    ├── 環境設定
    └── 機能フラグ

機密レベル: 低
├── 公開コンテンツ
│   ├── 一般的な学習テンプレート
│   └── ヘルプ・ドキュメント
└── 匿名化統計データ
```

### 1.2 脅威モデル (STRIDE分析)

| 脅威カテゴリ | 具体的脅威 | 影響 | 対策 |
|------------|-----------|------|------|
| **Spoofing** | なりすましログイン | 個人データ漏洩 | 多要素認証、生体認証 |
| **Tampering** | データ改ざん | 学習進捗の不正操作 | データ整合性チェック、監査ログ |
| **Repudiation** | 操作の否認 | トラブル時の追跡困難 | 詳細な監査ログ、デジタル署名 |
| **Information Disclosure** | データ漏洩 | プライバシー侵害 | 暗号化、アクセス制御 |
| **Denial of Service** | サービス妨害 | アプリ利用不可 | レート制限、監視システム |
| **Elevation of Privilege** | 権限昇格 | 不正な管理機能アクセス | 最小権限の原則、権限検証 |

## 2. 認証・認可システム

### 2.1 Firebase Authentication統合

```typescript
// services/auth/authService.ts
import { 
  Auth, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

interface AuthResult {
  user: User | null;
  token?: string;
  biometricEnabled?: boolean;
}

class AuthService {
  private auth: Auth;
  private currentUser: User | null = null;
  
  constructor(auth: Auth) {
    this.auth = auth;
    this.initializeAuthListener();
  }

  // 認証状態リスナー
  private initializeAuthListener(): void {
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser = user;
      
      if (user) {
        // ユーザー情報をストアに保存
        const userProfile = await this.fetchUserProfile(user.uid);
        useUserStore.getState().setProfile(userProfile);
        
        // セッショントークンを安全に保存
        const token = await user.getIdToken();
        await this.securelyStoreToken(token);
        
        // 生体認証の設定チェック
        await this.checkBiometricSetup(user.uid);
      } else {
        // ログアウト時のクリーンアップ
        await this.cleanupUserSession();
      }
    });
  }

  // メール・パスワードログイン
  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    try {
      // 入力値の検証
      this.validateEmailAndPassword(email, password);
      
      const result = await signInWithEmailAndPassword(this.auth, email, password);
      const token = await result.user.getIdToken();
      
      // ログイン成功時の監査ログ
      this.logSecurityEvent('login_success', {
        userId: result.user.uid,
        method: 'email',
        timestamp: new Date(),
      });
      
      return {
        user: result.user,
        token,
      };
    } catch (error) {
      // ログイン失敗時の監査ログ
      this.logSecurityEvent('login_failed', {
        email,
        error: error.code,
        timestamp: new Date(),
      });
      
      throw this.handleAuthError(error);
    }
  }

  // 生体認証ログイン
  async signInWithBiometrics(): Promise<AuthResult> {
    try {
      // 生体認証の可用性チェック
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      if (!isAvailable) {
        throw new Error('Biometric authentication not available');
      }
      
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        throw new Error('No biometric data enrolled');
      }
      
      // 生体認証実行
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access Climb You',
        subtitle: 'Use your fingerprint or face to sign in',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use password instead',
        requireConfirmation: true,
      });
      
      if (!biometricResult.success) {
        throw new Error('Biometric authentication failed');
      }
      
      // 保存された認証情報を取得
      const storedToken = await SecureStore.getItemAsync('user_token');
      if (!storedToken) {
        throw new Error('No stored authentication found');
      }
      
      // トークンの有効性を検証
      const isValid = await this.validateStoredToken(storedToken);
      if (!isValid) {
        // トークンが無効な場合は再ログインを要求
        await this.clearStoredCredentials();
        throw new Error('Stored authentication expired');
      }
      
      this.logSecurityEvent('login_success', {
        userId: this.currentUser?.uid,
        method: 'biometric',
        timestamp: new Date(),
      });
      
      return {
        user: this.currentUser,
        token: storedToken,
        biometricEnabled: true,
      };
    } catch (error) {
      this.logSecurityEvent('biometric_login_failed', {
        error: error.message,
        timestamp: new Date(),
      });
      throw error;
    }
  }

  // ユーザー登録
  async registerWithEmail(email: string, password: string, profile: UserProfile): Promise<AuthResult> {
    try {
      this.validateEmailAndPassword(email, password);
      this.validateUserProfile(profile);
      
      const result = await createUserWithEmailAndPassword(this.auth, email, password);
      
      // プロファイル情報を更新
      await updateProfile(result.user, {
        displayName: profile.name,
      });
      
      // ユーザープロファイルをFirestoreに保存
      await this.createUserProfile(result.user.uid, profile);
      
      const token = await result.user.getIdToken();
      
      this.logSecurityEvent('registration_success', {
        userId: result.user.uid,
        timestamp: new Date(),
      });
      
      return {
        user: result.user,
        token,
      };
    } catch (error) {
      this.logSecurityEvent('registration_failed', {
        email,
        error: error.code,
        timestamp: new Date(),
      });
      throw this.handleAuthError(error);
    }
  }

  // ログアウト
  async signOut(): Promise<void> {
    try {
      const userId = this.currentUser?.uid;
      
      await signOut(this.auth);
      await this.cleanupUserSession();
      
      this.logSecurityEvent('logout', {
        userId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // トークン更新
  async refreshToken(): Promise<string> {
    if (!this.currentUser) {
      throw new Error('No authenticated user');
    }
    
    try {
      const token = await this.currentUser.getIdToken(true); // 強制更新
      await this.securelyStoreToken(token);
      return token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // 生体認証設定
  async enableBiometricAuth(): Promise<void> {
    if (!this.currentUser) {
      throw new Error('User must be authenticated');
    }
    
    const isAvailable = await LocalAuthentication.hasHardwareAsync();
    if (!isAvailable) {
      throw new Error('Biometric hardware not available');
    }
    
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      throw new Error('No biometric data enrolled on device');
    }
    
    // 現在のパスワードで再認証
    const password = await this.promptForCurrentPassword();
    const credential = EmailAuthProvider.credential(
      this.currentUser.email!,
      password
    );
    
    await reauthenticateWithCredential(this.currentUser, credential);
    
    // 生体認証有効化フラグを保存
    await SecureStore.setItemAsync('biometric_enabled', 'true');
    
    this.logSecurityEvent('biometric_enabled', {
      userId: this.currentUser.uid,
      timestamp: new Date(),
    });
  }

  // プライベートメソッド
  private validateEmailAndPassword(email: string, password: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    
    // パスワード強度チェック
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strengthScore = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar]
      .filter(Boolean).length;
    
    if (strengthScore < 3) {
      throw new Error('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters');
    }
  }

  private async securelyStoreToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('user_token', token, {
      requireAuthentication: true,
      authenticationPrompt: 'Authenticate to access your account',
    });
  }

  private async validateStoredToken(token: string): Promise<boolean> {
    try {
      // Firebaseでトークンの有効性を検証
      const decodedToken = await admin.auth().verifyIdToken(token);
      return decodedToken.exp > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  private async cleanupUserSession(): Promise<void> {
    await SecureStore.deleteItemAsync('user_token').catch(() => {});
    await SecureStore.deleteItemAsync('biometric_enabled').catch(() => {});
    
    // ストアのクリア
    useUserStore.getState().reset();
    useQuestStore.getState().reset();
    useAIStore.getState().reset();
  }

  private handleAuthError(error: any): Error {
    switch (error.code) {
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return new Error('Invalid email or password');
      case 'auth/email-already-in-use':
        return new Error('Email already registered');
      case 'auth/weak-password':
        return new Error('Password is too weak');
      case 'auth/too-many-requests':
        return new Error('Too many failed attempts. Please try again later');
      default:
        return new Error('Authentication failed. Please try again');
    }
  }

  private logSecurityEvent(event: string, data: any): void {
    // セキュリティイベントログ
    console.log(`🔒 Security Event: ${event}`, data);
    
    // 本番環境では監査ログサービスに送信
    if (!__DEV__) {
      this.sendAuditLog(event, data);
    }
  }

  private async sendAuditLog(event: string, data: any): Promise<void> {
    try {
      await fetch('/api/audit/security-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          data: {
            ...data,
            appVersion: Constants.expoConfig?.version,
            platform: Platform.OS,
            deviceId: await Application.getInstallationTimeAsync(),
          },
        }),
      });
    } catch (error) {
      console.error('Failed to send audit log:', error);
    }
  }
}

export const authService = new AuthService(auth);
```

### 2.2 セッション管理

```typescript
// services/auth/sessionManager.ts
interface SessionInfo {
  userId: string;
  token: string;
  expiresAt: Date;
  deviceId: string;
  ipAddress?: string;
}

class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24時間
  private readonly IDLE_TIMEOUT = 30 * 60 * 1000; // 30分
  private idleTimer: NodeJS.Timeout | null = null;
  private lastActivity = Date.now();

  async createSession(userId: string, token: string): Promise<string> {
    const sessionId = generateUUID();
    const deviceId = await this.getDeviceId();
    
    const sessionInfo: SessionInfo = {
      userId,
      token,
      expiresAt: new Date(Date.now() + this.SESSION_TIMEOUT),
      deviceId,
    };
    
    this.sessions.set(sessionId, sessionInfo);
    
    // アイドルタイマー開始
    this.startIdleTimer();
    
    // セッション情報を暗号化して保存
    await this.storeSessionSecurely(sessionId, sessionInfo);
    
    return sessionId;
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId) || 
                   await this.loadSessionFromStorage(sessionId);
    
    if (!session) {
      return false;
    }
    
    // セッション有効期限チェック
    if (session.expiresAt < new Date()) {
      await this.destroySession(sessionId);
      return false;
    }
    
    // デバイスIDの検証
    const currentDeviceId = await this.getDeviceId();
    if (session.deviceId !== currentDeviceId) {
      await this.destroySession(sessionId);
      return false;
    }
    
    // 最終アクティビティ更新
    this.updateLastActivity();
    
    return true;
  }

  async refreshSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.expiresAt = new Date(Date.now() + this.SESSION_TIMEOUT);
      await this.storeSessionSecurely(sessionId, session);
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await SecureStore.deleteItemAsync(`session_${sessionId}`);
    
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private updateLastActivity(): void {
    this.lastActivity = Date.now();
    this.startIdleTimer();
  }

  private startIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    
    this.idleTimer = setTimeout(() => {
      this.handleIdleTimeout();
    }, this.IDLE_TIMEOUT);
  }

  private async handleIdleTimeout(): Promise<void> {
    // アイドルタイムアウト時の処理
    useUIStore.getState().showIdleWarning();
    
    // さらに5分後に自動ログアウト
    setTimeout(async () => {
      await authService.signOut();
      useUIStore.getState().showMessage({
        type: 'info',
        title: 'Session Expired',
        message: 'You have been logged out due to inactivity',
      });
    }, 5 * 60 * 1000);
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await SecureStore.getItemAsync('device_id');
    if (!deviceId) {
      deviceId = generateUUID();
      await SecureStore.setItemAsync('device_id', deviceId);
    }
    return deviceId;
  }

  private async storeSessionSecurely(sessionId: string, session: SessionInfo): Promise<void> {
    const encrypted = await this.encryptSessionData(session);
    await SecureStore.setItemAsync(`session_${sessionId}`, encrypted);
  }

  private async loadSessionFromStorage(sessionId: string): Promise<SessionInfo | null> {
    try {
      const encrypted = await SecureStore.getItemAsync(`session_${sessionId}`);
      if (!encrypted) return null;
      
      return await this.decryptSessionData(encrypted);
    } catch (error) {
      console.error('Failed to load session from storage:', error);
      return null;
    }
  }
}

export const sessionManager = new SessionManager();
```

## 3. データ暗号化

### 3.1 暗号化サービス

```typescript
// services/encryption/encryptionService.ts
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

interface EncryptedData {
  data: string;
  iv: string;
  tag: string;
}

class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_LENGTH = 32; // 256 bits
  private readonly IV_LENGTH = 12;  // 96 bits for GCM
  
  // マスターキーの生成・取得
  async getMasterKey(): Promise<string> {
    let masterKey = await SecureStore.getItemAsync('master_key');
    
    if (!masterKey) {
      // 新しいマスターキーを生成
      const keyBuffer = await Crypto.getRandomBytesAsync(this.KEY_LENGTH);
      masterKey = Array.from(new Uint8Array(keyBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      await SecureStore.setItemAsync('master_key', masterKey, {
        requireAuthentication: true,
        authenticationPrompt: 'Authenticate to access encryption key',
      });
    }
    
    return masterKey;
  }

  // データ暗号化
  async encryptData(plaintext: string, keyId?: string): Promise<EncryptedData> {
    try {
      const key = keyId ? await this.getDerivedKey(keyId) : await this.getMasterKey();
      const keyBuffer = this.hexToBuffer(key);
      const plaintextBuffer = new TextEncoder().encode(plaintext);
      
      // ランダムIVを生成
      const iv = await Crypto.getRandomBytesAsync(this.IV_LENGTH);
      
      // AES-256-GCMで暗号化
      const encrypted = await this.aesGcmEncrypt(plaintextBuffer, keyBuffer, iv);
      
      return {
        data: this.bufferToHex(encrypted.data),
        iv: this.bufferToHex(iv),
        tag: this.bufferToHex(encrypted.tag),
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Data encryption failed');
    }
  }

  // データ復号化
  async decryptData(encryptedData: EncryptedData, keyId?: string): Promise<string> {
    try {
      const key = keyId ? await this.getDerivedKey(keyId) : await this.getMasterKey();
      const keyBuffer = this.hexToBuffer(key);
      const dataBuffer = this.hexToBuffer(encryptedData.data);
      const ivBuffer = this.hexToBuffer(encryptedData.iv);
      const tagBuffer = this.hexToBuffer(encryptedData.tag);
      
      // AES-256-GCMで復号化
      const decrypted = await this.aesGcmDecrypt({
        data: dataBuffer,
        tag: tagBuffer,
      }, keyBuffer, ivBuffer);
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Data decryption failed');
    }
  }

  // ユーザー固有の派生キーを生成
  async getDerivedKey(userId: string): Promise<string> {
    const masterKey = await this.getMasterKey();
    const salt = `climb_you_${userId}`;
    
    // PBKDF2でキー派生
    const derivedKey = await this.pbkdf2(masterKey, salt, 100000, this.KEY_LENGTH);
    return this.bufferToHex(derivedKey);
  }

  // ハッシュ関数
  async hashData(data: string, salt?: string): Promise<string> {
    const input = salt ? `${data}${salt}` : data;
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      input,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return hash;
  }

  // デジタル署名の検証
  async verifyDataIntegrity(data: string, expectedHash: string): Promise<boolean> {
    const actualHash = await this.hashData(data);
    return actualHash === expectedHash;
  }

  // プライベートメソッド（実装は簡略化）
  private async aesGcmEncrypt(
    plaintext: Uint8Array, 
    key: Uint8Array, 
    iv: Uint8Array
  ): Promise<{ data: Uint8Array; tag: Uint8Array }> {
    // 実際の実装では crypto モジュールを使用
    // React Native環境では適切なライブラリを使用
    throw new Error('AES-GCM implementation required');
  }

  private async aesGcmDecrypt(
    encrypted: { data: Uint8Array; tag: Uint8Array },
    key: Uint8Array,
    iv: Uint8Array
  ): Promise<Uint8Array> {
    // 実際の実装では crypto モジュールを使用
    throw new Error('AES-GCM implementation required');
  }

  private async pbkdf2(
    password: string,
    salt: string,
    iterations: number,
    keyLength: number
  ): Promise<Uint8Array> {
    // PBKDF2実装
    throw new Error('PBKDF2 implementation required');
  }

  private hexToBuffer(hex: string): Uint8Array {
    return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  }

  private bufferToHex(buffer: Uint8Array): string {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export const encryptionService = new EncryptionService();
```

### 3.2 保存データの暗号化

```typescript
// services/storage/secureStorage.ts
class SecureStorage {
  // 機密データの暗号化保存
  async setSecureItem(key: string, value: any, userId?: string): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      const encrypted = await encryptionService.encryptData(
        jsonValue, 
        userId // ユーザー固有のキーを使用
      );
      
      const encryptedString = JSON.stringify(encrypted);
      await SecureStore.setItemAsync(`secure_${key}`, encryptedString);
      
      // データ整合性のためのハッシュも保存
      const hash = await encryptionService.hashData(jsonValue);
      await SecureStore.setItemAsync(`hash_${key}`, hash);
    } catch (error) {
      console.error('Secure storage write failed:', error);
      throw new Error('Failed to store secure data');
    }
  }

  // 暗号化データの復号化取得
  async getSecureItem<T>(key: string, userId?: string): Promise<T | null> {
    try {
      const encryptedString = await SecureStore.getItemAsync(`secure_${key}`);
      if (!encryptedString) return null;
      
      const encrypted: EncryptedData = JSON.parse(encryptedString);
      const decrypted = await encryptionService.decryptData(encrypted, userId);
      
      // データ整合性の検証
      const expectedHash = await SecureStore.getItemAsync(`hash_${key}`);
      if (expectedHash) {
        const isValid = await encryptionService.verifyDataIntegrity(
          decrypted, 
          expectedHash
        );
        if (!isValid) {
          throw new Error('Data integrity check failed');
        }
      }
      
      return JSON.parse(decrypted) as T;
    } catch (error) {
      console.error('Secure storage read failed:', error);
      return null;
    }
  }

  // セキュアデータの削除
  async removeSecureItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(`secure_${key}`);
    await SecureStore.deleteItemAsync(`hash_${key}`);
  }

  // すべてのセキュアデータを削除
  async clearAllSecureData(): Promise<void> {
    const keys = await this.getAllSecureKeys();
    await Promise.all(keys.map(key => this.removeSecureItem(key)));
  }

  private async getAllSecureKeys(): Promise<string[]> {
    // 実装はプラットフォーム依存
    // 実際の実装では適切なキー列挙方法を使用
    return [];
  }
}

export const secureStorage = new SecureStorage();
```

## 4. 通信セキュリティ

### 4.1 HTTPSとSSL Pinning

```typescript
// services/network/secureApiClient.ts
class SecureApiClient {
  private baseURL: string;
  private expectedCertFingerprint: string;
  
  constructor(baseURL: string, certFingerprint: string) {
    this.baseURL = baseURL;
    this.expectedCertFingerprint = certFingerprint;
  }

  async secureRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // SSL証明書ピン留めの実装
    const response = await this.performPinnedRequest(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  private async performPinnedRequest(url: string, options: RequestInit): Promise<Response> {
    // React Native環境での証明書ピン留め実装
    // react-native-ssl-pinning などのライブラリを使用
    
    const pinnedOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': '1.0',
        ...options.headers,
      },
      // SSL Pinning設定
      sslPinning: {
        certs: [this.expectedCertFingerprint],
      },
    };
    
    return fetch(url, pinnedOptions);
  }

  // OpenAI APIへのセキュアリクエスト
  async openAIRequest(prompt: string, model: string = 'gpt-4o'): Promise<any> {
    const apiKey = await this.getOpenAIKey();
    
    return this.secureRequest('/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    });
  }

  private async getOpenAIKey(): Promise<string> {
    // APIキーを安全に取得
    const key = await SecureStore.getItemAsync('openai_key');
    if (!key) {
      throw new Error('OpenAI API key not found');
    }
    return key;
  }
}

export const secureApiClient = new SecureApiClient(
  'https://api.climbYou.app',
  'sha256/XXXXXX' // 実際の証明書フィンガープリント
);
```

### 4.2 リクエスト認証・署名

```typescript
// utils/requestSigning.ts
class RequestSigner {
  // リクエスト署名の生成
  async signRequest(
    method: string,
    url: string,
    body: string | null,
    timestamp: string,
    userId: string
  ): Promise<string> {
    const signingKey = await this.getSigningKey(userId);
    
    // 署名対象文字列の構築
    const signatureBase = [
      method.toUpperCase(),
      url,
      body || '',
      timestamp,
      userId,
    ].join('\n');
    
    // HMAC-SHA256で署名
    const signature = await encryptionService.hashData(
      signatureBase,
      signingKey
    );
    
    return signature;
  }

  // リクエスト署名の検証
  async verifyRequest(
    signature: string,
    method: string,
    url: string,
    body: string | null,
    timestamp: string,
    userId: string
  ): Promise<boolean> {
    // タイムスタンプの検証（5分以内）
    const now = Date.now();
    const requestTime = parseInt(timestamp);
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return false;
    }
    
    // 署名の再計算・検証
    const expectedSignature = await this.signRequest(
      method,
      url,
      body,
      timestamp,
      userId
    );
    
    return signature === expectedSignature;
  }

  private async getSigningKey(userId: string): Promise<string> {
    // ユーザー固有の署名キーを生成
    return encryptionService.getDerivedKey(`signing_${userId}`);
  }
}

export const requestSigner = new RequestSigner();
```

## 5. プライバシー保護

### 5.1 データ匿名化

```typescript
// services/privacy/anonymization.ts
class DataAnonymizationService {
  // 個人識別情報の匿名化
  anonymizeUserData(data: any): any {
    const anonymized = { ...data };
    
    // PII要素を匿名化
    if (anonymized.email) {
      anonymized.email = this.hashEmail(anonymized.email);
    }
    
    if (anonymized.name) {
      anonymized.name = this.anonymizeName(anonymized.name);
    }
    
    if (anonymized.birthDate) {
      anonymized.age = this.calculateAge(anonymized.birthDate);
      delete anonymized.birthDate;
    }
    
    if (anonymized.location) {
      anonymized.region = this.generalizeLocation(anonymized.location);
      delete anonymized.location;
    }
    
    // 一意識別子をハッシュ化
    if (anonymized.userId) {
      anonymized.userId = this.hashUserId(anonymized.userId);
    }
    
    return anonymized;
  }

  // OpenAI送信用データの匿名化
  anonymizeForAI(learningData: any): any {
    const sanitized = {
      learningStyle: learningData.learningStyle,
      goals: learningData.goals?.map((goal: any) => ({
        category: goal.category,
        difficulty: goal.difficulty,
        timeframe: goal.timeframe,
        // 具体的な内容は除外
      })),
      completionHistory: learningData.completionHistory?.map((entry: any) => ({
        category: entry.category,
        difficulty: entry.difficulty,
        completionTime: entry.completionTime,
        satisfaction: entry.satisfaction,
        // 具体的なクエスト内容は除外
      })),
      preferences: learningData.preferences,
    };
    
    return sanitized;
  }

  private hashEmail(email: string): string {
    return encryptionService.hashData(email, 'email_salt');
  }

  private anonymizeName(name: string): string {
    return name.charAt(0) + '***';
  }

  private calculateAge(birthDate: string): number {
    const birth = new Date(birthDate);
    const today = new Date();
    return today.getFullYear() - birth.getFullYear();
  }

  private generalizeLocation(location: string): string {
    // 都道府県レベルまで一般化
    return location.split(',')[0] || 'Unknown';
  }

  private async hashUserId(userId: string): Promise<string> {
    return encryptionService.hashData(userId, 'user_id_salt');
  }
}

export const anonymizationService = new DataAnonymizationService();
```

### 5.2 データ削除・忘れられる権利

```typescript
// services/privacy/dataErasure.ts
class DataErasureService {
  // ユーザーデータの完全削除
  async eraseUserData(userId: string): Promise<void> {
    try {
      // 1. Firestore上のデータ削除
      await this.deleteFirestoreData(userId);
      
      // 2. ローカルストレージの削除
      await this.deleteLocalData(userId);
      
      // 3. 分析データの匿名化
      await this.anonymizeAnalyticsData(userId);
      
      // 4. バックアップからの削除要求
      await this.requestBackupDeletion(userId);
      
      // 5. サードパーティサービスへの削除要求
      await this.requestThirdPartyDeletion(userId);
      
      // 削除完了ログ
      console.log(`Data erasure completed for user: ${userId}`);
    } catch (error) {
      console.error('Data erasure failed:', error);
      throw new Error('Failed to complete data erasure');
    }
  }

  // データ削除の進捗確認
  async verifyErasure(userId: string): Promise<ErasureStatus> {
    const checks = await Promise.allSettled([
      this.checkFirestoreErasure(userId),
      this.checkLocalErasure(userId),
      this.checkAnalyticsErasure(userId),
    ]);
    
    return {
      firestore: checks[0].status === 'fulfilled' && checks[0].value,
      local: checks[1].status === 'fulfilled' && checks[1].value,
      analytics: checks[2].status === 'fulfilled' && checks[2].value,
      completedAt: new Date(),
    };
  }

  private async deleteFirestoreData(userId: string): Promise<void> {
    const batch = db.batch();
    
    // ユーザーのサブコレクションを削除
    const collections = [
      'dailyQuests',
      'completedQuests',
      'aiInsights',
      'goals',
      'learningHistory',
    ];
    
    for (const collectionName of collections) {
      const snapshot = await db
        .collection('users')
        .doc(userId)
        .collection(collectionName)
        .get();
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
    }
    
    // メインのユーザードキュメントを削除
    batch.delete(db.collection('users').doc(userId));
    
    await batch.commit();
  }

  private async deleteLocalData(userId: string): Promise<void> {
    const keysToDelete = [
      `secure_user_profile_${userId}`,
      `secure_learning_data_${userId}`,
      `secure_quest_cache_${userId}`,
      'user_token',
      'biometric_enabled',
      'device_id',
    ];
    
    await Promise.all(
      keysToDelete.map(key => 
        SecureStore.deleteItemAsync(key).catch(() => {})
      )
    );
    
    // AsyncStorageからも削除
    await AsyncStorage.multiRemove([
      'user-store',
      'quest-store',
      'ai-store',
      'notification-store',
    ]);
  }

  private async anonymizeAnalyticsData(userId: string): Promise<void> {
    // 分析データベース内のユーザー識別情報を匿名化
    // 完全削除ではなく統計的価値を保持
    await fetch('/api/analytics/anonymize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
  }

  private async requestBackupDeletion(userId: string): Promise<void> {
    // バックアップシステムに削除要求
    await fetch('/api/backup/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
  }

  private async requestThirdPartyDeletion(userId: string): Promise<void> {
    // OpenAI等のサードパーティに削除要求
    // 注意: OpenAIは自動削除に対応していない場合があるため、
    // データ送信時に匿名化することが重要
    console.log(`Third-party deletion requested for user: ${userId}`);
  }
}

interface ErasureStatus {
  firestore: boolean;
  local: boolean;
  analytics: boolean;
  completedAt: Date;
}

export const dataErasureService = new DataErasureService();
```

## 6. セキュリティ監視・インシデント対応

### 6.1 セキュリティイベント監視

```typescript
// services/security/securityMonitor.ts
class SecurityMonitor {
  private suspiciousActivities: SecurityEvent[] = [];
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15分
  private lockoutMap = new Map<string, Date>();

  // セキュリティイベントの記録
  logSecurityEvent(event: SecurityEvent): void {
    this.suspiciousActivities.push(event);
    
    // リアルタイム脅威検知
    this.detectThreats(event);
    
    // イベントを外部監視システムに送信
    this.reportSecurityEvent(event);
  }

  // 脅威検知
  private detectThreats(event: SecurityEvent): void {
    switch (event.type) {
      case 'failed_login':
        this.handleFailedLogin(event);
        break;
      case 'suspicious_activity':
        this.handleSuspiciousActivity(event);
        break;
      case 'data_access_anomaly':
        this.handleDataAccessAnomaly(event);
        break;
    }
  }

  private handleFailedLogin(event: SecurityEvent): void {
    const identifier = event.userId || event.ipAddress || 'unknown';
    const recentAttempts = this.getRecentFailedAttempts(identifier);
    
    if (recentAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      // アカウントロックアウト
      this.lockoutMap.set(identifier, new Date(Date.now() + this.LOCKOUT_DURATION));
      
      // セキュリティアラート送信
      this.sendSecurityAlert({
        type: 'account_lockout',
        severity: 'high',
        details: {
          identifier,
          attempts: recentAttempts,
          timestamp: new Date(),
        },
      });
    }
  }

  private handleSuspiciousActivity(event: SecurityEvent): void {
    // 異常なアクセスパターンの検知
    const patterns = this.analyzeAccessPatterns(event.userId!);
    
    if (patterns.isAnomalous) {
      this.sendSecurityAlert({
        type: 'suspicious_access',
        severity: 'medium',
        details: {
          userId: event.userId,
          patterns,
          timestamp: new Date(),
        },
      });
    }
  }

  // ログイン試行のチェック
  isLockedOut(identifier: string): boolean {
    const lockoutTime = this.lockoutMap.get(identifier);
    if (!lockoutTime) return false;
    
    if (Date.now() > lockoutTime.getTime()) {
      this.lockoutMap.delete(identifier);
      return false;
    }
    
    return true;
  }

  private getRecentFailedAttempts(identifier: string): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return this.suspiciousActivities.filter(event => 
      event.type === 'failed_login' &&
      (event.userId === identifier || event.ipAddress === identifier) &&
      event.timestamp.getTime() > oneHourAgo
    ).length;
  }

  private analyzeAccessPatterns(userId: string): AccessPatternAnalysis {
    const userEvents = this.suspiciousActivities
      .filter(e => e.userId === userId)
      .slice(-50); // 最新50件を分析
    
    // 異常パターンの検知ロジック
    const timeIntervals = this.calculateTimeIntervals(userEvents);
    const locationChanges = this.detectLocationChanges(userEvents);
    const deviceChanges = this.detectDeviceChanges(userEvents);
    
    return {
      isAnomalous: 
        timeIntervals.hasAnomalousPatterns ||
        locationChanges.isRapidChange ||
        deviceChanges.isSuspicious,
      details: {
        timeIntervals,
        locationChanges,
        deviceChanges,
      },
    };
  }

  private async sendSecurityAlert(alert: SecurityAlert): Promise<void> {
    // 管理者への通知
    console.warn('🚨 Security Alert:', alert);
    
    // 外部セキュリティサービスへの通知
    try {
      await fetch('/api/security/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getSecurityToken()}`,
        },
        body: JSON.stringify(alert),
      });
    } catch (error) {
      console.error('Failed to send security alert:', error);
    }
  }
}

interface SecurityEvent {
  type: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  details?: any;
}

interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}

interface AccessPatternAnalysis {
  isAnomalous: boolean;
  details: any;
}

export const securityMonitor = new SecurityMonitor();
```
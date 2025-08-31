/**
 * API Keys Configuration - Environment Variable Management
 * 
 * 開発者用API設定管理システム
 * セキュリティとメンテナンス性を両立
 */

// 環境変数またはデフォルト設定
const API_CONFIG = {
  // OpenAI API Key
  OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY || '',
  
  // API設定
  OPENAI_MODEL: process.env.EXPO_PUBLIC_OPENAI_MODEL || 'gpt-4',
  OPENAI_TEMPERATURE: parseFloat(process.env.EXPO_PUBLIC_OPENAI_TEMPERATURE || '0.3'),
  OPENAI_MAX_TOKENS: parseInt(process.env.EXPO_PUBLIC_OPENAI_MAX_TOKENS || '4000'),
  
  // フォールバック設定
  ENABLE_AI_FEATURES: process.env.EXPO_PUBLIC_ENABLE_AI_FEATURES === 'true',
  DEBUG_API_CALLS: process.env.EXPO_PUBLIC_DEBUG_API_CALLS === 'true',
};

class APIKeyManager {
  private static instance: APIKeyManager;
  
  static getInstance(): APIKeyManager {
    if (!APIKeyManager.instance) {
      APIKeyManager.instance = new APIKeyManager();
    }
    return APIKeyManager.instance;
  }

  /**
   * OpenAI API キーの取得
   */
  getOpenAIKey(): string | null {
    const key = API_CONFIG.OPENAI_API_KEY;
    
    if (!key) {
      if (API_CONFIG.DEBUG_API_CALLS) {
        console.warn('⚠️  OpenAI API key not configured');
      }
      return null;
    }
    
    // APIキー形式の基本チェック
    if (!this.isValidOpenAIKey(key)) {
      console.error('❌ Invalid OpenAI API key format');
      return null;
    }
    
    return key;
  }

  /**
   * OpenAI API設定の取得
   */
  getOpenAIConfig() {
    return {
      apiKey: this.getOpenAIKey(),
      model: API_CONFIG.OPENAI_MODEL,
      temperature: API_CONFIG.OPENAI_TEMPERATURE,
      maxTokens: API_CONFIG.OPENAI_MAX_TOKENS,
    };
  }

  /**
   * AI機能の有効性チェック
   */
  isAIEnabled(): boolean {
    return API_CONFIG.ENABLE_AI_FEATURES && !!this.getOpenAIKey();
  }

  /**
   * API設定の診断
   */
  diagnoseConfiguration(): {
    openaiKeyConfigured: boolean;
    openaiKeyValid: boolean;
    aiFeatureEnabled: boolean;
    debugMode: boolean;
    configuration: typeof API_CONFIG;
  } {
    const key = API_CONFIG.OPENAI_API_KEY;
    
    return {
      openaiKeyConfigured: !!key,
      openaiKeyValid: !!key && this.isValidOpenAIKey(key),
      aiFeatureEnabled: API_CONFIG.ENABLE_AI_FEATURES,
      debugMode: API_CONFIG.DEBUG_API_CALLS,
      configuration: { ...API_CONFIG, OPENAI_API_KEY: this.maskAPIKey(key) }
    };
  }

  /**
   * 設定手順の表示
   */
  getSetupInstructions(): string[] {
    return [
      '🔧 API Key設定手順:',
      '',
      '1. プロジェクトルートに .env ファイルを作成',
      '2. 以下の内容を追加:',
      '',
      'EXPO_PUBLIC_OPENAI_API_KEY=your_openai_api_key_here',
      'EXPO_PUBLIC_ENABLE_AI_FEATURES=true',
      'EXPO_PUBLIC_DEBUG_API_CALLS=true',
      '',
      '3. アプリを再起動',
      '',
      '📝 注意:',
      '• .env ファイルは .gitignore に追加してください',
      '• API키는 sk- で始まる必要があります',
      '• 本番環境では DEBUG_API_CALLS=false に設定',
    ];
  }

  /**
   * 環境変数の自動初期化（開発用）
   */
  initializeForDevelopment(apiKey: string): boolean {
    if (!this.isValidOpenAIKey(apiKey)) {
      console.error('❌ Invalid API key format');
      return false;
    }

    // 注意: これは開発時のみの機能
    // 本番環境では環境変数を使用してください
    console.warn('🚨 Development mode: API key set programmatically');
    
    // プロセス環境変数を更新（開発時のみ）
    if (__DEV__) {
      (process.env as any).EXPO_PUBLIC_OPENAI_API_KEY = apiKey;
      (process.env as any).EXPO_PUBLIC_ENABLE_AI_FEATURES = 'true';
    }
    
    return true;
  }

  /**
   * OpenAI APIキーの形式チェック
   */
  private isValidOpenAIKey(key: string): boolean {
    // OpenAI APIキーの基本形式: sk-...
    return typeof key === 'string' && 
           key.startsWith('sk-') && 
           key.length > 20;
  }

  /**
   * APIキーのマスク表示
   */
  private maskAPIKey(key: string): string {
    if (!key) return '未設定';
    if (key.length < 8) return '***';
    
    const prefix = key.substring(0, 3);
    const suffix = key.substring(key.length - 4);
    return `${prefix}***...***${suffix}`;
  }

  /**
   * 設定の妥当性チェック
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!API_CONFIG.OPENAI_API_KEY) {
      errors.push('OpenAI API keyが設定されていません');
    } else if (!this.isValidOpenAIKey(API_CONFIG.OPENAI_API_KEY)) {
      errors.push('OpenAI API keyの形式が無効です');
    }
    
    if (API_CONFIG.OPENAI_TEMPERATURE < 0 || API_CONFIG.OPENAI_TEMPERATURE > 2) {
      errors.push('Temperature値が範囲外です (0-2)');
    }
    
    if (API_CONFIG.OPENAI_MAX_TOKENS < 1 || API_CONFIG.OPENAI_MAX_TOKENS > 8000) {
      errors.push('Max tokens値が範囲外です (1-8000)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * デバッグ情報の出力
   */
  logDebugInfo(): void {
    if (API_CONFIG.DEBUG_API_CALLS) {
      const diagnosis = this.diagnoseConfiguration();
      console.log('🔍 API Configuration Debug:', diagnosis);
    }
  }
}

// シングルトンインスタンス
export const apiKeyManager = APIKeyManager.getInstance();

// 設定値のエクスポート
export { API_CONFIG };

// 型定義
export interface OpenAIConfig {
  apiKey: string | null;
  model: string;
  temperature: number;
  maxTokens: number;
}
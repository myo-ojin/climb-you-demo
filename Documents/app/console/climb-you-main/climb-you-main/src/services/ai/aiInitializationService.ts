/**
 * AI Initialization Service - 自動AIサービス初期化
 * 
 * アプリ起動時に全AIサービスを自動初期化し、
 * 環境変数の設定状況を診断する統合サービス
 */

import { apiKeyManager } from '../../config/apiKeys';
import { advancedQuestService } from './advancedQuestService';

export interface AIServiceStatus {
  service: string;
  isInitialized: boolean;
  isAvailable: boolean;
  error?: string;
}

export interface AIInitializationResult {
  success: boolean;
  initialized: string[];
  failed: string[];
  services: AIServiceStatus[];
  apiKeyStatus: {
    configured: boolean;
    valid: boolean;
    aiEnabled: boolean;
    setupInstructions?: string[];
  };
}

class AIInitializationService {
  /**
   * 全AIサービスを自動初期化
   */
  async initializeAllServices(): Promise<AIInitializationResult> {
    console.log('🚀 Starting AI services initialization...');

    const result: AIInitializationResult = {
      success: false,
      initialized: [],
      failed: [],
      services: [],
      apiKeyStatus: {
        configured: false,
        valid: false,
        aiEnabled: false
      }
    };

    // API Key診断
    const diagnosis = apiKeyManager.diagnoseConfiguration();
    result.apiKeyStatus = {
      configured: diagnosis.openaiKeyConfigured,
      valid: diagnosis.openaiKeyValid,
      aiEnabled: diagnosis.aiFeatureEnabled
    };

    if (!result.apiKeyStatus.valid) {
      result.apiKeyStatus.setupInstructions = apiKeyManager.getSetupInstructions();
      console.warn('⚠️  OpenAI API key not configured or invalid');
    }

    // Advanced Quest Service初期化
    try {
      const questServiceInitialized = advancedQuestService.initialize();
      const questStatus: AIServiceStatus = {
        service: 'Advanced Quest Service',
        isInitialized: questServiceInitialized,
        isAvailable: apiKeyManager.isAIEnabled()
      };

      if (questServiceInitialized) {
        result.initialized.push('Advanced Quest Service');
        console.log('✅ Advanced Quest Service initialized successfully');
      } else {
        result.failed.push('Advanced Quest Service');
        questStatus.error = 'API key not available';
        console.warn('⚠️  Advanced Quest Service initialization failed');
      }

      result.services.push(questStatus);
    } catch (error) {
      const questStatus: AIServiceStatus = {
        service: 'Advanced Quest Service',
        isInitialized: false,
        isAvailable: false,
        error: error.message
      };
      result.services.push(questStatus);
      result.failed.push('Advanced Quest Service');
      console.error('❌ Advanced Quest Service initialization error:', error);
    }

    // 全体結果の判定
    result.success = result.failed.length === 0 && result.initialized.length > 0;

    // 初期化サマリーログ
    console.log(`🎯 AI Initialization Summary:`);
    console.log(`  ✅ Initialized: ${result.initialized.length} services`);
    console.log(`  ❌ Failed: ${result.failed.length} services`);
    console.log(`  🔑 API Key Status: ${result.apiKeyStatus.valid ? 'Valid' : 'Invalid/Missing'}`);

    return result;
  }

  /**
   * 特定サービスの初期化状態をチェック
   */
  async checkServiceStatus(serviceName: string): Promise<AIServiceStatus | null> {
    switch (serviceName.toLowerCase()) {
      case 'advanced quest service':
      case 'quest':
        const diagnosis = advancedQuestService.getDiagnosticInfo();
        return {
          service: 'Advanced Quest Service',
          isInitialized: diagnosis.isInitialized,
          isAvailable: diagnosis.aiEnabled,
          error: !diagnosis.apiKeyAvailable ? 'API key not available' : undefined
        };
      
      default:
        return null;
    }
  }

  /**
   * 初期化に失敗したサービスを再初期化
   */
  async retryFailedServices(): Promise<AIInitializationResult> {
    console.log('🔄 Retrying failed AI service initialization...');
    return await this.initializeAllServices();
  }

  /**
   * 設定ガイダンスの表示
   */
  getSetupGuidance(): {
    hasValidAPIKey: boolean;
    instructions: string[];
    troubleshooting: string[];
  } {
    const diagnosis = apiKeyManager.diagnoseConfiguration();
    const validation = apiKeyManager.validateConfiguration();

    return {
      hasValidAPIKey: validation.isValid,
      instructions: apiKeyManager.getSetupInstructions(),
      troubleshooting: [
        '🔧 トラブルシューティング:',
        '',
        '1. .env ファイルがプロジェクトルートにあることを確認',
        '2. EXPO_PUBLIC_OPENAI_API_KEY=sk-... の形式で記載',
        '3. アプリを完全に再起動 (Metro bundler含む)',
        '4. APIキーがOpenAIで有効であることを確認',
        '',
        `現在の設定エラー:`,
        ...validation.errors.map(error => `  - ${error}`)
      ]
    };
  }

  /**
   * 開発者用診断情報の出力
   */
  async logDiagnosticInfo(): Promise<void> {
    console.log('\n🔍 AI Services Diagnostic Report:');
    console.log('=====================================');
    
    // API Key Manager診断
    const apiDiagnosis = apiKeyManager.diagnoseConfiguration();
    console.log('📋 API Key Manager:');
    console.log(`  Key Configured: ${apiDiagnosis.openaiKeyConfigured}`);
    console.log(`  Key Valid: ${apiDiagnosis.openaiKeyValid}`);
    console.log(`  AI Enabled: ${apiDiagnosis.aiFeatureEnabled}`);
    console.log(`  Debug Mode: ${apiDiagnosis.debugMode}`);

    // Advanced Quest Service診断
    const questDiagnosis = advancedQuestService.getDiagnosticInfo();
    console.log('🎯 Advanced Quest Service:');
    console.log(`  Initialized: ${questDiagnosis.isInitialized}`);
    console.log(`  API Available: ${questDiagnosis.apiKeyAvailable}`);
    console.log(`  Enabled: ${questDiagnosis.aiEnabled}`);

    // 設定バリデーション
    const validation = apiKeyManager.validateConfiguration();
    if (!validation.isValid) {
      console.log('⚠️  Configuration Issues:');
      validation.errors.forEach(error => console.log(`    - ${error}`));
    }

    console.log('=====================================\n');
  }
}

export const aiInitializationService = new AIInitializationService();

// 型エクスポート
export type { AIServiceStatus, AIInitializationResult };
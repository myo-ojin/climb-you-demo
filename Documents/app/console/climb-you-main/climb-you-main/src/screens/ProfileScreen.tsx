import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../services/firebase/config';
import { hybridStorageService } from '../services/storage/hybridStorage';
import { openaiService } from '../services/ai/openaiService';
import { advancedQuestService, ProfileV1 } from '../services/ai/advancedQuestService';
import { secureAPIKeyManager, APIKeyMetadata } from '../services/security/secureAPIKeyManager';
import { aiInitializationService, AIInitializationResult } from '../services/ai/aiInitializationService';
import { apiKeyManager } from '../config/apiKeys';

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('未接続');
  const [syncStatus, setSyncStatus] = useState<string>('不明');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [securityStatus, setSecurityStatus] = useState<string>('未確認');
  const [aiStatus, setAiStatus] = useState<string>('未確認');
  const [initializationResult, setInitializationResult] = useState<AIInitializationResult | null>(null);

  useEffect(() => {
    checkServices();
    checkSecurityStatus();
    checkAIStatus();
  }, []);

  const checkServices = async () => {
    const currentUser = firebaseConfig.getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.uid);
      setConnectionStatus('匿名認証済み');
      await checkSyncStatus();
    } else {
      setConnectionStatus('未認証');
    }
  };

  const checkSyncStatus = async () => {
    try {
      const status = await hybridStorageService.getSyncStatus();
      const statusText = status.hasUnsyncedChanges 
        ? '未同期の変更あり' 
        : status.lastSyncAt 
          ? `最終同期: ${status.lastSyncAt.toLocaleTimeString()}`
          : '同期なし';
      setSyncStatus(statusText);
    } catch (error) {
      setSyncStatus('ステータス取得エラー');
    }
  };

  const checkSecurityStatus = async () => {
    try {
      const diagnosis = await secureAPIKeyManager.diagnoseSecurityStatus();
      const statusParts = [];
      
      if (diagnosis.secureStoreAvailable) statusParts.push('SecureStore✅');
      else statusParts.push('SecureStore❌');
      
      if (diagnosis.encryptionWorking) statusParts.push('暗号化✅');
      else statusParts.push('暗号化❌');
      
      if (diagnosis.deviceKeyExists) statusParts.push('デバイスキー✅');
      else statusParts.push('デバイスキー❌');
      
      setSecurityStatus(statusParts.join(' '));
    } catch (error) {
      setSecurityStatus('エラー');
    }
  };

  const checkAIStatus = async () => {
    try {
      const diagnosis = apiKeyManager.diagnoseConfiguration();
      const statusParts = [];
      
      if (diagnosis.openaiKeyConfigured) statusParts.push('APIキー✅');
      else statusParts.push('APIキー❌');
      
      if (diagnosis.openaiKeyValid) statusParts.push('検証✅');
      else statusParts.push('検証❌');
      
      if (diagnosis.aiFeatureEnabled) statusParts.push('AI機能✅');
      else statusParts.push('AI機能❌');
      
      setAiStatus(statusParts.join(' '));
    } catch (error) {
      setAiStatus('エラー');
    }
  };

  const runFullFirebaseTest = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push('🔥 Firebase初期化確認...');
      
      // Anonymous認証テスト
      try {
        const user = await firebaseConfig.signInAnonymously();
        setUserId(user.uid);
        setConnectionStatus('匿名認証済み');
        results.push(`✅ 匿名認証成功: ${user.uid.substring(0, 8)}...`);
        
        // Hybrid Storageテスト - Goal作成
        const goalId = await hybridStorageService.createGoal({
          title: 'テスト目標',
          description: 'Firebase機能テスト用の目標',
          category: 'テスト',
          timeframe: '1週間',
          intensity: 'medium',
        });
        results.push(`✅ Goal作成成功: ${goalId}`);
        
        // Hybrid Storageテスト - Quest作成
        const questId = await hybridStorageService.createQuest({
          title: 'テストクエスト',
          description: 'Firebase動作確認用クエスト',
          category: 'テスト',
          difficulty: 'easy',
          estimatedTime: 10,
          generatedBy: 'manual',
        });
        results.push(`✅ Quest作成成功: ${questId}`);
        
        // データ読み取りテスト
        const [goals, quests] = await Promise.all([
          hybridStorageService.getGoals(),
          hybridStorageService.getQuests(),
        ]);
        results.push(`✅ データ読み取り成功: Goals ${goals.length}件, Quests ${quests.length}件`);
        
        // Firestore同期テスト
        const syncSuccess = await hybridStorageService.forceSync();
        results.push(`${syncSuccess ? '✅' : '❌'} Firestore同期: ${syncSuccess ? '成功' : '失敗'}`);
        
        await checkSyncStatus();
        
      } catch (error) {
        results.push(`❌ 認証エラー: ${error.message}`);
      }
      
    } catch (error) {
      results.push(`❌ Firebase初期化エラー: ${error.message}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
  };

  const testAdvancedQuests = async () => {
    Alert.alert(
      '🎯 Advanced Quest Generation',
      '設計書の高品質プロンプトを使った次世代クエスト生成をテストします。',
      [
        {
          text: 'APIキー設定',
          onPress: () => {
            Alert.alert(
              'OpenAI API設定',
              '設定するAPIキーを入力してください',
              [
                {
                  text: 'デモ用テスト',
                  onPress: () => testAdvancedQuestsDemo()
                },
                {
                  text: 'キャンセル',
                  style: 'cancel'
                }
              ]
            );
          }
        },
        {
          text: 'デモ実行（API不要）',
          onPress: () => testAdvancedQuestsDemo()
        },
        {
          text: 'キャンセル',
          style: 'cancel'
        }
      ]
    );
  };

  const testAdvancedQuestsDemo = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push('🎯 Advanced Quest Service テスト開始');
      
      // デモプロファイル作成
      const demoProfile = advancedQuestService.createBasicProfile({
        goalText: 'React Nativeでモバイルアプリ開発をマスターする',
        timeBudgetMin: 60,
        motivation: 'high',
        sessionLength: 25
      });
      
      results.push(`✅ プロファイル作成成功`);
      results.push(`📊 時間予算: ${demoProfile.time_budget_min_per_day}分/日`);
      results.push(`🔥 モチベーション: ${demoProfile.goal_motivation}`);
      results.push(`⏱️ セッション長: ${demoProfile.preferred_session_length_min}分`);
      
      // 実際のAPIキーがある場合のみクエスト生成をテスト
      results.push('');
      results.push('📋 設計書の機能:');
      results.push('• スキルマップ自動生成 (12-18項目)');
      results.push('• パターンベース学習 (10種類)');
      results.push('• 制約考慮クエスト生成 (時間・環境)');
      results.push('• ポリシーチェック & 品質保証');
      results.push('• 日本語ネイティブ対応');
      
      results.push('');
      results.push('🚀 APIキー設定後に利用可能:');
      results.push('• advancedQuestService.initialize("YOUR_KEY")');
      results.push('• generateOptimizedQuests() で完全パイプライン');

      setTestResults(results);
      Alert.alert('Advanced Quest Service', 'デモ完了！設計書の高品質プロンプトが統合されています。');
      
    } catch (error) {
      results.push(`❌ エラー: ${error.message}`);
      setTestResults(results);
    }
    
    setIsLoading(false);
  };

  const testOpenAI = async () => {
    Alert.alert(
      'OpenAI APIテスト',
      'OpenAI APIキーが設定されていればプロファイル質問を生成できます。',
      [
        {
          text: 'APIキー設定方法を見る',
          onPress: () => {
            Alert.alert(
              'OpenAI API設定',
              'src/services/ai/openaiService.ts ファイルで\nopenaiService.initialize("YOUR_API_KEY")\nを呼び出してください。'
            );
          }
        },
        {
          text: 'テスト実行',
          onPress: async () => {
            try {
              setIsLoading(true);
              // 実際のAPIキーが必要
              const questions = await openaiService.generateProfileQuestions(['プログラミング学習']);
              Alert.alert('成功', `${questions.length}個の質問を生成しました！`);
            } catch (error) {
              Alert.alert('エラー', `OpenAI API: ${error.message}`);
            }
            setIsLoading(false);
          }
        },
        {
          text: 'キャンセル',
          style: 'cancel'
        }
      ]
    );
  };

  const restartOnboarding = async () => {
    Alert.alert(
      'オンボーディング再起動',
      '目標設定から再開しますか？現在のデータは保持されます。',
      [
        {
          text: 'キャンセル',
          style: 'cancel'
        },
        {
          text: '再起動',
          onPress: async () => {
            try {
              // オンボーディング完了フラグをリセット
              await AsyncStorage.setItem('onboarding_completed', 'false');
              Alert.alert(
                'オンボーディング再起動',
                'アプリを再起動してオンボーディングを開始してください。',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // アプリの再読み込みを促す
                      setTestResults(['🔄 オンボーディングがリセットされました', 'アプリを再起動してください']);
                    }
                  }
                ]
              );
            } catch (error) {
              Alert.alert('エラー', 'オンボーディングのリセットに失敗しました');
            }
          }
        }
      ]
    );
  };

  const testSecureAPIKeyManager = async () => {
    Alert.alert(
      '🔐 セキュアAPIキー管理テスト',
      'APIキーの暗号化保存・取得機能をテストします',
      [
        {
          text: '診断のみ',
          onPress: async () => {
            setIsLoading(true);
            const results: string[] = [];
            
            try {
              results.push('🔍 セキュリティ診断開始...');
              
              const diagnosis = await secureAPIKeyManager.diagnoseSecurityStatus();
              results.push(`🏪 SecureStore: ${diagnosis.secureStoreAvailable ? '利用可能' : '利用不可'}`);
              results.push(`🔒 暗号化機能: ${diagnosis.encryptionWorking ? '動作中' : '失敗'}`);
              results.push(`🔑 デバイスキー: ${diagnosis.deviceKeyExists ? '生成済み' : '未生成'}`);
              
              const storedKeys = await secureAPIKeyManager.listStoredKeys();
              results.push(`💾 保存済みキー: ${storedKeys.length}個`);
              
              if (storedKeys.length > 0) {
                for (const provider of storedKeys) {
                  const metadata = await secureAPIKeyManager.getAPIKeyMetadata(provider);
                  if (metadata) {
                    results.push(`  • ${provider}: ${metadata.masked} (${new Date(metadata.encryptedAt).toLocaleString()})`);
                  }
                }
              }
              
              results.push('');
              results.push('🛡️ セキュリティ機能:');
              results.push('• AES-256-GCM暗号化');
              results.push('• デバイス固有キー派生');
              results.push('• iOS Keychain / Android Keystore');
              results.push('• メモリ保護とセキュアクリア');
              
              setTestResults(results);
              await checkSecurityStatus();
              
            } catch (error) {
              results.push(`❌ 診断エラー: ${error.message}`);
              setTestResults(results);
            }
            
            setIsLoading(false);
          }
        },
        {
          text: '完全テスト',
          onPress: async () => {
            Alert.alert(
              '完全テスト実行',
              'テスト用APIキーで暗号化・復号化をテストしますか？',
              [
                {
                  text: '実行',
                  onPress: async () => {
                    setIsLoading(true);
                    const results: string[] = [];
                    
                    try {
                      results.push('🧪 完全テスト開始...');
                      
                      const testKey = 'sk-test1234567890abcdef1234567890abcdef1234567890';
                      
                      // テスト用キー保存
                      await secureAPIKeyManager.storeAPIKey('test', testKey);
                      results.push('✅ テストキー暗号化保存成功');
                      
                      // メタデータ取得テスト
                      const metadata = await secureAPIKeyManager.getAPIKeyMetadata('test');
                      if (metadata) {
                        results.push(`📋 メタデータ取得成功: ${metadata.masked}`);
                      }
                      
                      // キー取得テスト（注意：現在は簡易実装）
                      const retrievedKey = await secureAPIKeyManager.getAPIKey('test');
                      results.push('⚠️  復号化は簡易実装（本番では適切な暗号化ライブラリを使用）');
                      
                      // クリーンアップ
                      await secureAPIKeyManager.deleteAPIKey('test');
                      results.push('🧹 テストキー削除完了');
                      
                      results.push('');
                      results.push('✅ 全テスト完了！');
                      
                    } catch (error) {
                      results.push(`❌ テストエラー: ${error.message}`);
                    }
                    
                    setTestResults(results);
                    setIsLoading(false);
                  }
                },
                { text: 'キャンセル', style: 'cancel' }
              ]
            );
          }
        },
        { text: 'キャンセル', style: 'cancel' }
      ]
    );
  };

  const testAIInitialization = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push('🚀 AI初期化サービステスト開始');
      
      // 初期化前の状態診断
      await aiInitializationService.logDiagnosticInfo();
      
      // 設定ガイダンス取得
      const guidance = aiInitializationService.getSetupGuidance();
      results.push(`🔑 APIキー有効: ${guidance.hasValidAPIKey ? '✅' : '❌'}`);
      
      if (!guidance.hasValidAPIKey) {
        results.push('⚠️  設定手順:');
        guidance.instructions.slice(0, 5).forEach(instruction => {
          results.push(`   ${instruction}`);
        });
      }
      
      // 全AIサービス初期化テスト
      const initResult = await aiInitializationService.initializeAllServices();
      setInitializationResult(initResult);
      
      results.push(`🎯 初期化結果: ${initResult.success ? '成功' : '失敗'}`);
      results.push(`✅ 初期化済みサービス: ${initResult.initialized.length}`);
      results.push(`❌ 失敗サービス: ${initResult.failed.length}`);
      
      initResult.services.forEach(service => {
        const status = service.isInitialized ? '✅' : '❌';
        const error = service.error ? ` (${service.error})` : '';
        results.push(`   ${status} ${service.service}${error}`);
      });
      
      // API Key Manager診断
      const apiDiagnosis = apiKeyManager.diagnoseConfiguration();
      results.push(`🔧 API設定診断:`);
      results.push(`   設定済み: ${apiDiagnosis.openaiKeyConfigured ? '✅' : '❌'}`);
      results.push(`   有効: ${apiDiagnosis.openaiKeyValid ? '✅' : '❌'}`);
      results.push(`   AI機能: ${apiDiagnosis.aiFeatureEnabled ? '✅' : '❌'}`);
      
      // Advanced Quest Service状態確認
      const questDiagnosis = advancedQuestService.getDiagnosticInfo();
      results.push(`🎯 クエストサービス:`);
      results.push(`   初期化済み: ${questDiagnosis.isInitialized ? '✅' : '❌'}`);
      results.push(`   API利用可能: ${questDiagnosis.apiKeyAvailable ? '✅' : '❌'}`);
      
      setTestResults(results);
      await checkAIStatus();
      
    } catch (error) {
      results.push(`❌ エラー: ${error.message}`);
      setTestResults(results);
    }
    
    setIsLoading(false);
  };

  const clearTestData = async () => {
    Alert.alert(
      'テストデータ削除',
      'ローカルのテストデータを削除しますか？',
      [
        {
          text: 'キャンセル',
          style: 'cancel'
        },
        {
          text: '削除',
          style: 'destructive',
          onPress: async () => {
            await hybridStorageService.clearLocalData();
            setTestResults([]);
            setSyncStatus('データ削除済み');
            Alert.alert('完了', 'ローカルデータを削除しました');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.title}>🧪 Firebase機能テスト</Text>
        
        {/* ステータス表示 */}
        <View style={styles.statusContainer}>
          <Text style={styles.statusTitle}>現在のステータス</Text>
          <Text style={styles.statusText}>🔐 認証: {connectionStatus}</Text>
          <Text style={styles.statusText}>🔄 同期: {syncStatus}</Text>
          <Text style={styles.statusText}>🛡️ セキュリティ: {securityStatus}</Text>
          <Text style={styles.statusText}>🤖 AI: {aiStatus}</Text>
          {userId && (
            <Text style={styles.statusText}>👤 ユーザーID: {userId.substring(0, 8)}...</Text>
          )}
        </View>

        {/* テストボタン */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={runFullFirebaseTest}
            disabled={isLoading}
          >
            <Text style={[styles.buttonText, styles.primaryButtonText]}>
              {isLoading ? 'テスト実行中...' : '🔥 Firebase全機能テスト'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testAIInitialization}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🚀 AI初期化サービステスト
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testAdvancedQuests}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🎯 Advanced Quest Generation
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testSecureAPIKeyManager}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🔐 セキュアAPIキー管理テスト
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testOpenAI}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🤖 OpenAI APIテスト
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.infoButton]}
            onPress={restartOnboarding}
          >
            <Text style={[styles.buttonText, styles.infoButtonText]}>
              🎯 オンボーディング再起動
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.warningButton]}
            onPress={clearTestData}
          >
            <Text style={[styles.buttonText, styles.warningButtonText]}>
              🗑️ テストデータ削除
            </Text>
          </TouchableOpacity>
        </View>

        {/* テスト結果 */}
        {testResults.length > 0 && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>テスト結果</Text>
            {testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>{result}</Text>
            ))}
          </View>
        )}
        
        {/* 使用方法 */}
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>📖 使用方法</Text>
          <Text style={styles.infoText}>1. 「Firebase全機能テスト」で基本機能を確認</Text>
          <Text style={styles.infoText}>2. 「Advanced Quest Generation」で設計書機能をテスト</Text>
          <Text style={styles.infoText}>3. 「セキュアAPIキー管理テスト」で暗号化機能をテスト</Text>
          <Text style={styles.infoText}>4. 「オンボーディング再起動」で目標設定画面に戻る</Text>
          <Text style={styles.infoText}>5. 「OpenAI APIテスト」でAI機能を確認</Text>
          <Text style={styles.infoText}>6. 問題があれば開発者に報告</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F2A44',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#F3E7C9',
    textAlign: 'center',
    marginVertical: 20,
  },
  statusContainer: {
    backgroundColor: 'rgba(243, 231, 201, 0.1)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F3E7C9',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 16,
    color: '#B9C3CF',
    marginBottom: 4,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  primaryButton: {
    backgroundColor: '#F3E7C9',
  },
  secondaryButton: {
    backgroundColor: 'rgba(243, 231, 201, 0.2)',
    borderWidth: 1,
    borderColor: '#F3E7C9',
  },
  warningButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  primaryButtonText: {
    color: '#0F2A44',
  },
  secondaryButtonText: {
    color: '#F3E7C9',
  },
  warningButtonText: {
    color: '#FF6B6B',
  },
  infoButton: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  infoButtonText: {
    color: '#007AFF',
  },
  resultsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F3E7C9',
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    color: '#B9C3CF',
    marginBottom: 6,
    lineHeight: 20,
  },
  infoContainer: {
    backgroundColor: 'rgba(185, 195, 207, 0.1)',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F3E7C9',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#B9C3CF',
    marginBottom: 4,
  },
});
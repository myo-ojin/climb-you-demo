import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from '../services/firebase/config';
import { hybridStorageService } from '../services/storage/hybridStorage';
import { advancedQuestService, ProfileV1 } from '../services/ai/advancedQuestService';
import { aiInitializationService, AIInitializationResult } from '../services/ai/aiInitializationService';
import { apiKeyManager } from '../config/apiKeys';

export default function ProfileScreen() {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('未接続');
  const [syncStatus, setSyncStatus] = useState<string>('不明');
  const [testResults, setTestResults] = useState<string[]>([]);
  const [aiStatus, setAiStatus] = useState<string>('未確認');
  const [initializationResult, setInitializationResult] = useState<AIInitializationResult | null>(null);

  useEffect(() => {
    checkServices();
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

  const testMockSkillMap = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push('🧪 モックスキルマップ個別テスト開始');
      
      // Advanced Quest Service初期化確認
      const initialized = advancedQuestService.isInitialized();
      results.push(`✅ サービス初期化: ${initialized ? 'OK' : 'NG'}`);
      
      if (!initialized) {
        const success = advancedQuestService.initialize();
        results.push(`🔄 初期化実行: ${success ? '成功' : '失敗'}`);
      }
      
      // スキルマップ生成テスト
      results.push('🎯 スキルマップ生成テスト...');
      const skillAtoms = await advancedQuestService.generateSkillMap({
        goalText: 'React Nativeテスト目標',
        currentLevelTags: ['初心者'],
        priorityAreas: ['基礎']
      });
      
      results.push(`✅ スキルマップ生成成功: ${skillAtoms.length}項目`);
      skillAtoms.slice(0, 3).forEach((atom, i) => {
        results.push(`  ${i+1}. ${atom.label} (${atom.type})`);
      });
      
      setTestResults(results);
      Alert.alert('スキルマップテスト', '成功！詳細はログを確認してください。');
      
    } catch (error) {
      results.push(`❌ エラー: ${error.message}`);
      if (error.name === 'ZodError') {
        results.push(`🐛 Zodエラー詳細: ${JSON.stringify(error.errors, null, 2)}`);
      }
      setTestResults(results);
      Alert.alert('エラー', `スキルマップテスト失敗: ${error.message}`);
    }
    
    setIsLoading(false);
  };

  const testMockQuests = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      results.push('🎲 モッククエスト個別テスト開始');
      
      // サンプルプロファイル作成
      const profile = advancedQuestService.createBasicProfile({
        goalText: 'テスト目標',
        timeBudgetMin: 30,
        motivation: 'high'
      });
      
      // サンプルスキルアトム
      const sampleSkillAtoms = [
        {
          id: 'test-skill',
          label: 'テストスキル',
          type: 'concept' as const,
          level: 'intro' as const,
          bloom: 'understand' as const,
          prereq: [],
          representative_tasks: ['テストタスク'],
          suggested_patterns: ['read_note_q' as const]
        }
      ];
      
      // クエスト生成テスト
      results.push('🎯 クエスト生成テスト...');
      const quests = await advancedQuestService.generateDailyQuests({
        profile,
        skillAtoms: sampleSkillAtoms
      });
      
      results.push(`✅ クエスト生成成功: ${quests.length}個`);
      quests.slice(0, 2).forEach((quest, i) => {
        results.push(`  ${i+1}. ${quest.title} (${quest.minutes}分)`);
      });
      
      setTestResults(results);
      Alert.alert('クエストテスト', '成功！詳細はログを確認してください。');
      
    } catch (error) {
      results.push(`❌ エラー: ${error.message}`);
      if (error.name === 'ZodError') {
        results.push(`🐛 Zodエラー詳細: ${JSON.stringify(error.errors, null, 2)}`);
      }
      setTestResults(results);
      Alert.alert('エラー', `クエストテスト失敗: ${error.message}`);
    }
    
    setIsLoading(false);
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
      
      // 実際のAPIキー確認と本格テスト実行
      const initialized = advancedQuestService.isInitialized();
      if (initialized) {
        results.push('');
        results.push('🚀 実際のクエスト生成テスト実行中...');
        
        try {
          // 実際のOpenAI API呼び出しテスト
          const questResult = await advancedQuestService.generateOptimizedQuests({
            goalText: demoProfile.long_term_goal,
            profile: demoProfile,
            currentLevelTags: ['React Native初心者', 'JavaScript基礎'],
            priorityAreas: ['コンポーネント設計', '状態管理'],
            checkins: {
              mood_energy: 'high',
              available_time_today_delta_min: 0,
              focus_noise: 'low'
            }
          });
          
          results.push(`✅ スキルマップ生成: ${questResult.skillAtoms.length}項目`);
          results.push(`✅ 候補クエスト: ${questResult.questsCandidate.length}個`);
          results.push(`✅ 最適化クエスト: ${questResult.finalQuests.quests.length}個`);
          
          // Firebaseに保存テスト
          results.push('');
          results.push('💾 Firebase保存テスト...');
          
          // Goal作成
          const goalId = await hybridStorageService.createGoal({
            title: demoProfile.long_term_goal,
            description: 'AI生成による学習目標',
            category: 'プログラミング',
            timeframe: '3ヶ月',
            intensity: 'high'
          });
          results.push(`✅ Goal保存: ${goalId}`);
          
          // Quest保存
          for (let i = 0; i < Math.min(3, questResult.finalQuests.quests.length); i++) {
            const quest = questResult.finalQuests.quests[i];
            const questId = await hybridStorageService.createQuest({
              goalId,
              title: quest.title,
              description: quest.description || `${quest.learning_pattern}による学習クエスト`,
              estimatedMinutes: quest.minutes,
              difficulty: 'medium',
              pattern: quest.learning_pattern
            });
            results.push(`✅ Quest保存 ${i+1}: ${questId.substring(0, 8)}...`);
          }
          
          results.push('');
          results.push('🎉 完全テスト成功！OpenAI→Firebase連携OK');
          
        } catch (apiError) {
          results.push(`❌ API呼び出しエラー: ${apiError.message}`);
          results.push('');
          results.push('📋 設計書の機能（API待機中）:');
          results.push('• スキルマップ自動生成 (12-18項目)');
          results.push('• パターンベース学習 (10種類)');
          results.push('• 制約考慮クエスト生成 (時間・環境)');
          results.push('• ポリシーチェック & 品質保証');
        }
      } else {
        results.push('');
        results.push('⚠️  APIキー未設定 - デモモードのみ');
        results.push('📋 設計書の機能:');
        results.push('• スキルマップ自動生成 (12-18項目)');
        results.push('• パターンベース学習 (10種類)');
        results.push('• 制約考慮クエスト生成 (時間・環境)');
        results.push('• ポリシーチェック & 品質保証');
      }

      setTestResults(results);
      
      if (initialized) {
        Alert.alert('Advanced Quest Service', '本格テスト完了！OpenAI API→Firebase連携をテストしました。');
      } else {
        Alert.alert('Advanced Quest Service', 'デモ完了！APIキー設定後に実際の生成が可能です。');
      }
      
    } catch (error) {
      results.push(`❌ エラー: ${error.message}`);
      setTestResults(results);
    }
    
    setIsLoading(false);
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
            onPress={testMockSkillMap}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🧪 モックスキルマップテスト
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testMockQuests}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🎲 モッククエストテスト
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={testAdvancedQuests}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              🎯 フル統合テスト
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
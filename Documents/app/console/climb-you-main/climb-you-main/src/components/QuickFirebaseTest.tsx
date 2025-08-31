import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { firebaseConfig } from '../services/firebase/config';
import { hybridStorageService } from '../services/storage/hybridStorage';

const QuickFirebaseTest: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const runQuickTest = async () => {
    setIsLoading(true);
    const results: string[] = [];
    
    try {
      // 1. Firebase初期化確認
      results.push('🔥 Firebase初期化: OK');
      
      // 2. Anonymous認証テスト
      try {
        const user = await firebaseConfig.signInAnonymously();
        results.push(`👤 Anonymous認証: 成功 (${user.uid.substring(0, 8)}...)`);
        
        // 3. Hybrid Storageテスト
        try {
          const questId = await hybridStorageService.createQuest({
            title: 'テストクエスト',
            description: '動作確認用クエスト',
            category: 'テスト',
            difficulty: 'easy',
            estimatedTime: 5,
            generatedBy: 'manual',
          });
          results.push(`💾 Hybrid Storage: 作成成功 (${questId})`);
          
          // 4. データ読み取りテスト
          const quests = await hybridStorageService.getQuests();
          results.push(`📖 データ読み取り: ${quests.length}件取得`);
          
          // 5. Firestore同期テスト
          const syncSuccess = await hybridStorageService.forceSync();
          results.push(`🔄 Firestore同期: ${syncSuccess ? '成功' : '失敗'}`);
          
        } catch (error) {
          results.push(`❌ Storage エラー: ${error.message}`);
        }
        
      } catch (error) {
        results.push(`❌ 認証エラー: ${error.message}`);
      }
      
    } catch (error) {
      results.push(`❌ Firebase初期化エラー: ${error.message}`);
    }
    
    setTestResults(results);
    setIsLoading(false);
    
    // 結果をアラートで表示
    Alert.alert(
      'Firebase機能テスト結果',
      results.join('\n'),
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.testButton, isLoading && styles.buttonDisabled]}
        onPress={runQuickTest}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? 'テスト実行中...' : '🧪 Firebase機能テスト'}
        </Text>
      </TouchableOpacity>
      
      {testResults.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>テスト結果:</Text>
          {testResults.map((result, index) => (
            <Text key={index} style={styles.resultText}>{result}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  resultsContainer: {
    marginTop: 16,
    paddingHorizontal: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginHorizontal: 20,
    padding: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
});

export default QuickFirebaseTest;
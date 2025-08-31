import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, ScrollView } from 'react-native';
import { firebaseConfig } from '../services/firebase/config';
import { hybridStorageService } from '../services/storage/hybridStorage';
import { openaiService } from '../services/ai/openaiService';

const FirebaseTestExtended: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Not connected');
  const [syncStatus, setSyncStatus] = useState<string>('Unknown');

  useEffect(() => {
    checkServices();
  }, []);

  const checkServices = async () => {
    const currentUser = firebaseConfig.getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.uid);
      setConnectionStatus('Connected anonymously');
      await checkSyncStatus();
    } else {
      setConnectionStatus('Not authenticated');
    }
  };

  const checkSyncStatus = async () => {
    try {
      const status = await hybridStorageService.getSyncStatus();
      const statusText = status.hasUnsyncedChanges 
        ? 'Has unsynced changes' 
        : status.lastSyncAt 
          ? `Last synced: ${status.lastSyncAt.toLocaleString()}`
          : 'Never synced';
      setSyncStatus(statusText);
    } catch (error) {
      setSyncStatus('Error checking status');
    }
  };

  const testAnonymousAuth = async () => {
    setIsLoading(true);
    try {
      const user = await firebaseConfig.signInAnonymously();
      setUserId(user.uid);
      setConnectionStatus('Connected anonymously');
      Alert.alert('Success', `Signed in as: ${user.uid}`);
      await checkSyncStatus();
    } catch (error) {
      console.error('Auth test failed:', error);
      Alert.alert('Error', 'Failed to sign in anonymously');
    }
    setIsLoading(false);
  };

  const testHybridStorage = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      const testGoalId = await hybridStorageService.createGoal({
        title: 'Test Goal from Hybrid Storage',
        description: 'Testing hybrid storage functionality',
        category: 'testing',
        timeframe: '1 month',
        intensity: 'medium',
      });

      const testQuestId = await hybridStorageService.createQuest({
        title: 'Test Quest from Hybrid Storage',
        description: 'Testing quest creation through hybrid storage',
        category: 'testing',
        difficulty: 'easy',
        estimatedTime: 15,
        generatedBy: 'manual',
      });

      await checkSyncStatus();
      Alert.alert('Success', `Created goal (${testGoalId}) and quest (${testQuestId})`);
    } catch (error) {
      console.error('Hybrid storage test failed:', error);
      Alert.alert('Error', `Hybrid storage test failed: ${error.message}`);
    }
    setIsLoading(false);
  };

  const testHybridRead = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      const [userData, goals, quests] = await Promise.all([
        hybridStorageService.getUserData(),
        hybridStorageService.getGoals(),
        hybridStorageService.getQuests(),
      ]);

      const message = `User: ${userData ? 'Found' : 'Not found'}\nGoals: ${goals.length}\nQuests: ${quests.length}`;
      Alert.alert('Read Success', message);
    } catch (error) {
      console.error('Hybrid read test failed:', error);
      Alert.alert('Error', `Failed to read from hybrid storage: ${error.message}`);
    }
    setIsLoading(false);
  };

  const testOpenAIService = async () => {
    setIsLoading(true);
    try {
      // Note: This would require an actual API key
      const testGoals = ['英語を話せるようになる', 'プログラミングスキルを向上させる'];
      
      Alert.alert(
        'OpenAI Test',
        'OpenAI service is configured but requires API key to test. Service ready for integration.',
        [
          {
            text: 'Test with API Key',
            onPress: async () => {
              try {
                // This would fail without proper API key
                // const questions = await openaiService.generateProfileQuestions(testGoals);
                // Alert.alert('Success', `Generated ${questions.length} questions`);
                Alert.alert('Note', 'Add your OpenAI API key to openaiService.initialize() to test');
              } catch (error) {
                Alert.alert('Expected Error', 'API key required for OpenAI integration');
              }
            }
          },
          {
            text: 'Skip',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('OpenAI test failed:', error);
      Alert.alert('Error', `OpenAI service test failed: ${error.message}`);
    }
    setIsLoading(false);
  };

  const testForceSync = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      const success = await hybridStorageService.forceSync();
      await checkSyncStatus();
      Alert.alert(
        success ? 'Sync Success' : 'Sync Failed',
        success ? 'Data synchronized successfully' : 'Sync failed - check network connection'
      );
    } catch (error) {
      console.error('Force sync failed:', error);
      Alert.alert('Error', `Force sync failed: ${error.message}`);
    }
    setIsLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Firebase + Hybrid Storage Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.status}>Auth Status: {connectionStatus}</Text>
        <Text style={styles.status}>Sync Status: {syncStatus}</Text>
        {userId && (
          <Text style={styles.userId}>User ID: {userId.substring(0, 8)}...</Text>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testAnonymousAuth}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Test Anonymous Auth</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testHybridStorage}
        disabled={isLoading || !userId}
      >
        <Text style={styles.buttonText}>Test Hybrid Storage Write</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testHybridRead}
        disabled={isLoading || !userId}
      >
        <Text style={styles.buttonText}>Test Hybrid Storage Read</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testForceSync}
        disabled={isLoading || !userId}
      >
        <Text style={styles.buttonText}>Force Sync to Firestore</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testOpenAIService}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Test OpenAI Service</Text>
      </TouchableOpacity>

      {isLoading && (
        <Text style={styles.loading}>Loading...</Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#0F2A44',
    textAlign: 'center',
  },
  statusContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    marginBottom: 8,
    color: '#1E3A4B',
  },
  userId: {
    fontSize: 14,
    color: '#666',
  },
  button: {
    backgroundColor: '#0F2A44',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#F3E7C9',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  loading: {
    marginTop: 20,
    fontSize: 16,
    color: '#007AFF',
    textAlign: 'center',
  },
});

export default FirebaseTestExtended;
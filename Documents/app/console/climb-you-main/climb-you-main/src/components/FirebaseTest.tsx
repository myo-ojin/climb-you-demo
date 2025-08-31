import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { firebaseConfig } from '../services/firebase/config';
import { firestoreService } from '../services/firebase/firestore';

const FirebaseTest: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('Not connected');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const currentUser = firebaseConfig.getCurrentUser();
    if (currentUser) {
      setUserId(currentUser.uid);
      setConnectionStatus('Connected anonymously');
    } else {
      setConnectionStatus('Not authenticated');
    }
  };

  const testAnonymousAuth = async () => {
    setIsLoading(true);
    try {
      const user = await firebaseConfig.signInAnonymously();
      setUserId(user.uid);
      setConnectionStatus('Connected anonymously');
      Alert.alert('Success', `Signed in as: ${user.uid}`);
    } catch (error) {
      console.error('Auth test failed:', error);
      Alert.alert('Error', 'Failed to sign in anonymously');
    }
    setIsLoading(false);
  };

  const testFirestoreWrite = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      // Create a test user document
      await firestoreService.createUser(userId, {
        isOnboardingCompleted: false,
        profile: {
          name: 'Test User',
          goals: ['Learn React Native', 'Build awesome apps'],
        },
      });

      // Create a test quest
      const questId = await firestoreService.createQuest(userId, {
        title: 'Test Quest',
        description: 'This is a test quest to verify Firestore functionality',
        category: 'learning',
        difficulty: 'easy',
        estimatedTime: 30,
        generatedBy: 'manual',
      });

      Alert.alert('Success', `Created test data successfully!\nQuest ID: ${questId}`);
    } catch (error) {
      console.error('Firestore write test failed:', error);
      Alert.alert('Error', `Failed to write to Firestore: ${error.message}`);
    }
    setIsLoading(false);
  };

  const testFirestoreRead = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      // Read user document
      const user = await firestoreService.getUser(userId);
      
      // Read user quests
      const quests = await firestoreService.getUserQuests(userId);

      const message = `User: ${user?.profile?.name || 'No name'}\nQuests: ${quests.length} found`;
      Alert.alert('Read Success', message);
    } catch (error) {
      console.error('Firestore read test failed:', error);
      Alert.alert('Error', `Failed to read from Firestore: ${error.message}`);
    }
    setIsLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Test</Text>
      
      <Text style={styles.status}>Status: {connectionStatus}</Text>
      {userId && (
        <Text style={styles.userId}>User ID: {userId.substring(0, 8)}...</Text>
      )}

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testAnonymousAuth}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>Test Anonymous Auth</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testFirestoreWrite}
        disabled={isLoading || !userId}
      >
        <Text style={styles.buttonText}>Test Firestore Write</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={testFirestoreRead}
        disabled={isLoading || !userId}
      >
        <Text style={styles.buttonText}>Test Firestore Read</Text>
      </TouchableOpacity>

      {isLoading && (
        <Text style={styles.loading}>Loading...</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#0F2A44',
  },
  status: {
    fontSize: 16,
    marginBottom: 10,
    color: '#1E3A4B',
  },
  userId: {
    fontSize: 14,
    marginBottom: 20,
    color: '#666',
  },
  button: {
    backgroundColor: '#0F2A44',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
    minWidth: 200,
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
  },
});

export default FirebaseTest;
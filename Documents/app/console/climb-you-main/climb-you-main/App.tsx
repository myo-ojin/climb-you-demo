import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppNavigator from './src/navigation/AppNavigator';
import OnboardingNavigator from './src/navigation/OnboardingNavigator';
import { firebaseConfig } from './src/services/firebase/config';
import { hybridStorageService } from './src/services/storage/hybridStorage';

const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

export default function App() {
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize Firebase and hybrid storage
      await firebaseConfig.initialize();
      await hybridStorageService.initialize();
      console.log('🚀 All services initialized successfully');
      
      // Check onboarding status
      await checkOnboardingStatus();
    } catch (error) {
      console.error('Error initializing app:', error);
      setIsOnboardingCompleted(false);
    }
  };

  // 本番用: AsyncStorage で判定
  // const checkOnboardingStatus = async () => {
  //   try {
  //     const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
  //     setIsOnboardingCompleted(completed === 'true');
  //   } catch (error) {
  //     console.error('Error checking onboarding status:', error);
  //     setIsOnboardingCompleted(false);
  //   }
  // };

  // テスト用: オンボーディングを常に表示
  const checkOnboardingStatus = async () => {
    setIsOnboardingCompleted(false);
  };

  const handleOnboardingComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      setIsOnboardingCompleted(true);
    } catch (error) {
      console.error('Error saving onboarding status:', error);
    }
  };

  // Loading state
  if (isOnboardingCompleted === null) {
    return null; // or a loading screen
  }

  return (
    <>
      {isOnboardingCompleted ? (
        <AppNavigator />
      ) : (
        <OnboardingNavigator onComplete={handleOnboardingComplete} />
      )}
      <StatusBar style="auto" />
    </>
  );
}

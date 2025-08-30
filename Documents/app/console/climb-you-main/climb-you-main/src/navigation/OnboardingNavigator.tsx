import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import GoalInputScreen from '../screens/onboarding/GoalInputScreen';
import ProfileQuestionsScreen from '../screens/onboarding/ProfileQuestionsScreen';
import QuestPreferencesScreen from '../screens/onboarding/QuestPreferencesScreen';

export interface OnboardingData {
  goal: string;
  period: number;
  intensity: string;
  answers: { [key: number]: string };
  freeTextAnswers: { [key: number]: string };
  preferences: { [key: number]: 'love' | 'like' | 'dislike' };
}

export type OnboardingStackParamList = {
  GoalInput: undefined;
  ProfileQuestions: {
    goalData: {
      goal: string;
      period: number;
      intensity: string;
    };
  };
  QuestPreferences: {
    goalData: {
      goal: string;
      period: number;
      intensity: string;
    };
    profileData: {
      answers: { [key: number]: string };
      freeTextAnswers: { [key: number]: string };
    };
  };
};

const Stack = createStackNavigator<OnboardingStackParamList>();

interface OnboardingNavigatorProps {
  onComplete: () => void;
}

export default function OnboardingNavigator({ onComplete }: OnboardingNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="GoalInput" component={GoalInputScreen} />
        <Stack.Screen name="ProfileQuestions" component={ProfileQuestionsScreen} />
        <Stack.Screen name="QuestPreferences">
          {(props) => <QuestPreferencesScreen {...props} onComplete={onComplete} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
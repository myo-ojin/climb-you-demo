import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { OnboardingStackParamList, OnboardingData } from '../../navigation/OnboardingNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';

type QuestPreferencesScreenNavigationProp = StackNavigationProp<OnboardingStackParamList, 'QuestPreferences'>;
type QuestPreferencesScreenRouteProp = RouteProp<OnboardingStackParamList, 'QuestPreferences'>;

interface QuestPreferencesScreenProps {
  navigation: QuestPreferencesScreenNavigationProp;
  route: QuestPreferencesScreenRouteProp;
  onComplete: () => void;
}

interface SampleQuest {
  id: number;
  title: string;
  description: string;
  category: string;
  emoji: string;
}

const SAMPLE_QUESTS: SampleQuest[] = [
  {
    id: 1,
    title: "毎朝5分の瞑想",
    description: "心を落ち着けて1日をスタートする習慣を身につけましょう",
    category: "マインドフルネス",
    emoji: "🧘‍♀️"
  },
  {
    id: 2,
    title: "週3回のジムトレーニング",
    description: "体力向上と健康維持のために定期的な運動を習慣化しましょう",
    category: "フィットネス",
    emoji: "💪"
  },
  {
    id: 3,
    title: "毎日英単語10個暗記",
    description: "継続的な学習で語彙力を向上させ、英語力アップを目指しましょう",
    category: "学習",
    emoji: "📚"
  },
  {
    id: 4,
    title: "週末に友人と会う時間を作る",
    description: "人間関係を大切にし、社交的な時間を定期的に確保しましょう",
    category: "コミュニケーション",
    emoji: "🤝"
  }
];

type PreferenceRating = 'love' | 'like' | 'dislike' | null;

export default function QuestPreferencesScreen({ navigation, route, onComplete }: QuestPreferencesScreenProps) {
  const { goalData, profileData } = route.params;
  const [preferences, setPreferences] = useState<{ [key: number]: PreferenceRating }>({});

  const handlePreferenceSelect = (questId: number, rating: PreferenceRating) => {
    setPreferences(prev => ({
      ...prev,
      [questId]: rating
    }));
  };

  const answeredCount = Object.keys(preferences).length;
  const isComplete = answeredCount === SAMPLE_QUESTS.length;

  const handleComplete = async () => {
    if (isComplete) {
      try {
        const onboardingData: OnboardingData = {
          goal: goalData.goal,
          period: goalData.period,
          intensity: goalData.intensity,
          answers: profileData.answers,
          freeTextAnswers: profileData.freeTextAnswers,
          preferences
        };
        
        await AsyncStorage.setItem('onboarding_data', JSON.stringify(onboardingData));
        console.log('Onboarding completed! Data saved:', onboardingData);
        
        onComplete();
      } catch (error) {
        console.error('Error saving onboarding data:', error);
        onComplete();
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.progressText}>Step 3 / 3</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>クエストの好みを教えてください</Text>
          <Text style={styles.subtitle}>
            回答済み: {answeredCount} / {SAMPLE_QUESTS.length}
          </Text>
        </View>

        {/* Quest Cards */}
        <View style={styles.content}>
          {SAMPLE_QUESTS.map((quest) => (
            <View key={quest.id} style={styles.questCard}>
              {/* Quest Header */}
              <View style={styles.questHeader}>
                <View style={styles.questInfo}>
                  <View style={styles.questTitleContainer}>
                    <Text style={styles.questTitle}>{quest.title}</Text>
                    <Text style={styles.questCategory}>{quest.category}</Text>
                  </View>
                </View>
              </View>

              {/* Quest Description */}
              <Text style={styles.questDescription}>{quest.description}</Text>

              {/* Trail Selection Bar */}
              <View style={styles.trailContainer}>
                <View style={styles.trailPill}>
                  {/* Background Segments */}
                  <View style={styles.trailSegments}>
                    <View style={[styles.segment, styles.loveSegment]} />
                    <View style={[styles.segment, styles.likeSegment]} />
                    <View style={[styles.segment, styles.dislikeSegment]} />
                  </View>
                  
                  {/* Hiker (Active Indicator) */}
                  {preferences[quest.id] && (
                    <View style={[
                      styles.hiker,
                      preferences[quest.id] === 'love' && styles.hikerLeft,
                      preferences[quest.id] === 'like' && styles.hikerCenter,
                      preferences[quest.id] === 'dislike' && styles.hikerRight
                    ]}>
                      <Text style={styles.hikerIcon}>🥾</Text>
                    </View>
                  )}
                  
                  {/* Touch Areas */}
                  <TouchableOpacity 
                    style={[styles.touchArea, { left: 0 }]}
                    onPress={() => handlePreferenceSelect(quest.id, 'love')}
                  />
                  <TouchableOpacity 
                    style={[styles.touchArea, { left: '33.33%' }]}
                    onPress={() => handlePreferenceSelect(quest.id, 'like')}
                  />
                  <TouchableOpacity 
                    style={[styles.touchArea, { left: '66.66%' }]}
                    onPress={() => handlePreferenceSelect(quest.id, 'dislike')}
                  />
                </View>
                
                {/* Labels */}
                <View style={styles.trailLabels}>
                  <Text style={[
                    styles.labelText,
                    preferences[quest.id] === 'love' && styles.activeLabelText
                  ]}>好き</Text>
                  <Text style={[
                    styles.labelText,
                    preferences[quest.id] === 'like' && styles.activeLabelText
                  ]}>様子見</Text>
                  <Text style={[
                    styles.labelText,
                    preferences[quest.id] === 'dislike' && styles.activeLabelText
                  ]}>パス</Text>
                </View>
              </View>
            </View>
          ))}

          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.navigate('ProfileQuestions', { goalData })}
            >
              <Text style={[styles.buttonText, styles.backButtonText]}>戻る</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.completeButton, isComplete && styles.completeButtonActive]}
              onPress={handleComplete}
              disabled={!isComplete}
            >
              <Text style={[
                styles.buttonText,
                isComplete ? styles.completeButtonTextActive : styles.completeButtonTextInactive
              ]}>完了</Text>
            </TouchableOpacity>
          </View>
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
  scrollView: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#F3E7C9',
    borderRadius: 4,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  questCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  questHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  questInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  questTitleContainer: {
    flex: 1,
  },
  questTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  questCategory: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  questDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  trailContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  trailPill: {
    width: '100%',
    height: 44,
    position: 'relative',
  },
  trailSegments: {
    flexDirection: 'row',
    height: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(243, 231, 201, 0.2)',
  },
  segment: {
    flex: 1,
    height: '100%',
  },
  loveSegment: {
    backgroundColor: '#F3E7C9',
    opacity: 0.3,
  },
  likeSegment: {
    backgroundColor: 'rgba(185, 195, 207, 0.1)',
  },
  dislikeSegment: {
    backgroundColor: '#B9C3CF',
    opacity: 0.3,
  },
  hiker: {
    position: 'absolute',
    top: 8,
    width: 28,
    height: 28,
    backgroundColor: '#F3E7C9',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F3E7C9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#0F2A44',
  },
  hikerLeft: {
    left: 8,
  },
  hikerCenter: {
    left: '50%',
    marginLeft: -14,
  },
  hikerRight: {
    right: 8,
  },
  hikerIcon: {
    fontSize: 14,
  },
  touchArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '33.33%',
    left: 0,
  },
  trailLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginTop: 12,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1E3A4B',
    textAlign: 'center',
    flex: 1,
  },
  activeLabelText: {
    color: '#0F2A44',
    fontWeight: '700',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 20,
  },
  backButton: {
    backgroundColor: '#1E3A4B',
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B9C3CF',
  },
  completeButton: {
    backgroundColor: 'rgba(243, 231, 201, 0.3)',
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3E7C9',
  },
  completeButtonActive: {
    backgroundColor: '#F3E7C9',
    shadowColor: '#F3E7C9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButtonText: {
    color: '#F3E7C9',
  },
  completeButtonTextInactive: {
    color: '#F3E7C9',
  },
  completeButtonTextActive: {
    color: '#0F2A44',
  },
});
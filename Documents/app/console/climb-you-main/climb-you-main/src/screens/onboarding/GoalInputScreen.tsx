import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, TextInput, ScrollView } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';

type GoalInputScreenNavigationProp = StackNavigationProp<OnboardingStackParamList, 'GoalInput'>;

interface GoalInputScreenProps {
  navigation: GoalInputScreenNavigationProp;
}

const PERIODS = [
  { label: '1ヶ月', value: 1 },
  { label: '3ヶ月', value: 3 },
  { label: '6ヶ月', value: 6 },
  { label: '1年', value: 12 },
];

const INTENSITIES = [
  { label: '🔥 軽く', value: 'light', description: 'マイペースで取り組む' },
  { label: '🔥🔥 普通に', value: 'moderate', description: '計画的に取り組む' },
  { label: '🔥🔥🔥 本気で！', value: 'intense', description: '全力で取り組む' },
];

export default function GoalInputScreen({ navigation }: GoalInputScreenProps) {
  const [goal, setGoal] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(null);
  const [selectedIntensity, setSelectedIntensity] = useState<string | null>(null);

  const isFormValid = goal.trim().length > 0 && selectedPeriod !== null && selectedIntensity !== null;

  const handleNext = () => {
    if (isFormValid) {
      const goalData = {
        goal: goal.trim(),
        period: selectedPeriod!,
        intensity: selectedIntensity!
      };
      navigation.navigate('ProfileQuestions', { goalData });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '33%' }]} />
          </View>
          <Text style={styles.progressText}>Step 1 / 3</Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.title}>目標を設定しましょう</Text>
          <Text style={styles.subtitle}>山頂を目指して一緒に登りましょう！</Text>

          {/* Goal Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>達成したい目標は？</Text>
            <TextInput
              style={styles.goalInput}
              value={goal}
              onChangeText={setGoal}
              placeholder="例：英語を話せるようになる"
              placeholderTextColor="#999"
              multiline
            />
          </View>

          {/* Period Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>どのくらいの期間で？</Text>
            <View style={styles.optionGrid}>
              {PERIODS.map((period) => (
                <TouchableOpacity
                  key={period.value}
                  style={[
                    styles.optionButton,
                    selectedPeriod === period.value && styles.selectedOption
                  ]}
                  onPress={() => setSelectedPeriod(period.value)}
                >
                  <Text style={[
                    styles.optionText,
                    selectedPeriod === period.value && styles.selectedOptionText
                  ]}>
                    {period.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Intensity Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>どのくらいの熱量で？</Text>
            <View style={styles.intensityContainer}>
              {INTENSITIES.map((intensity) => (
                <TouchableOpacity
                  key={intensity.value}
                  style={[
                    styles.intensityButton,
                    selectedIntensity === intensity.value && styles.selectedIntensity
                  ]}
                  onPress={() => setSelectedIntensity(intensity.value)}
                >
                  <Text style={[
                    styles.intensityLabel,
                    selectedIntensity === intensity.value && styles.selectedIntensityText
                  ]}>
                    {intensity.label}
                  </Text>
                  <Text style={[
                    styles.intensityDescription,
                    selectedIntensity === intensity.value && styles.selectedIntensityText
                  ]}>
                    {intensity.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Next Button */}
          <TouchableOpacity 
            style={[styles.nextButton, isFormValid && styles.nextButtonActive]}
            onPress={handleNext}
            disabled={!isFormValid}
          >
            <Text style={[
              styles.nextButtonText,
              isFormValid ? styles.nextButtonTextActive : styles.nextButtonTextInactive
            ]}>次へ</Text>
          </TouchableOpacity>
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.9,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  goalInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 80,
    textAlignVertical: 'top',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  optionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    flex: 1,
  },
  selectedOption: {
    backgroundColor: '#F3E7C9',
    shadowColor: '#F3E7C9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#0F2A44',
    fontWeight: '600',
  },
  intensityContainer: {
    gap: 12,
  },
  intensityButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedIntensity: {
    backgroundColor: '#F3E7C9',
    shadowColor: '#F3E7C9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  intensityLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  intensityDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectedIntensityText: {
    color: '#0F2A44',
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: 'rgba(243, 231, 201, 0.3)',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#F3E7C9',
  },
  nextButtonActive: {
    backgroundColor: '#F3E7C9',
    shadowColor: '#F3E7C9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextButtonTextInactive: {
    color: '#F3E7C9',
  },
  nextButtonTextActive: {
    color: '#0F2A44',
  },
});
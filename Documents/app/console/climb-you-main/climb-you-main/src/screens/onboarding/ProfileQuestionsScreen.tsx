import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, TextInput, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { OnboardingStackParamList } from '../../navigation/OnboardingNavigator';
import { openaiService, ProfileQuestion } from '../../services/ai/openaiService';
import { firebaseConfig } from '../../services/firebase/config';

type ProfileQuestionsScreenNavigationProp = StackNavigationProp<OnboardingStackParamList, 'ProfileQuestions'>;
type ProfileQuestionsScreenRouteProp = RouteProp<OnboardingStackParamList, 'ProfileQuestions'>;

interface ProfileQuestionsScreenProps {
  navigation: ProfileQuestionsScreenNavigationProp;
  route: ProfileQuestionsScreenRouteProp;
}

interface Question {
  id: number;
  question: string;
  options: string[];
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    question: "あなたの年代は？",
    options: ["10代", "20代", "30代", "40代以上"]
  },
  {
    id: 2,
    question: "現在の職業は？",
    options: ["学生", "会社員", "フリーランス", "その他"]
  },
  {
    id: 3,
    question: "1日の自由時間はどのくらい？",
    options: ["30分未満", "30分〜1時間", "1〜2時間", "2時間以上"]
  },
  {
    id: 4,
    question: "朝型？夜型？",
    options: ["朝型", "やや朝型", "やや夜型", "夜型"]
  },
  {
    id: 5,
    question: "新しいことを始める時の気持ちは？",
    options: ["とても楽しみ", "少し楽しみ", "少し不安", "かなり不安"]
  },
  {
    id: 6,
    question: "目標達成のモチベーションは？",
    options: ["達成感", "周りからの評価", "自己成長", "報酬・ご褒美"]
  },
  {
    id: 7,
    question: "過去に大きな目標を達成した経験は？",
    options: ["たくさんある", "いくつかある", "少しある", "ほとんどない"]
  },
  {
    id: 8,
    question: "困難に直面した時の対処法は？",
    options: ["一人で解決する", "人に相談する", "調べて対策する", "少し休んでから再開"]
  },
  {
    id: 9,
    question: "好きな学習スタイルは？",
    options: ["読書", "動画視聴", "実践・体験", "人との会話"]
  },
  {
    id: 10,
    question: "ストレス発散方法は？",
    options: ["運動", "読書・映画", "友人と話す", "一人の時間"]
  },
  {
    id: 11,
    question: "理想的な休日の過ごし方は？",
    options: ["アクティブに活動", "家でゆっくり", "友人・家族と過ごす", "趣味に没頭"]
  },
  {
    id: 12,
    question: "変化に対する態度は？",
    options: ["変化を楽しむ", "慎重に受け入れる", "必要な時だけ", "変化は苦手"]
  }
];

export default function ProfileQuestionsScreen({ navigation, route }: ProfileQuestionsScreenProps) {
  const { goalData } = route.params;
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [freeTextAnswers, setFreeTextAnswers] = useState<{ [key: number]: string }>({});

  const currentQuestion = QUESTIONS[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;
  const isAnswered = answers[currentQuestion.id] !== undefined;

  const handleOptionSelect = (option: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: option
    }));
  };

  const handleFreeTextChange = (text: string) => {
    setFreeTextAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: text
    }));
  };

  const handleNext = () => {
    if (isLastQuestion) {
      const profileData = {
        answers,
        freeTextAnswers
      };
      navigation.navigate('QuestPreferences', { goalData, profileData });
    } else {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    } else {
      navigation.navigate('GoalInput');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '67%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 / 3</Text>
        </View>

        {/* Question Counter */}
        <View style={styles.questionCounter}>
          <Text style={styles.counterText}>
            質問 {currentQuestionIndex + 1} / {QUESTIONS.length}
          </Text>
          <Text style={styles.purposeText}>より良いクエストのために</Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.title}>あなたのことを教えてください</Text>

          {/* Question Card */}
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.optionButton,
                    answers[currentQuestion.id] === option && styles.selectedOption
                  ]}
                  onPress={() => handleOptionSelect(option)}
                >
                  <Text style={[
                    styles.optionText,
                    answers[currentQuestion.id] === option && styles.selectedOptionText
                  ]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Free Text Input */}
            <View style={styles.freeTextContainer}>
              <Text style={styles.freeTextLabel}>補足があれば自由に記入してください（任意）</Text>
              <TextInput
                style={styles.freeTextInput}
                value={freeTextAnswers[currentQuestion.id] || ''}
                onChangeText={handleFreeTextChange}
                placeholder="その他の理由や詳細があれば..."
                placeholderTextColor="#999"
                multiline
                maxLength={200}
              />
            </View>
          </View>

          {/* Navigation Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={handleBack}
            >
              <Text style={[styles.buttonText, styles.backButtonText]}>戻る</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.nextButton, isAnswered && styles.nextButtonActive]}
              onPress={handleNext}
              disabled={!isAnswered}
            >
              <Text style={[
                styles.buttonText,
                isAnswered ? styles.nextButtonTextActive : styles.nextButtonTextInactive
              ]}>
                {isLastQuestion ? '次へ' : '次の質問'}
              </Text>
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
  questionCounter: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  counterText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  purposeText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
    marginTop: 4,
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
    marginBottom: 30,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  questionText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    backgroundColor: '#F3E7C9',
    borderColor: '#F3E7C9',
    shadowColor: '#F3E7C9',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  selectedOptionText: {
    color: '#0F2A44',
    fontWeight: '600',
  },
  freeTextContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  freeTextLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    textAlign: 'center',
  },
  freeTextInput: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 60,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
  nextButton: {
    backgroundColor: 'rgba(243, 231, 201, 0.3)',
    flex: 2,
    paddingVertical: 16,
    borderRadius: 12,
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
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  backButtonText: {
    color: '#F3E7C9',
  },
  nextButtonTextInactive: {
    color: '#F3E7C9',
  },
  nextButtonTextActive: {
    color: '#0F2A44',
  },
});
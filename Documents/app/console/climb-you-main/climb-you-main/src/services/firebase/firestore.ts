import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { firebaseConfig } from './config';

// Firestore collections
export const COLLECTIONS = {
  USERS: 'users',
  GOALS: 'goals',
  PROFILE_QUESTIONS: 'profileQuestions',
  PROFILE_RESPONSES: 'profileResponses', 
  QUESTS: 'quests',
  QUEST_PREFERENCES: 'questPreferences',
} as const;

// User document interface
export interface UserDocument {
  id: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  isOnboardingCompleted: boolean;
  profile?: {
    name?: string;
    goals?: string[];
    preferences?: Record<string, any>;
  };
}

// Goal document interface
export interface GoalDocument {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  timeframe: string;
  intensity: 'low' | 'medium' | 'high';
  createdAt: FirebaseFirestoreTypes.Timestamp;
  isCompleted: boolean;
}

// Quest document interface  
export interface QuestDocument {
  id: string;
  userId: string;
  goalId?: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number; // in minutes
  isCompleted: boolean;
  completedAt?: FirebaseFirestoreTypes.Timestamp;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  generatedBy: 'ai' | 'template' | 'manual';
}

class FirestoreService {
  private db: FirebaseFirestoreTypes.Module;

  constructor() {
    this.db = firebaseConfig.getFirestore();
  }

  // Generic methods
  private getUserCollection(userId: string) {
    return this.db.collection(COLLECTIONS.USERS).doc(userId);
  }

  private getUserSubCollection(userId: string, collectionName: string) {
    return this.getUserCollection(userId).collection(collectionName);
  }

  // User methods
  async createUser(userId: string, data: Partial<UserDocument>): Promise<void> {
    const timestamp = firestore.Timestamp.now();
    const userData: Omit<UserDocument, 'id'> = {
      createdAt: timestamp,
      updatedAt: timestamp,
      isOnboardingCompleted: false,
      ...data,
    };

    await this.getUserCollection(userId).set(userData);
  }

  async getUser(userId: string): Promise<UserDocument | null> {
    const doc = await this.getUserCollection(userId).get();
    if (!doc.exists) {
      return null;
    }
    return { id: doc.id, ...doc.data() } as UserDocument;
  }

  async updateUser(userId: string, data: Partial<UserDocument>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: firestore.Timestamp.now(),
    };
    await this.getUserCollection(userId).update(updateData);
  }

  // Goal methods
  async createGoal(userId: string, goalData: Omit<GoalDocument, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const timestamp = firestore.Timestamp.now();
    const goal: Omit<GoalDocument, 'id'> = {
      userId,
      createdAt: timestamp,
      isCompleted: false,
      ...goalData,
    };

    const docRef = await this.getUserSubCollection(userId, COLLECTIONS.GOALS).add(goal);
    return docRef.id;
  }

  async getUserGoals(userId: string): Promise<GoalDocument[]> {
    const snapshot = await this.getUserSubCollection(userId, COLLECTIONS.GOALS)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as GoalDocument[];
  }

  // Quest methods
  async createQuest(userId: string, questData: Omit<QuestDocument, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const timestamp = firestore.Timestamp.now();
    const quest: Omit<QuestDocument, 'id'> = {
      userId,
      createdAt: timestamp,
      isCompleted: false,
      ...questData,
    };

    const docRef = await this.getUserSubCollection(userId, COLLECTIONS.QUESTS).add(quest);
    return docRef.id;
  }

  async getUserQuests(userId: string, limit: number = 10): Promise<QuestDocument[]> {
    const snapshot = await this.getUserSubCollection(userId, COLLECTIONS.QUESTS)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as QuestDocument[];
  }

  async updateQuest(userId: string, questId: string, updates: Partial<QuestDocument>): Promise<void> {
    await this.getUserSubCollection(userId, COLLECTIONS.QUESTS)
      .doc(questId)
      .update(updates);
  }

  async completeQuest(userId: string, questId: string): Promise<void> {
    await this.updateQuest(userId, questId, {
      isCompleted: true,
      completedAt: firestore.Timestamp.now(),
    });
  }

  // Profile responses
  async saveProfileResponse(
    userId: string, 
    questionId: string, 
    response: any
  ): Promise<void> {
    const responseData = {
      userId,
      questionId,
      response,
      createdAt: firestore.Timestamp.now(),
    };

    await this.getUserSubCollection(userId, COLLECTIONS.PROFILE_RESPONSES)
      .doc(questionId)
      .set(responseData);
  }

  async getUserProfileResponses(userId: string): Promise<any[]> {
    const snapshot = await this.getUserSubCollection(userId, COLLECTIONS.PROFILE_RESPONSES)
      .orderBy('createdAt', 'asc')
      .get();

    return snapshot.docs.map(doc => doc.data());
  }
}

export const firestoreService = new FirestoreService();
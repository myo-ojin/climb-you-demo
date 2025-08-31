import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  setDoc, 
  query, 
  orderBy, 
  limit, 
  where, 
  Timestamp,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
  createdAt: Timestamp;
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
  completedAt?: Timestamp;
  createdAt: Timestamp;
  generatedBy: 'ai' | 'template' | 'manual';
}

class FirestoreService {
  private get db() {
    return firebaseConfig.getFirestore();
  }

  // Generic methods
  private getUserDoc(userId: string) {
    return doc(this.db, COLLECTIONS.USERS, userId);
  }

  private getUserSubCollection(userId: string, collectionName: string) {
    return collection(this.db, COLLECTIONS.USERS, userId, collectionName);
  }

  // User methods
  async createUser(userId: string, data: Partial<UserDocument>): Promise<void> {
    const timestamp = Timestamp.now();
    const userData: Omit<UserDocument, 'id'> = {
      createdAt: timestamp,
      updatedAt: timestamp,
      isOnboardingCompleted: false,
      ...data,
    };

    await setDoc(this.getUserDoc(userId), userData);
  }

  async getUser(userId: string): Promise<UserDocument | null> {
    const docSnap = await getDoc(this.getUserDoc(userId));
    if (!docSnap.exists()) {
      return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as UserDocument;
  }

  async updateUser(userId: string, data: Partial<UserDocument>): Promise<void> {
    const updateData = {
      ...data,
      updatedAt: Timestamp.now(),
    };
    await updateDoc(this.getUserDoc(userId), updateData);
  }

  // Goal methods
  async createGoal(userId: string, goalData: Omit<GoalDocument, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const timestamp = Timestamp.now();
    const goal: Omit<GoalDocument, 'id'> = {
      userId,
      createdAt: timestamp,
      isCompleted: false,
      ...goalData,
    };

    const docRef = await addDoc(this.getUserSubCollection(userId, COLLECTIONS.GOALS), goal);
    return docRef.id;
  }

  async getUserGoals(userId: string): Promise<GoalDocument[]> {
    const q = query(
      this.getUserSubCollection(userId, COLLECTIONS.GOALS),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as GoalDocument[];
  }

  // Quest methods
  async createQuest(userId: string, questData: Omit<QuestDocument, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const timestamp = Timestamp.now();
    const quest: Omit<QuestDocument, 'id'> = {
      userId,
      createdAt: timestamp,
      isCompleted: false,
      ...questData,
    };

    const docRef = await addDoc(this.getUserSubCollection(userId, COLLECTIONS.QUESTS), quest);
    return docRef.id;
  }

  async getUserQuests(userId: string, limitCount: number = 10): Promise<QuestDocument[]> {
    const q = query(
      this.getUserSubCollection(userId, COLLECTIONS.QUESTS),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as QuestDocument[];
  }

  async updateQuest(userId: string, questId: string, updates: Partial<QuestDocument>): Promise<void> {
    const questDoc = doc(this.getUserSubCollection(userId, COLLECTIONS.QUESTS), questId);
    await updateDoc(questDoc, updates);
  }

  async completeQuest(userId: string, questId: string): Promise<void> {
    await this.updateQuest(userId, questId, {
      isCompleted: true,
      completedAt: Timestamp.now(),
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
      createdAt: Timestamp.now(),
    };

    const responseDoc = doc(this.getUserSubCollection(userId, COLLECTIONS.PROFILE_RESPONSES), questionId);
    await setDoc(responseDoc, responseData);
  }

  async getUserProfileResponses(userId: string): Promise<any[]> {
    const q = query(
      this.getUserSubCollection(userId, COLLECTIONS.PROFILE_RESPONSES),
      orderBy('createdAt', 'asc')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => doc.data());
  }
}

export const firestoreService = new FirestoreService();
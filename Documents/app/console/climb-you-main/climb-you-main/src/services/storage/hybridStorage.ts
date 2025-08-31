import AsyncStorage from '@react-native-async-storage/async-storage';
import { firestoreService, UserDocument, GoalDocument, QuestDocument } from '../firebase/firestore';
import { firebaseConfig } from '../firebase/config';

export interface StorageSyncStatus {
  lastSyncAt?: Date;
  pendingSync: boolean;
  hasUnsyncedChanges: boolean;
}

class HybridStorageService {
  private readonly STORAGE_KEYS = {
    USER_DATA: 'user_data',
    GOALS: 'goals',
    QUESTS: 'quests',
    SYNC_STATUS: 'sync_status',
  } as const;

  private syncInProgress = false;

  async initialize(): Promise<void> {
    await firebaseConfig.initialize();
    await this.attemptSync();
  }

  async saveUserData(userData: UserDocument): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
      await this.markPendingSync();
      await this.attemptSync();
    } catch (error) {
      console.error('Failed to save user data locally:', error);
    }
  }

  async getUserData(): Promise<UserDocument | null> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get user data from local storage:', error);
      return null;
    }
  }

  async saveGoals(goals: GoalDocument[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.GOALS, JSON.stringify(goals));
      await this.markPendingSync();
      await this.attemptSync();
    } catch (error) {
      console.error('Failed to save goals locally:', error);
    }
  }

  async getGoals(): Promise<GoalDocument[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEYS.GOALS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get goals from local storage:', error);
      return [];
    }
  }

  async saveQuests(quests: QuestDocument[]): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.QUESTS, JSON.stringify(quests));
      await this.markPendingSync();
      await this.attemptSync();
    } catch (error) {
      console.error('Failed to save quests locally:', error);
    }
  }

  async getQuests(): Promise<QuestDocument[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEYS.QUESTS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get quests from local storage:', error);
      return [];
    }
  }

  async createGoal(goalData: Omit<GoalDocument, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const user = firebaseConfig.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const tempId = `temp_${Date.now()}`;
    const timestamp = new Date();
    
    const goal: GoalDocument = {
      id: tempId,
      userId: user.uid,
      createdAt: timestamp as any,
      isCompleted: false,
      ...goalData,
    };

    const currentGoals = await this.getGoals();
    await this.saveGoals([...currentGoals, goal]);

    return tempId;
  }

  async createQuest(questData: Omit<QuestDocument, 'id' | 'userId' | 'createdAt'>): Promise<string> {
    const user = firebaseConfig.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const tempId = `temp_${Date.now()}`;
    const timestamp = new Date();
    
    const quest: QuestDocument = {
      id: tempId,
      userId: user.uid,
      createdAt: timestamp as any,
      isCompleted: false,
      ...questData,
    };

    const currentQuests = await this.getQuests();
    await this.saveQuests([...currentQuests, quest]);

    return tempId;
  }

  async getSyncStatus(): Promise<StorageSyncStatus> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEYS.SYNC_STATUS);
      if (data) {
        const status = JSON.parse(data);
        return {
          ...status,
          lastSyncAt: status.lastSyncAt ? new Date(status.lastSyncAt) : undefined,
        };
      }
      return {
        pendingSync: false,
        hasUnsyncedChanges: false,
      };
    } catch (error) {
      console.error('Failed to get sync status:', error);
      return {
        pendingSync: false,
        hasUnsyncedChanges: false,
      };
    }
  }

  private async markPendingSync(): Promise<void> {
    const status: StorageSyncStatus = {
      pendingSync: true,
      hasUnsyncedChanges: true,
    };
    
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.SYNC_STATUS, JSON.stringify(status));
    } catch (error) {
      console.error('Failed to mark pending sync:', error);
    }
  }

  private async markSyncCompleted(): Promise<void> {
    const status: StorageSyncStatus = {
      lastSyncAt: new Date(),
      pendingSync: false,
      hasUnsyncedChanges: false,
    };
    
    try {
      await AsyncStorage.setItem(this.STORAGE_KEYS.SYNC_STATUS, JSON.stringify(status));
    } catch (error) {
      console.error('Failed to mark sync completed:', error);
    }
  }

  async attemptSync(): Promise<boolean> {
    if (this.syncInProgress) {
      return false;
    }

    const user = firebaseConfig.getCurrentUser();
    if (!user) {
      return false;
    }

    const syncStatus = await this.getSyncStatus();
    if (!syncStatus.pendingSync && !syncStatus.hasUnsyncedChanges) {
      return true;
    }

    this.syncInProgress = true;
    
    try {
      const userData = await this.getUserData();
      if (userData) {
        await firestoreService.updateUser(user.uid, userData);
      }

      const goals = await this.getGoals();
      for (const goal of goals) {
        if (goal.id.startsWith('temp_')) {
          const { id, ...goalData } = goal;
          const newId = await firestoreService.createGoal(user.uid, goalData);
          
          const updatedGoals = goals.map(g => 
            g.id === id ? { ...g, id: newId } : g
          );
          await this.saveGoals(updatedGoals);
        }
      }

      const quests = await this.getQuests();
      for (const quest of quests) {
        if (quest.id.startsWith('temp_')) {
          const { id, ...questData } = quest;
          const newId = await firestoreService.createQuest(user.uid, questData);
          
          const updatedQuests = quests.map(q => 
            q.id === id ? { ...q, id: newId } : q
          );
          await this.saveQuests(updatedQuests);
        }
      }

      await this.pullFromFirestore();
      await this.markSyncCompleted();
      
      console.log('🔄 Sync completed successfully');
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  private async pullFromFirestore(): Promise<void> {
    const user = firebaseConfig.getCurrentUser();
    if (!user) return;

    try {
      const [firestoreUser, firestoreGoals, firestoreQuests] = await Promise.all([
        firestoreService.getUser(user.uid),
        firestoreService.getUserGoals(user.uid),
        firestoreService.getUserQuests(user.uid, 50),
      ]);

      if (firestoreUser) {
        await AsyncStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(firestoreUser));
      }

      await AsyncStorage.setItem(this.STORAGE_KEYS.GOALS, JSON.stringify(firestoreGoals));
      await AsyncStorage.setItem(this.STORAGE_KEYS.QUESTS, JSON.stringify(firestoreQuests));
    } catch (error) {
      console.error('Failed to pull data from Firestore:', error);
    }
  }

  async forceSync(): Promise<boolean> {
    await this.markPendingSync();
    return await this.attemptSync();
  }

  async clearLocalData(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(this.STORAGE_KEYS.USER_DATA),
        AsyncStorage.removeItem(this.STORAGE_KEYS.GOALS),
        AsyncStorage.removeItem(this.STORAGE_KEYS.QUESTS),
        AsyncStorage.removeItem(this.STORAGE_KEYS.SYNC_STATUS),
      ]);
      console.log('Local data cleared');
    } catch (error) {
      console.error('Failed to clear local data:', error);
    }
  }
}

export const hybridStorageService = new HybridStorageService();
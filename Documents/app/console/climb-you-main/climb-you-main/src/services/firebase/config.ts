import { initializeApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Firebase configuration will be automatically loaded from 
// google-services.json (Android) and GoogleService-Info.plist (iOS)

class FirebaseConfig {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Firebase with default configuration
      // The app will automatically use google-services.json / GoogleService-Info.plist
      
      // Enable Firestore offline persistence for better UX
      await firestore().settings({
        persistence: true,
        cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
      });

      this.initialized = true;
      console.log('🔥 Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      throw error;
    }
  }

  // Get authenticated user
  getCurrentUser() {
    return auth().currentUser;
  }

  // Sign in anonymously
  async signInAnonymously() {
    try {
      const userCredential = await auth().signInAnonymously();
      console.log('👤 Anonymous user signed in:', userCredential.user.uid);
      return userCredential.user;
    } catch (error) {
      console.error('❌ Anonymous sign-in failed:', error);
      throw error;
    }
  }

  // Get Firestore instance
  getFirestore() {
    return firestore();
  }

  // Get Auth instance
  getAuth() {
    return auth();
  }
}

export const firebaseConfig = new FirebaseConfig();
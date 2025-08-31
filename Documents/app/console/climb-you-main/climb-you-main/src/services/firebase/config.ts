import { initializeApp, FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, User, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Firebase Web SDK configuration
const firebaseConfigOptions = {
  apiKey: "AIzaSyA5NYiLumrLCKly42S4GNmOyl2sfgw-AkA",
  authDomain: "climb-you.firebaseapp.com",
  projectId: "climb-you",
  storageBucket: "climb-you.firebasestorage.app",
  messagingSenderId: "930082383478",
  appId: "1:930082383478:android:e2943e45db8225a798a157"
};

class FirebaseConfig {
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private firestore: Firestore | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize Firebase Web SDK
      this.app = initializeApp(firebaseConfigOptions);
      this.auth = getAuth(this.app);
      this.firestore = getFirestore(this.app);

      this.initialized = true;
      console.log('🔥 Firebase Web SDK initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase:', error);
      throw error;
    }
  }

  // Get authenticated user
  getCurrentUser(): User | null {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    return this.auth.currentUser;
  }

  // Sign in anonymously
  async signInAnonymously(): Promise<User> {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }

    try {
      const userCredential = await signInAnonymously(this.auth);
      console.log('👤 Anonymous user signed in:', userCredential.user.uid);
      return userCredential.user;
    } catch (error) {
      console.error('❌ Anonymous sign-in failed:', error);
      throw error;
    }
  }

  // Get Firestore instance
  getFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firebase not initialized');
    }
    return this.firestore;
  }

  // Get Auth instance
  getAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase not initialized');
    }
    return this.auth;
  }
}

export const firebaseConfig = new FirebaseConfig();
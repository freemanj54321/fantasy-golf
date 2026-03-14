import { initializeApp, FirebaseApp } from "firebase/app";
import { initializeFirestore, Firestore, persistentLocalCache } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// Firebase configuration from environment variables
const getFirebaseConfig = () => {
  const env = (import.meta as any).env;

  return {
    apiKey: env?.VITE_FIREBASE_API_KEY,
    authDomain: env?.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env?.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env?.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env?.VITE_FIREBASE_APP_ID,
    measurementId: env?.VITE_FIREBASE_MEASUREMENT_ID
  };
};

// Connection state
class FirebaseConnection {
  private app: FirebaseApp;
  private _db: Firestore;
  private _storage: FirebaseStorage;
  private _auth: Auth;
  private _isConnected: boolean = true;
  private _listeners: Set<(connected: boolean) => void> = new Set();

  constructor() {
    const config = getFirebaseConfig();

    // Validate configuration
    if (!config.apiKey || !config.projectId) {
      throw new Error('Firebase configuration is incomplete. Check your environment variables.');
    }

    this.app = initializeApp(config);
    this._db = initializeFirestore(this.app, { localCache: persistentLocalCache() });
    this._storage = getStorage(this.app);
    this._auth = getAuth(this.app);
  }

  get db(): Firestore {
    return this._db;
  }

  get storage(): FirebaseStorage {
    return this._storage;
  }

  get auth(): Auth {
    return this._auth;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  // Subscribe to connection state changes
  onConnectionChange(callback: (connected: boolean) => void): () => void {
    this._listeners.add(callback);
    // Return unsubscribe function
    return () => {
      this._listeners.delete(callback);
    };
  }

  private notifyListeners(connected: boolean) {
    this._isConnected = connected;
    this._listeners.forEach(callback => callback(connected));
  }

  // Monitor online/offline status
  startMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[Firebase] Connection restored');
        this.notifyListeners(true);
      });

      window.addEventListener('offline', () => {
        console.warn('[Firebase] Connection lost');
        this.notifyListeners(false);
      });
    }
  }
}

// Create singleton instance
const firebaseConnection = new FirebaseConnection();
firebaseConnection.startMonitoring();

// Export instances
export const db = firebaseConnection.db;
export const storage = firebaseConnection.storage;
export const auth = firebaseConnection.auth;

// Export connection utilities
export const isFirebaseConnected = () => firebaseConnection.isConnected;
export const onFirebaseConnectionChange = (callback: (connected: boolean) => void) =>
  firebaseConnection.onConnectionChange(callback);

// Export for testing/debugging
export const getFirebaseConnection = () => firebaseConnection;

import { initializeApp } from 'firebase/app';
import { initializeAuth, 
    //@ts-ignore
    getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../src/lib/secret-keys';

const app = initializeApp(firebaseConfig);

// Force type assertion for getReactNativePersistence
const persistence = getReactNativePersistence(AsyncStorage) as any;

const auth = initializeAuth(app, {
  persistence
});

const db = getFirestore(app);

export { auth, db };
export default app;
// src/services/authService.ts
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "../../firebase/config";
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUTH_STATE: '@auth_state',
  USER_DATA: '@user_data',
  AUTH_CREDENTIALS: '@auth_credentials'
};

interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

interface StoredUserData {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  lastLoginAt: string;
  credentials?: {
    email: string;
    pin: string;
  };
}

export const persistUserData = async (user: User, credentials?: { email: string; pin: string }) => {
  try {
    const userData: StoredUserData = {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      lastLoginAt: new Date().toISOString(),
      ...(credentials && { credentials })
    };

    await AsyncStorage.multiSet([
      [STORAGE_KEYS.USER_DATA, JSON.stringify(userData)],
      [STORAGE_KEYS.AUTH_STATE, 'authenticated']
    ]);

    if (credentials) {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_CREDENTIALS, JSON.stringify(credentials));
    }
  } catch (error) {
    console.error('Error persisting user data:', error);
  }
};

export const signUp = async (email: string, pin: string): Promise<AuthResponse> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pin);
    await persistUserData(result.user, { email, pin });
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const login = async (email: string, pin: string): Promise<AuthResponse> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pin);
    await persistUserData(result.user, { email, pin });
    return { success: true, user: result.user };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const logout = async (): Promise<void> => {
  try {
    await signOut(auth);
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_STATE,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.AUTH_CREDENTIALS
    ]);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

export const getStoredCredentials = async () => {
  try {
    const credentials = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_CREDENTIALS);
    return credentials ? JSON.parse(credentials) : null;
  } catch (error) {
    console.error('Error getting stored credentials:', error);
    return null;
  }
};

export const getAuthState = async (): Promise<StoredUserData | null> => {
  try {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Error getting auth state:', error);
    return null;
  }
};

export const autoLogin = async (): Promise<AuthResponse> => {
  try {
    const credentials = await getStoredCredentials();
    if (credentials) {
      return await login(credentials.email, credentials.pin);
    }
    return { success: false, error: 'No stored credentials' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_IP } from '../config/config';

// const SERVER_IP = "192.168.1.107";

type Language = {
  code: string;
  name: string;
};

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी' }
];

interface TranslationContextType {
  targetLanguage: string;
  setTargetLanguage: (lang: string) => Promise<void>;
  supportedLanguages: Language[];
  translateText: (text: string) => Promise<string>;
  isLoading: boolean;
  error: string | null;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

const getStoredLanguage = async (): Promise<string> => {
  try {
    const lang = await AsyncStorage.getItem('targetLanguage');
    return lang || 'en';
  } catch {
    return 'en';
  }
};

const defaultTranslations = {
  distance: {
    en: 'Distance',
    hi: 'दूरी'
  },
  centimeters: {
    en: 'cm',
    hi: 'सेंटीमीटर'
  }
};

const DEBOUNCE_TIME = 300;

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [isChanging, setIsChanging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        setIsLoading(true);
        const storedLang = await getStoredLanguage();
        setTargetLanguage(storedLang);
      } catch (error) {
        setError('Failed to load language settings');
        console.error('Load language error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadLanguage();
  }, []);

  const translateText = useCallback(async (text: string): Promise<string> => {
    if (!text || targetLanguage === 'en') {
      return text;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://${SERVER_IP}:8000/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target_lang: targetLanguage
        })
      });

      if (!response.ok) {
        throw new Error(`Translation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.translated_text || text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Translation failed';
      setError(errorMessage);
      console.error('Translation error:', error);
      return text;
    } finally {
      setIsLoading(false);
    }
  }, [targetLanguage, SERVER_IP]);

  const handleSetTargetLanguage = async (lang: string): Promise<void> => {
    if (isChanging) return;
    
    setIsChanging(true);
    setError(null);

    try {
      if (lang !== targetLanguage) {
        await AsyncStorage.setItem('targetLanguage', lang);
        setTargetLanguage(lang);
      }
    } catch (error) {
      setError('Failed to save language setting');
      console.error('Error saving language:', error);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <TranslationContext.Provider value={{
      targetLanguage,
      setTargetLanguage: handleSetTargetLanguage,
      supportedLanguages: SUPPORTED_LANGUAGES,
      translateText,
      isLoading,
      error
    }}>
      {children}
    </TranslationContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
};


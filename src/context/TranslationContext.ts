import React, { createContext, useContext, useState, useEffect } from 'react';
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

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [isChanging, setIsChanging] = useState(false);
  useEffect(() => {
    const loadLanguage = async () => {
      const storedLang = await getStoredLanguage();
      setTargetLanguage(storedLang);
    };
    loadLanguage();
  }, []);

  const translateText = async (text: string): Promise<string> => {
    if (!text || targetLanguage === 'en') {
      return text;
    }

    try {
      const response = await fetch(`http://${SERVER_IP}:8000/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          target_lang: targetLanguage
        })
      });

      if (!response.ok) throw new Error('Translation failed');
      
      const data = await response.json();
      return data.translated_text || text;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    }
  };

  const handleSetTargetLanguage = async (lang: string): Promise<void> => {
    if (isChanging) return;
    
    try {
      setIsChanging(true);

      if (lang !== targetLanguage) {
        setTargetLanguage(lang);
        await AsyncStorage.setItem('targetLanguage', lang);
        console.log(`Language saved to storage: ${lang}`);
      }
    } catch (error) {
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
      translateText
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


import { useCallback } from 'react';
import { useTranslation } from '../context/TranslationContext';
import { speak } from '../utils/speech';

export const useSpeech = () => {
  const { targetLanguage } = useTranslation();

  const speakText = useCallback(async (text: string) => {
    await speak(text, targetLanguage);
  }, [targetLanguage]);

  return speakText;
};
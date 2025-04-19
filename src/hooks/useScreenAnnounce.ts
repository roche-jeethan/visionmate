import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from '../context/TranslationContext';
import { useSpeech } from './useSpeech';

export const useScreenAnnounce = (screenName: string) => {
  const { translateText } = useTranslation();
  const speakText = useSpeech();

  useFocusEffect(
    useCallback(() => {
      const announceScreen = async () => {
        const translatedName = await translateText(screenName);
        await speakText(`${translatedName} Screen`);
      };
      announceScreen();
    }, [screenName, translateText, speakText])
  );
};
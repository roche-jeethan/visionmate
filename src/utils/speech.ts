import * as Speech from 'expo-speech';

export const speak = async (text: string, language: string = 'en-US') => {
  if (!text) {
    console.warn('No text provided for speech');
    return;
  }

  try {
    await Speech.stop();
    
    const languageMap: { [key: string]: string } = {
      'en': 'en-US',
      'hi': 'hi-IN'
    };

    const options = {
      language: languageMap[language] || 'en-US',
      pitch: 1.0,
      rate: 0.9,
    };

    const isSupportedLanguage = await Speech.isSpeakingAsync();
    if (!isSupportedLanguage) {
      console.warn(`Language ${language} might not be supported`);
    }

    await Speech.speak(text, options);
  } catch (error) {
    console.error('Speech error:', error);
    throw new Error('Failed to speak text');
  }
};
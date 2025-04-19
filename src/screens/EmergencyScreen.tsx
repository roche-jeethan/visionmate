import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from '../context/TranslationContext';
import { useSpeech } from '../hooks/useSpeech';

export default function EmergencyScreen() {
  const { translateText, isLoading } = useTranslation();
  const speakText = useSpeech();
  const [translatedText, setTranslatedText] = React.useState('Emergency Screen');

  useEffect(() => {
    const translateAndSetText = async () => {
      const translated = await translateText('Emergency Screen');
      setTranslatedText(translated);
    };
    translateAndSetText();
  }, [translateText]);

  const handlePress = async () => {
    await speakText(translatedText);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handlePress}>
        {isLoading ? (
          <Text style={styles.text}>Loading...</Text>
        ) : (
          <Text style={styles.text}>{translatedText}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 24,
    color: '#333',
    padding: 20,
  },
});

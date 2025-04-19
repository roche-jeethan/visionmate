import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFallDetection } from '../../hooks/useFallDetection';
import { useTranslation } from '../../context/TranslationContext';
import { useSpeech } from '../../hooks/useSpeech';

interface FallDetectionProps {
  onFallDetected: () => Promise<void>;
}

const FallDetection: React.FC<FallDetectionProps> = ({ onFallDetected }) => {
  const { isMonitoring, accelerometerData } = useFallDetection(onFallDetected);
  const { translateText } = useTranslation();
  const speakText = useSpeech();
  const [translatedText, setTranslatedText] = React.useState({ title: '', status: '' });

  React.useEffect(() => {
    const updateTranslations = async () => {
      const title = await translateText('Fall Detection');
      const status = await translateText(isMonitoring ? 'Active' : 'Inactive');
      setTranslatedText({ title, status });
    };
    updateTranslations();
  }, [isMonitoring, translateText]);

  return (
    <View style={styles.container}>
      <Text style={styles.status}>
        {translatedText.title}: {translatedText.status}
      </Text>
      <Text style={styles.data}>
        X: {accelerometerData.x.toFixed(2)}
        Y: {accelerometerData.y.toFixed(2)}
        Z: {accelerometerData.z.toFixed(2)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  data: {
    fontSize: 14,
    marginTop: 5,
  },
});

export default FallDetection;
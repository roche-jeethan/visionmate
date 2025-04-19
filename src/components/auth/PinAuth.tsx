import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../context/TranslationContext';
import { useSpeech } from '../../hooks/useSpeech';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PinAuthProps {
  onAuthSuccess: () => void;
}

export const PinAuth: React.FC<PinAuthProps> = ({ onAuthSuccess }) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const { targetLanguage } = useTranslation();
  const speakText = useSpeech();

  const PIN_LENGTH = 4;
  const STORED_PIN_KEY = '@app_pin';

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'delete'];

  const handleNumber = async (num: number | string) => {
    if (num === 'delete') {
      setPin(prev => prev.slice(0, -1));
      return;
    }

    if (typeof num === 'number') {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === PIN_LENGTH) {
        const storedPin = await AsyncStorage.getItem(STORED_PIN_KEY);
        
        if (!storedPin) {
          // First time setup
          await AsyncStorage.setItem(STORED_PIN_KEY, newPin);
          onAuthSuccess();
        } else if (storedPin === newPin) {
          onAuthSuccess();
        } else {
          const errorText = targetLanguage === 'hi' 
            ? 'गलत पिन। पुनः प्रयास करें।' 
            : 'Incorrect PIN. Please try again.';
          setError(errorText);
          speakText(errorText);
          setPin('');
        }
      }
    }
  };

  const dots = Array(PIN_LENGTH).fill(0).map((_, i) => (
    <View 
      key={i} 
      style={[
        styles.dot, 
        i < pin.length ? styles.dotFilled : null
      ]} 
    />
  ));

  return (
    <View style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.title}>
          {targetLanguage === 'hi' ? 'पिन दर्ज करें' : 'Enter PIN'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.dotsContainer}>{dots}</View>

      <View style={styles.keypad}>
        {numbers.map((num, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.key,
              num === '' ? styles.keyDisabled : null
            ]}
            onPress={() => handleNumber(num)}
            disabled={num === ''}
          >
            {num === 'delete' ? (
              <Ionicons name="backspace-outline" size={24} color="#fff" />
            ) : (
              <Text style={styles.keyText}>{num}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const { width } = Dimensions.get('window');
const keySize = width * 0.2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
  },
  titleContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 10,
  },
  error: {
    color: '#ff4444',
    marginTop: 10,
  },
  dotsContainer: {
    flexDirection: 'row',
    marginVertical: 30,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#fff',
    marginHorizontal: 10,
  },
  dotFilled: {
    backgroundColor: '#fff',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: width * 0.8,
  },
  key: {
    width: keySize,
    height: keySize,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: keySize / 2,
    margin: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  keyDisabled: {
    backgroundColor: 'transparent',
  },
  keyText: {
    fontSize: 28,
    color: '#fff',
  },
});
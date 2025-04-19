import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { useTranslation } from '../../context/TranslationContext';
import { useSpeech } from '../../hooks/useSpeech';
import { Ionicons } from '@expo/vector-icons';
import { PinAuth } from './PinAuth';

interface BiometricAuthProps {
  onAuthSuccess: () => void;
}

export const BiometricAuth: React.FC<BiometricAuthProps> = ({ onAuthSuccess }) => {
  const { isBiometricAvailable, authenticate } = useBiometricAuth();
  const { targetLanguage } = useTranslation();
  const speakText = useSpeech();
  const [showPin, setShowPin] = useState(false);

  const handleAuth = async () => {
    const success = await authenticate();
    if (success) {
      onAuthSuccess();
    }
  };

  const authButtonText = targetLanguage === 'hi' 
    ? 'फिंगरप्रिंट से लॉगिन करें' 
    : 'Login with Fingerprint';

  const pinButtonText = targetLanguage === 'hi'
    ? 'पिन के साथ लॉगिन करें'
    : 'Login with PIN';

  const welcomeText = targetLanguage === 'hi' 
    ? 'वीजनमेट में आपका स्वागत है' 
    : 'Welcome to VisionMate';

  if (showPin) {
    return <PinAuth 
      onAuthSuccess={onAuthSuccess} 
      onSwitchToFingerprint={() => setShowPin(false)}
    />;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => speakText(welcomeText)}
        style={styles.titleContainer}
      >
        <Text style={styles.title}>{welcomeText}</Text>
      </TouchableOpacity>

      <View style={styles.authContainer}>
        <TouchableOpacity 
          style={styles.authButton}
          onPress={() => {
            speakText(authButtonText);
            handleAuth();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="finger-print" size={80} color="#fff" />
          <Text style={styles.authButtonText}>{authButtonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.pinButton}
          onPress={() => {
            speakText(pinButtonText);
            setShowPin(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="keypad" size={30} color="#fff" />
          <Text style={styles.pinButtonText}>{pinButtonText}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const { height, width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 999,
    paddingTop: 80,
  },
  titleContainer: {
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  authContainer: {
    height: height * 0.6,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 30,
  },
  authButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  authButtonText: {
    color: '#fff',
    fontSize: 26,
    marginTop: 24,
    textAlign: 'center',
    fontWeight: '600',
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
    borderRadius: 15,
    width: width * 0.8,
  },
  pinButtonText: {
    color: '#fff',
    fontSize: 18,
    marginLeft: 10,
    fontWeight: '500',
  },
});
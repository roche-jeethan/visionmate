import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';

export const useBiometricAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
    checkStoredSession();
  }, []);

  const checkBiometricSupport = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricAvailable(compatible && enrolled);
  };

  const checkStoredSession = async () => {
    try {
      const authenticatedUser = await AsyncStorage.getItem('authenticated_user');
      if (authenticatedUser) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
  };

  const authenticate = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to continue',
        fallbackLabel: 'Enter password',
        disableDeviceFallback: true,
      });

      if (result.success) {
        const deviceInfo = {
          deviceId: Device.deviceName || Device.osBuildId,
          timestamp: new Date().toISOString(),
        };
        await AsyncStorage.setItem('authenticated_user', JSON.stringify(deviceInfo));
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication error:', error);
      return false;
    }
  };

  return {
    isAuthenticated,
    isBiometricAvailable,
    authenticate
  };
};
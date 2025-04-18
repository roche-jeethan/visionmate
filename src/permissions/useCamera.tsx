import { useCameraPermissions } from 'expo-camera';
import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CAMERA_PERMISSION_KEY = '@camera_permission_status';

export const useCamera = () => {
  const [permission, requestPermission] = useCameraPermissions();

  const handlePermissionRequest = async () => {
    try {
      // Check if we have stored permission
      const storedPermission = await AsyncStorage.getItem(CAMERA_PERMISSION_KEY);
      
      if (storedPermission === 'granted') {
        return true;
      }

      if (!permission?.granted) {
        const result = await requestPermission();

        if (result.granted) {
          await AsyncStorage.setItem(CAMERA_PERMISSION_KEY, 'granted');
          return true;
        }

        // If permission denied, show settings dialog
        Alert.alert(
          'Camera Access Required',
          'Please enable camera access in your device settings',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings',
              onPress: () => {
                Platform.OS === 'ios' 
                  ? Linking.openURL('app-settings:')
                  : Linking.openSettings();
              }
            }
          ]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  };

  return {
    hasPermission: permission?.granted ?? false,
    requestPermission: handlePermissionRequest
  };
};
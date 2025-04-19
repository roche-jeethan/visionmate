import { useState, useEffect } from 'react';
import { Accelerometer } from 'expo-sensors';
import { Alert } from 'react-native';

const FALL_THRESHOLD = 3; // Can be adjusted based on testing
const SAMPLING_RATE = 50; // ms between readings

export const useFallDetection = (onFallDetected: () => void) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [{ x, y, z }, setData] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    let subscription: any;

    const startMonitoring = async () => {
      try {
        await Accelerometer.setUpdateInterval(SAMPLING_RATE);
        subscription = Accelerometer.addListener(accelerometerData => {
          setData(accelerometerData);
          
          // Calculate total acceleration magnitude
          const magnitude = Math.sqrt(
            Math.pow(accelerometerData.x, 2) +
            Math.pow(accelerometerData.y, 2) +
            Math.pow(accelerometerData.z, 2)
          );

          // Check if magnitude exceeds threshold
          if (magnitude > FALL_THRESHOLD) {
            onFallDetected();
          }
        });
        setIsMonitoring(true);
      } catch (error) {
        console.error('Failed to start fall detection:', error);
      }
    };

    startMonitoring();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [onFallDetected]);

  return {
    isMonitoring,
    accelerometerData: { x, y, z }
  };
};
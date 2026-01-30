import React, { useState, useRef, useCallback } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { CameraType, CameraView as ExpoCamera, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import { describeImage } from "../utils/geminiAPI";
import { speak } from "../utils/speech";
import { useTranslation } from "../context/TranslationContext";
import * as FileSystem from 'expo-file-system';

interface CameraViewProps {
  onImageDescribed?: (description: string) => void;
}

export default function CameraView({ onImageDescribed }: CameraViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [description, setDescription] = useState("");
  const cameraRef = useRef<ExpoCamera>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const { targetLanguage } = useTranslation();
  const insets = useSafeAreaInsets();

  // Reset to back camera on focus
  useFocusEffect(
    useCallback(() => {
      setFacing("back");
      setIsCameraReady(false); // Reset to ensure onCameraReady triggers again
      return () => {
        setIsCameraReady(false);
      };
    }, [])
  );

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) {
        const nextFacing = facing === "back" ? "front" : "back";
        setFacing(nextFacing);
        const message =
          targetLanguage === "hi"
            ? (nextFacing === "front" ? "सामने का कैमरा" : "पीछे का कैमरा")
            : (nextFacing === "front" ? "Front camera" : "Back camera");
        speak(message, targetLanguage);
      }
    });

  // Reset to back camera on focus
  useFocusEffect(
    useCallback(() => {
      setFacing("back");
      setIsCameraReady(false); // Reset to ensure onCameraReady triggers again
      return () => {
        setIsCameraReady(false);
      };
    }, [])
  );

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) {
        const nextFacing = facing === "back" ? "front" : "back";
        setFacing(nextFacing);
        const message =
          targetLanguage === "hi"
            ? (nextFacing === "front" ? "सामने का कैमरा" : "पीछे का कैमरा")
            : (nextFacing === "front" ? "Front camera" : "Back camera");
        speak(message, targetLanguage);
      }
    });

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing || !isCameraReady) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: true,
      });
      if (!photo) return;

      console.log("📸 Describe Photo keys:", Object.keys(photo));
      console.log("📸 Base64 exists:", !!photo.base64);

      const desc = await describeImage(photo.base64 || photo.uri, targetLanguage);
      setDescription(desc);
      onImageDescribed?.(desc);
      await speak(desc, targetLanguage);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = targetLanguage === 'hi' 
        ? "छवि को संसाधित करने में विफल" 
        : "Failed to process image";
      await speak(errorMessage, targetLanguage);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCamera = () => {
    setFacing(current => (current === "back" ? "front" : "back"));
  };

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd(() => {
      takePicture();
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd(() => {
      toggleCamera();
    });

  const composedGesture = Gesture.Exclusive(doubleTap, singleTap);

  if (!permission?.granted) return null;

  return (
    <View style={styles.container}>
      {description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>
      )}
      <ExpoCamera ref={cameraRef} style={styles.camera} facing={facing}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, isProcessing && styles.buttonDisabled]}
            onPress={takePicture}
            disabled={isProcessing}
          >
            <Ionicons name="camera" size={28} color="white" />
            <Text style={styles.buttonText}>
              {isProcessing 
                ? (targetLanguage === 'hi' ? "प्रोसेसिंग..." : "Processing...") 
                : (targetLanguage === 'hi' ? "विवरण" : "Describe")}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.button}
            onPress={() => setFacing(current => 
              current === "back" ? "front" : "back"
            )}
          >
            <Ionicons name="camera-reverse" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </ExpoCamera>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    height: 100,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
    width: 100, // Fixed width for both buttons
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  processingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  descriptionContainer: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
    borderRadius: 10,
  },
  descriptionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  }
});
import React, { useState, useRef, useCallback } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { CameraType, CameraView as ExpoCamera, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "@react-navigation/native";
import { describeImage } from "../utils/geminiAPI";
import { speak } from "../utils/speech";
import { useTranslation } from "../context/TranslationContext";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

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
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) return;

      const desc = await describeImage(photo.uri, targetLanguage);
      setDescription(desc);
      onImageDescribed?.(desc);
      await speak(desc, targetLanguage);
    } catch (error) {
      console.error("Error in Describe:", error);
      const errorMessage = targetLanguage === 'hi'
        ? "छवि को संसाधित करने में विफल"
        : "Failed to process image";
      await speak(errorMessage, targetLanguage);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission?.granted) return null;

  return (
    <GestureDetector gesture={doubleTap}>
      <View style={styles.container}>
        {description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionText}>{description}</Text>
          </View>
        )}
        <ExpoCamera
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          onCameraReady={() => {
            console.log("Describe Camera Ready");
            setIsCameraReady(true);
          }}
        >
          {/* Full Screen Area for Tapping to Describe */}
          <TouchableOpacity
            activeOpacity={1}
            style={styles.fullScreenTrigger}
            onPress={takePicture}
            disabled={isProcessing}
          >
            {isProcessing && (
              <View style={styles.processingOverlay}>
                <Text style={styles.processingText}>
                  {targetLanguage === 'hi' ? "प्रोसेसिंग..." : "Processing..."}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </ExpoCamera>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  fullScreenTrigger: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingOverlay: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
    borderRadius: 15,
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
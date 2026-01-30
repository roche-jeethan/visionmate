import React, { useState, useRef } from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { CameraType, CameraView as ExpoCamera, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { describeImage } from "../utils/geminiAPI";
import { speak } from "../utils/speech";
import { useTranslation } from "../context/TranslationContext";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

interface CameraViewProps {
  onImageDescribed?: (description: string) => void;
}

export default function CameraView({ onImageDescribed }: CameraViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isProcessing, setIsProcessing] = useState(false);
  const [description, setDescription] = useState("");
  const cameraRef = useRef<ExpoCamera>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const { targetLanguage } = useTranslation();
  const insets = useSafeAreaInsets();

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync();
      if (!photo) return;
      const localUri = photo.uri;

      const desc = await describeImage(localUri, targetLanguage);
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
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={composedGesture}>
        <SafeAreaView style={styles.container}>
          {description && (
            <View style={[styles.descriptionContainer, { paddingTop: insets.top + 10 }]}>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          )}
          <ExpoCamera ref={cameraRef} style={styles.camera} facing={facing}>
            <View style={[styles.buttonContainer, { paddingBottom: insets.bottom + 20 }]}>
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
                onPress={toggleCamera}
              >
                <Ionicons name="camera-reverse" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </ExpoCamera>
        </SafeAreaView>
      </GestureDetector>
    </GestureHandlerRootView>
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
    flexDirection: 'row',
    backgroundColor: 'transparent',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
    width: 100,
    minHeight: 80,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    marginTop: 5,
  },
  descriptionContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 1,
  },
  descriptionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  }
});
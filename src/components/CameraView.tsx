import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Camera, CameraType, CameraCapturedPicture, CameraView as ExpoCameraView } from "expo-camera";
import { useCameraPermissions } from 'expo-camera';
import { Ionicons } from "@expo/vector-icons";
import { describeImage } from "../utils/geminiAPI";
import { speak } from "../utils/speech";

interface CameraViewProps {
  onImageDescribed?: (description: string) => void;
}

export default function CameraView({ onImageDescribed }: CameraViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [description, setDescription] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const cameraRef = React.useRef<ExpoCameraView>(null);
  const [facing, setFacing] = useState<CameraType>("back");

  useEffect(() => {
    requestPermission();
  }, []);

  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.7,
        skipProcessing: true
      }) as CameraCapturedPicture;
      setImageUri(photo.uri);
      await processImage(photo);
    } catch (error) {
      console.error("📸 Error taking picture:", error);
      speak("Failed to capture image");
    } finally {
      setIsProcessing(false);
    }
  };

  const processImage = async (photo: CameraCapturedPicture) => {
    if (!photo.base64) {
      console.error("🚫 No base64 image data");
      return;
    }

    try {
      console.log("🔍 Processing image...");
      const desc = await describeImage(photo.base64);
      setDescription(desc);
      onImageDescribed?.(desc);
      await speak(desc);
      console.log("✅ Image processed successfully");
    } catch (error) {
      console.error("❌ Error processing image:", error);
      await speak("Failed to describe image");
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need your permission to use the camera
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ExpoCameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        ratio="16:9"
      >
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={takePicture}
            disabled={isProcessing}
          >
            <Ionicons 
              name={isProcessing ? "hourglass" : "camera"} 
              size={30} 
              color="white" 
            />
            <Text style={styles.captureText}>
              {isProcessing ? "Processing..." : "Describe"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.flipButton}
            onPress={() => setFacing(current => 
              current === "back" ? "front" : "back"
            )}
          >
            <Ionicons name="camera-reverse" size={30} color="white" />
          </TouchableOpacity>
        </View>
      </ExpoCameraView>

      {description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>{description}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 30,
  },
  captureButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 50,
    width: 100,
  },
  captureText: {
    color: 'white',
    marginTop: 5,
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 50,
  },
  descriptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  descriptionText: {
    color: 'white',
    fontSize: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: 20,
    color: 'black',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
  }
});
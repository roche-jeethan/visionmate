import React, { useState, useRef, useCallback } from "react";
import {
  AppState,
  AppStateStatus,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, CameraType, CameraPictureOptions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { LightSensor } from "expo-sensors";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { useCamera } from "../permissions/useCamera";
import { useTranslation } from "../context/TranslationContext";
import { SERVER_IP } from "../config/config"
import { useSpeech } from "../hooks/useSpeech";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";
import {
  getObjectPosition,
  getPositionAnnouncement,
  ObjectPosition,
} from "../utils/positionUtils";

interface DetectedObject {
  label: string;
  position: "left" | "right" | "center";
  confidence: number;
  box: [number, number, number, number];
}

interface DepthInfo {
  label: string;
  distance_m: number;
}

interface WSResponse {
  translated_text: string;
  depth?: DepthInfo[];
  detected_objects?: DetectedObject[];
  status: "success" | "error";
  error?: string;
  boxes?: DetectedObject[];
  count?: number;
}

const HIGH_PRIORITY = new Set([
  "person", "car", "bus", "truck", "bicycle", "chair", "couch", "bed", "laptop"
]);

const MEDIUM_PRIORITY = new Set([
  "bottle", "backpack", "umbrella", "suitcase"
]);

function getPriority(label: string, distance?: number): "high" | "medium" | "low" {
  // 6. Dynamic Priority Override (Critical Rule)
  // IF distance == VERY_CLOSE (< 0.7) -> FORCE priority = HIGH
  if (distance !== undefined && distance < 0.7) {
    return "high";
  }

  const lowerLabel = label.toLowerCase();
  if (HIGH_PRIORITY.has(lowerLabel)) return "high";
  if (MEDIUM_PRIORITY.has(lowerLabel)) return "medium";
  return "low";
}

export default function CameraScreen() {
  // Cache for utterance control: label -> {count, lastUttered}
  const utteranceCache = useRef<Map<string, { count: number, lastUttered: number }>>(new Map());
  const { hasPermission, requestPermission } = useCamera();
  const { targetLanguage } = useTranslation();
  useScreenAnnounce("Camera");
  const [detectionResult, setDetectionResult] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  // Always default to back camera
  // Always default to back camera
  const [facing, setFacing] = useState<CameraType>("back");
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [currentDepths, setCurrentDepths] = useState<DepthInfo[]>([]);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [hasAnnouncedInstruction, setHasAnnouncedInstruction] = useState(false);

  const speakText = useSpeech();

  const cameraRef = useRef<CameraView>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isStreaming = useRef<boolean>(false);
  const isWaitingForResponse = useRef<boolean>(false);
  const appState = useRef(AppState.currentState);




  useEffect(() => {
    requestPermission();

    // Light Sensor for Auto Torch
    LightSensor.setUpdateInterval(1000);
    const subscription = LightSensor.addListener(({ illuminance }) => {
      // Threshold for "darkness" (e.g. < 5 lux)
      // Only turn ON if not already on
      if (illuminance < 5) {
        setIsTorchOn((prev) => {
          if (!prev) {
            speakText(targetLanguage === "hi" ? "फ्लैशलाइट चालू कर रहा हूँ" : "Turning on the torch");
            return true;
          }
          return prev;
        });
      } else if (illuminance > 20) {
        setIsTorchOn((prev) => {
          if (prev) {
            speakText(targetLanguage === "hi" ? "फ्लैशलाइट बंद कर रहा हूँ" : "Turning off the torch");
            return false;
          }
          return prev;
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [targetLanguage]);

  // Announce instructions on mount/focus
  useFocusEffect(
    useCallback(() => {
      if (!hasAnnouncedInstruction) {
        speakText(targetLanguage === "hi"
          ? "कैमरा बदलने के लिए दो बार टैप करें"
          : "Double tap to switch the camera");
        setHasAnnouncedInstruction(true);
      }
    }, [targetLanguage, hasAnnouncedInstruction])
  );

  function toggleCamera() {
    setFacing((current) => (current === "back" ? "front" : "back"));
  }

  const handleTorchToggle = () => {
    setIsTorchOn((prev) => !prev);
  };

  const closeWebSocket = useCallback(() => {
    console.log("Closing WebSocket connection");
    isStreaming.current = false;

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Gesture for double tap
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) {
        const nextFacing = facing === "back" ? "front" : "back";
        setFacing(nextFacing);
        const message =
          targetLanguage === "hi"
            ? nextFacing === "front"
              ? "सामने का कैमरा"
              : "पीछे का कैमरा"
            : nextFacing === "front"
              ? "Front camera"
              : "Back camera";
        speakText(message);
      }
    });

  // Single tap for manual trigger (Medium Priority)
  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .runOnJS(true)
    .onEnd((_e, success) => {
      if (success) {
        handleManualTrigger();
      }
    });

  // Exclusive gesture: Single tap waits for Double tap failure
  const gestures = Gesture.Exclusive(doubleTap, singleTap);

  const lastAnnouncedObjects = useRef<Map<string, number | undefined>>(new Map()); // For distance tracking
  const objectPersistence = useRef<Map<string, number>>(new Map()); // Label -> Frame Count
  const lastAnnouncedGroups = useRef<Map<string, number>>(new Map()); // Label -> Count
  const lastHapticTime = useRef<number>(0);

  const handleHaptics = (minDist: number) => {
    // Haptic feedback only works on real devices (not simulators)
    const now = Date.now();
    if (minDist < 0.7) {
      if (now - lastHapticTime.current > 500) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        lastHapticTime.current = now;
      }
    } else if (minDist < 5.0) {
      if (now - lastHapticTime.current > 1000) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
        lastHapticTime.current = now;
      }
    }
  };

  const handleManualTrigger = () => {
    console.log("Adding manual trigger request");
    // We can just call processAnnouncements with current state and force userRequested=true
    processAnnouncements(detectedObjects, currentDepths, true);
  };

  // Logic to process announcements based on state changes
  const processAnnouncements = (
    newBoxes: DetectedObject[],
    newDepths: DepthInfo[],
    isUserRequested: boolean = false
  ) => {
    // Immediate haptic feedback for any object below 5m
    let hapticTriggered = false;
    newDepths.forEach(d => {
      if (d.distance_m < 5.0 && !hapticTriggered) {
        handleHaptics(d.distance_m);
        hapticTriggered = true;
      }
    });


    // Utterance logic: only utter every 3rd detection, and not back-to-back
    const now = Date.now();
    const messages: string[] = [];
    newBoxes.forEach(box => {
      // Lowered threshold to match backend YOLO_CONF (0.25)
      if (box.confidence < 0.25) return;
      const label = box.label.toLowerCase();
      const cache = utteranceCache.current.get(label) || { count: 0, lastUttered: 0 };

      // Debounce: don't utter same object too frequently (every 1.5s)
      if (now - cache.lastUttered > 1500) {
        let msg = box.label;
        if (box.position === "left") msg += targetLanguage === "hi" ? " बाईं ओर" : " on your left";
        else if (box.position === "right") msg += targetLanguage === "hi" ? " दाईं ओर" : " on your right";
        else msg += targetLanguage === "hi" ? " सामने" : " ahead";
        messages.push(msg);
        cache.lastUttered = now;
      }
      utteranceCache.current.set(label, cache);
    });
    if (messages.length > 0) {
      speakText(messages.join(". "));
    }
  };

  const initializeWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    console.log("Initializing WebSocket connection");
    const ws = new WebSocket(
      `ws://${SERVER_IP}:8000/ws/video?target=${targetLanguage}`
    );

    ws.onopen = async () => {
      console.log("WebSocket Connected");
      wsRef.current = ws;
      setIsConnected(true);

      // Send single JSON init message
      ws.send(JSON.stringify({ type: "init", target_lang: targetLanguage }));

      isStreaming.current = true;
      startStreaming();
    };

    ws.onmessage = (event) => {
      try {
        // Signal that we've received a response and are ready for the next frame
        isWaitingForResponse.current = false;

        const result: WSResponse = JSON.parse(event.data);

        if (result.status === "error") {
          console.error("Server error:", result.error);
          return;
        }

        if (result.boxes) {
          console.log("Detected:", result.count || result.boxes.length);
          setDetectedObjects(result.boxes);
        }

        if (result.translated_text) {
          setDetectionResult(result.translated_text);
        }

        if (result.depth && Array.isArray(result.depth)) {
          setCurrentDepths(result.depth);
        }

        if (result.detected_objects && result.detected_objects.length > 0) {
          setDetectedObjects(result.detected_objects); // Fallback if backend sends this key
        }

        // Run automatic announcement logic
        const boxes = result.boxes || result.detected_objects || [];
        const depths = result.depth || [];
        processAnnouncements(boxes, depths);

      } catch (error) {
        console.error("Parse Error:", error);
        isWaitingForResponse.current = false;
      }
    };

    ws.onclose = (event) => {
      console.log(`WebSocket Closed: ${event.code}`);
      isStreaming.current = false;
      setIsConnected(false);
      wsRef.current = null;
      // Clear tracked objects on disconnect so they are re-announced on reconnect?
      lastAnnouncedObjects.current.clear();
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    wsRef.current = ws;
  }, [targetLanguage, closeWebSocket]);

  const startStreaming = async () => {
    while (isActive && isStreaming.current) {
      try {
        if (!cameraRef.current || !hasPermission) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        // Backpressure: Wait if we haven't received a response to the last frame
        if (isWaitingForResponse.current) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          continue;
        }

        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          initializeWebSocket();
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        const pictureOptions: CameraPictureOptions = {
          base64: true,
          quality: 0.5,
          shutterSound: false,
        };

        // Mark as waiting BEFORE taking the picture to be safe
        isWaitingForResponse.current = true;
        const photo = await cameraRef.current.takePictureAsync(pictureOptions);

        if (photo?.base64 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(photo.base64);
        } else {
          // If transfer didn't happen, reset the waiting flag
          isWaitingForResponse.current = false;
        }

      } catch (err) {
        console.error("Frame capture error:", err);
        isWaitingForResponse.current = false;
      }

      // Fixed small delay to avoid hammering hardware
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === "active"
    ) {
      setIsActive(true);
      initializeWebSocket();
    } else if (
      appState.current === "active" &&
      nextAppState.match(/inactive|background/)
    ) {
      setIsActive(false);
      closeWebSocket();
    }
    appState.current = nextAppState;
  };

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isActive) {
      initializeWebSocket();
      return closeWebSocket;
    } else {
      closeWebSocket();
    }
  }, [isActive, initializeWebSocket, closeWebSocket]);

  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused - initializing camera and WebSocket");
      setIsCameraReady(false);
      setFacing("back");
      requestPermission();
      initializeWebSocket();

      return () => {
        console.log("Screen unfocused - cleaning up");
        closeWebSocket();
        setIsCameraReady(false);
      };
    }, [initializeWebSocket, closeWebSocket])
  );

  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      closeWebSocket();
      initializeWebSocket();
    }
  }, [targetLanguage]);

  // Always show camera view (never blank), default to back camera
  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={gestures}>
        <SafeAreaView style={styles.container}>
          <View style={styles.camera}>
            <CameraView
              ref={cameraRef as any}
              style={StyleSheet.absoluteFill}
              facing={facing}
              enableTorch={isTorchOn}
              animateShutter={false}
              onCameraReady={() => setIsCameraReady(true)}
            >
              <View style={styles.centerLine} />
              <View style={styles.detectionContainer}>
                {!isConnected && (
                  <Text style={styles.connectionStatus}>Reconnecting...</Text>
                )}
                {!hasPermission && (
                  <Text style={styles.connectionStatus}>Camera permission required</Text>
                )}
                {/* Removed 'Initializing camera...' message */}
                {detectionResult && (
                  <Text style={styles.detectionText}>{detectionResult}</Text>
                )}
              </View>
            </CameraView>
          </View>
        </SafeAreaView>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
    position: "relative",
  },
  detectionContainer: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  connectionStatus: {
    width: "100%",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  detectionText: {
    width: "100%",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: 15,
    fontSize: 18,
    borderRadius: 8,
    overflow: "hidden",
  },
  centerLine: {
    position: "absolute",
    left: "50%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    zIndex: 1,
  },
  // Removed unused styles
});

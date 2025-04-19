import React, { useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, SafeAreaView, StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { CameraView, CameraType, CameraPictureOptions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCamera } from '../permissions/useCamera';
import { useTranslation } from '../context/TranslationContext';
import { SERVER_IP} from '../config/config';
import { useSpeech } from '../hooks/useSpeech';
import { useScreenAnnounce } from '../hooks/useScreenAnnounce';
import { getObjectPosition, getPositionAnnouncement, ObjectPosition } from '../utils/positionUtils';

// Add interface for detected object
interface DetectedObject {
    label: string;
    position: 'left' | 'right' | 'center';
    confidence: number;
    box: [number, number, number, number];
}

interface WSResponse {
    translated_text: string;
    depth?: {
        depth: number;
        confidence: number;
        method: string;
    };
    detected_objects?: DetectedObject[];
    status: 'success' | 'error';
    error?: string;
}

export default function CameraScreen() {
    const { hasPermission, requestPermission } = useCamera();
    const { targetLanguage } = useTranslation();
    useScreenAnnounce('Camera');
    const [detectionResult, setDetectionResult] = useState<string>("");
    const [isConnected, setIsConnected] = useState(false);
    const [facing, setFacing] = useState<CameraType>("back");
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const [depthValue, setDepthValue] = useState<number | null>(null);
    const [isObjectClose, setIsObjectClose] = useState(false);
    const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
    const [lastAnnouncedPosition, setLastAnnouncedPosition] = useState<{
        label: string;
        position: ObjectPosition;
    } | null>(null);
    const PROXIMITY_THRESHOLD = 1.0 // threshold (update as needed)
    const speakText = useSpeech();

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isStreaming = useRef<boolean>(false);
    const appState = useRef(AppState.currentState);

    useEffect(() => {
        requestPermission();
    }, []);

    function toggleCamera() {
        setFacing(current => current === "back" ? "front": "back");
    };

    const handleTorchToggle = () => {
        setIsTorchOn(prev => !prev);
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

    const initializeWebSocket = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            console.log("WebSocket already connected");
            return;
        }

        console.log("Initializing WebSocket connection");
        const ws = new WebSocket(`ws://${SERVER_IP}:8000/ws/video?target=${targetLanguage}`);

        ws.onopen = async () => {
            console.log("WebSocket Connected");
            wsRef.current = ws;
            setIsConnected(true);
            
            await ws.send("init");
            await ws.send(JSON.stringify({ target_lang: targetLanguage }));
            
            isStreaming.current = true;
            startStreaming();
        };

        // Make sure to update your WebSocket message handler to store the boxes info
        ws.onmessage = (event) => {
            try {
                const result = JSON.parse(event.data);
                if (result.status === 'success' && result.boxes) {
                    setDetectedObjects(result.boxes);
                }
                // ...rest of your existing WebSocket handler
                if (result.status === 'error') {
                    console.error("Server error:", result.error);
                    return;
                }

                if (result.translated_text) {
                    setDetectionResult(result.translated_text);
                }

                if (result.depth?.depth !== undefined) {
                    setDepthValue(result.depth.depth);
                    const isClose = result.depth.depth < PROXIMITY_THRESHOLD;

                    if (isClose && !isObjectClose) {
                        const warningText = targetLanguage === 'hi'
                            ? 'आप वस्तु के बहुत करीब हैं'
                            : 'You are too close to the object';
                        speakText(warningText);
                    }
                    setIsObjectClose(isClose);
                }

                if (result.detected_objects && result.detected_objects.length > 0) {
                    setDetectedObjects(result.detected_objects);
                    
                    // Get the most prominent object (first one)
                    const mainObject = result.detected_objects[0];
                    const position = getObjectPosition(mainObject.bbox);
                    
                    // Announce position changes
                    if (!lastAnnouncedPosition || 
                        lastAnnouncedPosition.position !== position || 
                        lastAnnouncedPosition.label !== mainObject.label) {
                        const announcement = getPositionAnnouncement(
                            position,
                            mainObject.label,
                            targetLanguage
                        );
                        speakText(announcement);
                        setLastAnnouncedPosition({
                            label: mainObject.label,
                            position: position
                        });
                    }
                }
            } catch (error) {
                console.error("Parse Error:", error);
            }
        };

        ws.onclose = (event) => {
            console.log(`WebSocket Closed: ${event.code}`);
            isStreaming.current = false;
            setIsConnected(false);
            wsRef.current = null;
        };

        ws.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        wsRef.current = ws;
    }, [targetLanguage]);

    const startStreaming = async () => {
        while (
            isActive && 
            isStreaming.current && 
            wsRef.current?.readyState === WebSocket.OPEN
        ) {
            try {
                if (!cameraRef.current) continue;

                const pictureOptions: CameraPictureOptions = {
                    base64: true,
                    quality: 0.5,
                    shutterSound: false,
                };

                const photo = await cameraRef.current.takePictureAsync(pictureOptions);

                if (photo?.base64) {
                    wsRef.current.send(photo.base64);
                }
            } catch (err) {
                console.error("Frame capture error:", err);
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    };

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
            setIsActive(true);
            initializeWebSocket();
        } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
            setIsActive(false);
            closeWebSocket();
        }
        appState.current = nextAppState;
    };

    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
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
            requestPermission();
            initializeWebSocket();

            return () => {
                console.log("Screen unfocused - cleaning up");
                closeWebSocket();
            };
        }, [initializeWebSocket, closeWebSocket])
    );

    useEffect(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            closeWebSocket();
            initializeWebSocket();
        }
    }, [targetLanguage]);

    const handleScreenPress = async () => {
        if (detectionResult) {
            await speakText(detectionResult);
        }
    };

    // Update the position announcement handler
    const handlePositionAnnounce = () => {
        console.log("Current detected objects:", detectedObjects);

        if (detectedObjects && detectedObjects.length > 0) {
            // Sort objects by confidence to get the most confident detection
            const sortedObjects = [...detectedObjects].sort((a, b) => b.confidence - a.confidence);
            const mainObject = sortedObjects[0];

            // Create announcement message
            let announcement: string;
            if (targetLanguage === 'hi') {
                switch (mainObject.position) {
                    case 'left':
                        announcement = `${mainObject.label} बाईं ओर है`;
                        break;
                    case 'right':
                        announcement = `${mainObject.label} दाईं ओर है`;
                        break;
                    default:
                        announcement = `${mainObject.label} सामने है`;
                }
            } else {
                announcement = `${mainObject.label} is ${mainObject.position === 'center' ? 'in the center' : `on the ${mainObject.position}`}`;
            }

            console.log(`🗣️ Announcing: ${announcement}`);
            console.log(`📊 Confidence: ${(mainObject.confidence * 100).toFixed(0)}%`);
            
            speakText(announcement);
        } else {
            const noObjectMessage = targetLanguage === 'hi' 
                ? 'कोई वस्तु नहीं मिली' 
                : 'No object detected';
            console.log("⚠️ No objects detected");
            speakText(noObjectMessage);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <TouchableOpacity 
                style={styles.camera} 
                onPress={handleScreenPress}
                activeOpacity={0.9}
            >
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    enableTorch={isTorchOn}
                    animateShutter={false}
                >
                    {/* Keep the center line */}
                    <View style={styles.centerLine} />
                
                    <View style={styles.detectionContainer}>
                        {!isConnected && (
                            <Text style={styles.connectionStatus}>
                                Reconnecting...
                            </Text>
                        )}
                        {detectionResult && (
                            <Text style={styles.detectionText}>
                                {detectionResult}
                            </Text>
                        )}
                        {isObjectClose && (
                            <Text style={styles.proximityWarning}>
                                {targetLanguage === 'hi'
                                    ? 'आप वस्तु के बहुत करीब हैं'
                                    : 'You are too close to the object'}
                            </Text>
                        )}
                    </View>

                    <View style={styles.controls}>
                        <TouchableOpacity 
                            onPress={toggleCamera}
                            style={styles.controlButton}
                        >
                            <Ionicons name="camera-reverse" size={30} color="white" />
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={handleTorchToggle}
                            style={styles.controlButton}
                        >
                            <Ionicons 
                                name={isTorchOn ? 'flashlight' : 'flashlight-outline'} 
                                size={24} 
                                color="white" 
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        style={styles.centerButton}
                        onPress={handlePositionAnnounce}
                        activeOpacity={0.7}
                    >
                        <Ionicons 
                            name="location" 
                            size={30} 
                            color="white" 
                        />
                    </TouchableOpacity>
                </CameraView>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
        position: 'relative',
    },
    detectionContainer: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    connectionStatus: {
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: 10,
        borderRadius: 8,
        marginBottom: 10,
    },
    detectionText: {
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: 15,
        fontSize: 18,
        borderRadius: 8,
        overflow: 'hidden',
    },
    proximityWarning: {
        width: '100%',
        textAlign: 'center',
        backgroundColor: 'rgba(255,0,0,0.7)',
        color: '#fff',
        padding: 15,
        fontSize: 18,
        borderRadius: 8,
        marginTop: 10,
        fontWeight: 'bold',
    },
    controls: {
        position: 'absolute',
        bottom: 30,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
    },
    controlButton: {
        padding: 10,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 25,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    permissionButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 10,
    },
    permissionButtonText: {
        color: 'white',
        fontSize: 16,
    },
    centerLine: {
        position: 'absolute',
        left: '50%',
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        zIndex: 1,
    },
    centerButton: {
        position: 'absolute',
        bottom: 100, // Changed from 20 to 100 to move it up
        alignSelf: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 15,
        borderRadius: 30,
        zIndex: 2,
    }
});

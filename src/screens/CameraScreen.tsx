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

export default function CameraScreen() {
    const { hasPermission, requestPermission } = useCamera();
    const { targetLanguage } = useTranslation();
    useScreenAnnounce('Camera');
    const [detectionResult, setDetectionResult] = useState<string>("");
    const [isConnected, setIsConnected] = useState(false);
    const [facing, setFacing] = useState<CameraType>("back");
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isActive, setIsActive] = useState(true);
    const speakText = useSpeech();

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isStreaming = useRef<boolean>(false);
    const appState = useRef(AppState.currentState);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const connectionAttemptRef = useRef<number>(0);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

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

        if (reconnectAttempts.current >= maxReconnectAttempts) {
            console.log("Max reconnection attempts reached");
            return;
        }

        console.log("Initializing WebSocket connection");
        const ws = new WebSocket(`ws://${SERVER_IP}:8000/ws/video?target=${targetLanguage}`);

        ws.onopen = async () => {
            console.log("WebSocket Connected");
            reconnectAttempts.current = 0;
            wsRef.current = ws;
            setIsConnected(true);
       
            await ws.send("init");
            await ws.send(JSON.stringify({ target_lang: targetLanguage }));
            
            isStreaming.current = true;
            startStreaming();
        };

        ws.onmessage = (event) => {
            try {
                const result = JSON.parse(event.data);
                if (result.translated_text) {
                    setDetectionResult(result.translated_text);
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

            if (reconnectAttempts.current < maxReconnectAttempts) {
                reconnectAttempts.current++;
                setTimeout(() => {
                    if (!wsRef.current) {
                        initializeWebSocket();
                    }
                }, 2000);
            }
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
});

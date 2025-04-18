import React, { useState, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, CameraPictureOptions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useCamera } from '../permissions/useCamera';

const SERVER_IP = process.env.SERVER_IP;
// const SERVER_IP = "172.18.3.156";

const App = () => {
    const { hasPermission, requestPermission } = useCamera(); 
    const [detectionResult, setDetectionResult] = useState<string>("");
    const [isConnected, setIsConnected] = useState(false);
    const [facing, setFacing] = useState<CameraType>("back");
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [isActive, setIsActive] = useState(true);

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const isStreaming = useRef<boolean>(false);
    const appState = useRef(AppState.currentState);
    const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
    const connectionAttemptRef = useRef<number>(0);

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
        console.log("Cleaning up existing connection");
        isStreaming.current = false;
        
        if (wsRef.current) {
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                try {
                    wsRef.current.close();
                } catch (error) {
                    console.error("Error closing WebSocket:", error);
                }
            }
            wsRef.current = null;
        }
        
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
            reconnectTimeout.current = null;
        }
    }, []);

    const connectWebSocket = useCallback(() => {
        connectionAttemptRef.current += 1;
        const currentAttempt = connectionAttemptRef.current;
        
        closeWebSocket();
        console.log('Connecting to WebSocket...');
        setIsConnected(false);
        
        const ws = new WebSocket(`ws://${SERVER_IP}:8000/ws/video`);
        
        ws.onopen = () => {
            if (currentAttempt !== connectionAttemptRef.current) {
                console.log("Outdated connection attempt, closing");
                ws.close();
                return;
            }
            
            console.log('WebSocket Connected');
            wsRef.current = ws;
            isStreaming.current = true;
            setIsConnected(true);
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
            console.log(`WebSocket Closed (${event.code}): ${event.reason || 'No reason provided'}`);
            isStreaming.current = false;
            wsRef.current = null;
            setIsConnected(false);
            
            if (currentAttempt === connectionAttemptRef.current) {
                reconnectTimeout.current = setTimeout(connectWebSocket, 2000);
            }
        };

        wsRef.current = ws;
    }, [closeWebSocket]);

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
            connectWebSocket();
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
            connectWebSocket();
            return closeWebSocket;
        } else {
            closeWebSocket();
        }
    }, [isActive, connectWebSocket, closeWebSocket]);

    // if (!hasPermission) {
    //     return (
    //         <View style={styles.permissionContainer}>
    //             <TouchableOpacity 
    //                 style={styles.permissionButton}
    //                 onPress={requestPermission}
    //             >
    //                 <Text style={styles.permissionButtonText}>
    //                     Grant Camera Permission
    //                 </Text>
    //             </TouchableOpacity>
    //         </View>
    //     );
    // }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.camera}>
                <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    enableTorch={isTorchOn}
                    animateShutter={false}
                >
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
            </View>
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
    connectionStatus: {
        position: 'absolute',
        top: 20,
        left: 0,
        right: 0,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: '#fff',
        padding: 10,
    },
    detectionText: {
        position: 'absolute',
        bottom: 20,
        left: 0,
        right: 0,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: '#fff',
        padding: 10,
        fontSize: 16,
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

export default App;
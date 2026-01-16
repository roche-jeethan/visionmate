import React, { useState, useRef, useCallback } from "react";
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Dimensions,
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";


import { useCamera } from "../permissions/useCamera";
import { SERVER_IP } from "../config/config";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";

interface FaceData {
    name: string;
    bbox: [number, number, number, number];
    score: number;
    confidence: number;
}

export default function InsightScreen() {
    useScreenAnnounce('VisionMate Insight');
    const { hasPermission, requestPermission } = useCamera();

    const [facing, setFacing] = useState<CameraType>("front");
    const [detectedFaces, setDetectedFaces] = useState<FaceData[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentPersonName, setCurrentPersonName] = useState<string | null>(null);

    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
    const scaleX = SCREEN_WIDTH / 640;
    const scaleY = SCREEN_HEIGHT / 640;

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamingRef = useRef(false);

    // WebSocket and Camera Logic
    const closeWebSocket = useCallback(() => {
        streamingRef.current = false;
        setIsStreaming(false);
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const startStreaming = async () => {
        while (streamingRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                if (cameraRef.current) {
                    const photo = await cameraRef.current.takePictureAsync({
                        base64: true,
                        quality: 0.3,
                        shutterSound: false,
                        skipProcessing: true,
                    });

                    if (photo?.base64) {
                        wsRef.current.send(photo.base64);
                    }
                }
            } catch (err) {
                console.log("Frame capture error:", err);
            }
            await new Promise((resolve) => setTimeout(resolve, 300)); // ~3 FPS
        }
    };

    const initializeWebSocket = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(`ws://${SERVER_IP}:8000/ws/face`);

        ws.onopen = () => {
            console.log("Face WS Connected");
            wsRef.current = ws;
            streamingRef.current = true;
            setIsStreaming(true);
            startStreaming();
        };

        ws.onmessage = (event) => {
            try {
                const result = JSON.parse(event.data);
                if (result.status === "success" && result.faces) {
                    setDetectedFaces(result.faces);
                    if (result.faces.length > 0) {
                        // Prioritize the first detected face (usually the largest/most confident)
                        setCurrentPersonName(result.faces[0].name);
                    } else {
                        setCurrentPersonName(null);
                    }
                }
            } catch (e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = () => {
            streamingRef.current = false;
            setIsStreaming(false);
            wsRef.current = null;
        };

        ws.onerror = (e) => {
            console.error("WS Error", e);
        };
    }, []);

    useFocusEffect(
        useCallback(() => {
            requestPermission();
            initializeWebSocket();
            return () => {
                closeWebSocket();
                setDetectedFaces([]);
            };
        }, [initializeWebSocket, closeWebSocket])
    );

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>Camera permission is required for VisionMate Insight.</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>VisionMate Insight</Text>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: isStreaming ? "#4CAF50" : "#F44336" }]} />
                    <Text style={styles.statusText}>{isStreaming ? "Active" : "Connecting..."}</Text>
                </View>
            </View>

            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing={facing}
                    animateShutter={false}
                >
                    {detectedFaces.map((face, index) => (
                        <View
                            key={index}
                            style={[
                                styles.faceBox,
                                {
                                    left: face.bbox[0] * scaleX,
                                    top: face.bbox[1] * scaleY,
                                    width: (face.bbox[2] - face.bbox[0]) * scaleX,
                                    height: (face.bbox[3] - face.bbox[1]) * scaleY,
                                    borderColor: face.name !== "Unknown" ? "#00FF00" : "#FF0000",
                                },
                            ]}
                        >
                            <Text style={[
                                styles.faceName,
                                { backgroundColor: face.name !== "Unknown" ? "#00FF00" : "#FF0000" }
                            ]}>
                                {face.name} ({Math.round(face.score * 100)}%)
                            </Text>
                        </View>
                    ))}
                </CameraView>

                <TouchableOpacity
                    style={styles.flipButton}
                    onPress={() => setFacing(c => c === "back" ? "front" : "back")}
                >
                    <MaterialIcons name="flip-camera-ios" size={30} color="white" />
                </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
                {currentPersonName ? (
                    <Text style={styles.personNameText}>
                        Detected: <Text style={styles.highlightText}>{currentPersonName}</Text>
                    </Text>
                ) : (
                    <Text style={styles.infoText}>
                        Point the camera at a face to identify the person.
                    </Text>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    header: {
        padding: 20,
        paddingTop: 40,
        backgroundColor: "#1a1a1a",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#fff",
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 5,
    },
    statusText: {
        color: '#ccc',
        fontSize: 14,
    },
    cameraContainer: {
        flex: 1,
        margin: 10,
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#333',
    },
    camera: {
        flex: 1,
    },
    flipButton: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 12,
        borderRadius: 30,
    },
    faceBox: {
        position: 'absolute',
        borderWidth: 2,
        zIndex: 10,
    },
    faceName: {
        color: 'white',
        fontSize: 12,
        paddingHorizontal: 6,
        paddingVertical: 2,
        position: 'absolute',
        top: -20,
        left: 0,
        borderRadius: 4,
        overflow: 'hidden',
    },
    text: {
        color: "white",
        fontSize: 16,
        textAlign: "center",
        marginBottom: 20,
    },
    button: {
        backgroundColor: "#007AFF",
        padding: 15,
        borderRadius: 8,
    },
    buttonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    infoContainer: {
        padding: 15,
        backgroundColor: '#1a1a1a',
        alignItems: 'center',
    },
    infoText: {
        color: '#888',
        fontSize: 14,
    },
    personNameText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    highlightText: {
        color: '#007AFF',
        fontSize: 20,
    },
});

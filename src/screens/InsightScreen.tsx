import React, { useState, useRef, useCallback, useEffect } from "react";
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    TouchableOpacity
} from "react-native";
import { CameraView, CameraType } from "expo-camera";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCamera } from "../permissions/useCamera";
import { SERVER_IP } from "../config/config";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";
import { useSpeech } from "../hooks/useSpeech";

export default function InsightScreen() {
    useScreenAnnounce('VisionMate Insight');
    const { hasPermission, requestPermission } = useCamera();
    const insets = useSafeAreaInsets();

    const [facing, setFacing] = useState<CameraType>("front");
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentPersonName, setCurrentPersonName] = useState<string | null>(null);

    const cameraRef = useRef<CameraView>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const streamingRef = useRef(false);
    const lastTapRef = useRef<number>(0);
    const speakText = useSpeech();
    const lastSpokenRef = useRef<string | null>(null);

    // Announce detected person similar to tab/screen announcements.
    useEffect(() => {
        if (currentPersonName) {
            const phrase = `${currentPersonName} detected`;
            if (lastSpokenRef.current !== phrase) {
                speakText(phrase);
                lastSpokenRef.current = phrase;
            }
        } else {
            // reset so the same name can be announced again later
            lastSpokenRef.current = null;
        }
    }, [currentPersonName, speakText]);

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
        <SafeAreaView style={styles.container}>
            {/* <View>
                <View style={styles.statusContainer}>
                    <View style={[styles.statusDot, { backgroundColor: isStreaming ? "#4CAF50" : "#F44336" }]} />
                    <Text style={styles.statusText}>{isStreaming ? "Active" : "Connecting..."}</Text>
                </View>
            </View> */}

            <View style={styles.cameraContainer}>
                {/* Full-screen camera view. Double-tap to switch camera. */}
                <Pressable
                    style={styles.cameraPressable}
                    onPress={() => {
                        const now = Date.now();
                        if (lastTapRef.current && now - lastTapRef.current < 300) {
                            setFacing((c) => (c === "back" ? "front" : "back"));
                            lastTapRef.current = 0;
                        } else {
                            lastTapRef.current = now;
                        }
                    }}
                >
                    <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing={facing}
                        animateShutter={false}
                    />
                </Pressable>
            </View>

            <View style={styles.infoContainer}>
                {currentPersonName ? (
                    <Text style={styles.personNameText}>
                        <Text style={styles.highlightText}>{currentPersonName}</Text> detected
                    </Text>
                ) : (
                    <Text style={styles.infoText}>
                    </Text>
                )}
            </View>
        </SafeAreaView>
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
        margin: 0,
        borderRadius: 0,
        overflow: 'hidden',
        borderWidth: 0,
    },
    cameraPressable: {
        flex: 1,
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

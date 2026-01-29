import React, { useState, useRef, useEffect } from "react";
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, CameraType } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useCamera } from "../permissions/useCamera";
import { SERVER_IP } from "../config/config";
import { useSpeech } from "../hooks/useSpeech";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";

export default function AddPersonScreen() {
    const { hasPermission, requestPermission } = useCamera();
    useScreenAnnounce("Add Person");
    const [facing, setFacing] = useState<CameraType>("back");
    const [isCapturing, setIsCapturing] = useState(false);
    const speakText = useSpeech();
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        requestPermission();
    }, []);

    function toggleCamera() {
        const newFacing = facing === "back" ? "front" : "back";
        setFacing(newFacing);
        speakText(newFacing === "back" ? "Back camera" : "Front camera");
    }

    const [captureProgress, setCaptureProgress] = useState(0);
    const TOTAL_PHOTOS = 10;

    const takePicture = async () => {
        if (!cameraRef.current || isCapturing) return;

        try {
            setIsCapturing(true);
            setCaptureProgress(0);
            speakText("Capturing photos.");

            const uploadPromises: Promise<any>[] = [];

            for (let i = 0; i < TOTAL_PHOTOS; i++) {
                setCaptureProgress(i + 1);

                const photo = await cameraRef.current.takePictureAsync({
                    base64: true,
                    quality: 0.5, // Lower quality (0.5) significantly reduces upload time
                    shutterSound: false,
                });

                if (photo?.base64) {
                    // Fire and forget (or collect promises to check at the end)
                    const uploadTask = fetch(`http://${SERVER_IP}:8000/add_person`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image: photo.base64 }),
                    }).then(res => res.json());
                    uploadPromises.push(uploadTask);
                }

                // Short pause to ensure the camera UI/shutter resets
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // Wait for all uploads to finish in parallel
            const results = await Promise.all(uploadPromises);
            const successCount = results.filter(r => r.status === 'success').length;

            if (successCount === TOTAL_PHOTOS) {
                speakText("All photos captured and saved");
                Alert.alert("Success", "Capture complete");
            } else {
                speakText(`Saved ${successCount} out of ${TOTAL_PHOTOS} photos`);
                Alert.alert("Partial Success", `Saved ${successCount} out of ${TOTAL_PHOTOS} photos`);
            }

        } catch (error) {
            console.error(error);
            speakText("Error during capture");
            Alert.alert("Error", "Failed to capture or save images");
        } finally {
            setIsCapturing(false);
            setCaptureProgress(0);
        }
    };

    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>No access to camera</Text>
                    <TouchableOpacity
                        style={styles.permissionButton}
                        onPress={requestPermission}
                    >
                        <Text style={styles.permissionButtonText}>Grant Permission</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
                <View style={styles.overlay}>
                    <View style={styles.topControls}>
                        <TouchableOpacity onPress={toggleCamera} style={styles.iconButton}>
                            <Ionicons name="camera-reverse" size={32} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.bottomControls}>
                        <TouchableOpacity
                            onPress={takePicture}
                            style={styles.captureButton}
                            disabled={isCapturing}
                        >
                            {isCapturing ? (
                                <View style={styles.progressContainer}>
                                    <ActivityIndicator color="white" size="small" />
                                    <Text style={styles.progressText}>
                                        {captureProgress}/{TOTAL_PHOTOS}
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.captureButtonInner} />
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </CameraView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    camera: {
        flex: 1,
    },
    overlay: {
        flex: 1,
        backgroundColor: "transparent",
        justifyContent: "space-between",
        padding: 20,
    },
    topControls: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 20,
    },
    bottomControls: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 40,
    },
    iconButton: {
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 12,
        borderRadius: 30,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(255,255,255,0.3)",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 4,
        borderColor: "white",
    },
    captureButtonInner: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: "white",
    },
    permissionContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
    },
    permissionText: {
        color: "white",
        fontSize: 18,
        marginBottom: 20,
        textAlign: "center",
    },
    permissionButton: {
        backgroundColor: "#005FCC",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 8,
    },
    permissionButtonText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
    },
    progressContainer: {
        justifyContent: "center",
        alignItems: "center",
    },
    progressText: {
        color: "white",
        fontSize: 12,
        marginTop: 4,
        fontWeight: "bold",
    },
});

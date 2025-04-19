import React, { useState, useEffect, useRef } from "react";
import { View, Text, Button, StyleSheet } from "react-native";
import { Camera , CameraType } from "expo-camera";
import axios from "axios";

const API_KEY = "AIzaSyCoYQ0lz2LV2iDr6vEav7judHTW_1Am-zE";
const API_URL = "https://gemini.googleapis.com/v1/images:describe";
const CameraView = () => {
  const [hasPermission, setHasPermission] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [description, setDescription] = useState("");
  const cameraRef = useRef(null);
 const [facing, setFacing] = useState<CameraType>("back");


  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    })();
  }, []);

  // Capture image
  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setImageUri(photo.uri);
      uploadImageToGemini(photo.uri); // Send image to Gemini after capture
    }
  };

  // Send image to Gemini API
  const uploadImageToGemini = async (imageUri) => {
    const formData = new FormData();
    formData.append("image", {
      uri: imageUri,
      type: "image/jpeg", // Ensure it's correct based on your image type
      name: "photo.jpg",
    });

    try {
      const response = await axios.post(API_URL, formData, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "multipart/form-data",
        },
      });

      // Assuming response contains a 'description' field
      const { description } = response.data;
      setDescription(description);
    } catch (error) {
      console.error("Error uploading image to Gemini:", error);
    }
  };

  //if (hasPermission === null) {
    ///return <Text>Requesting for camera permission...</Text>;
  //}
  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <CameraView
                    ref={cameraRef}
                    style={StyleSheet.absoluteFill}
                    facing={facing}
                    animateShutter={false}
                />
      <Button title="Capture Image" onPress={takePicture} />
      {imageUri && (
        <View style={styles.imageContainer}>
          <Text>Image URI: {imageUri}</Text>
        </View>
      )}
      {description && (
        <View style={styles.descriptionContainer}>
          <Text>Description of surroundings: {description}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  camera: {
    width: "100%",
    height: "70%",
  },
  imageContainer: {
    marginTop: 20,
  },
  descriptionContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: "#f0f0f0",
    borderRadius: 5,
  },
});

export default CameraView;

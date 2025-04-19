// screens/DescribeScreen.tsx
import React from "react";
import { SafeAreaView, View, Text, StyleSheet, Dimensions } from "react-native";
import CameraView from "../components/CameraView";
import { useTranslation } from "../context/TranslationContext";

export default function DescribeScreen() {
  const { targetLanguage } = useTranslation();
  const [currentDescription, setCurrentDescription] = React.useState<string>("");

  const handleImageDescription = async (description: string) => {
    console.log("Image Description:", description);
    setCurrentDescription(description);
  };

  return (
    <View style={styles.container}>
      <CameraView onImageDescribed={handleImageDescription} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    height: Dimensions.get('window').height,
    width: Dimensions.get('window').width,
  },
  cameraContainer: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  descriptionContainer: {
    position: 'absolute',
    top: 80, // Below the router
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.3)', // Reduced opacity
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  descriptionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  }
});
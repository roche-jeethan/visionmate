// screens/DescribeScreen.tsx
import React from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";
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
    <SafeAreaView style={styles.container}>
      <View style={styles.cameraContainer}>
        <CameraView onImageDescribed={handleImageDescription} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    paddingTop: 60, // Add padding for router
  },
  cameraContainer: {
    flex: 0.8, // Take up 80% of the space
    backgroundColor: 'black',
  },
  descriptionContainer: {
    flex: 0.2, // Take up 20% of the space
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  descriptionText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  }
});
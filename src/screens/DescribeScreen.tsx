import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import CameraView from "../components/CameraView";
import { useTranslation } from "../context/TranslationContext";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";
import { useSpeech } from "../hooks/useSpeech";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

export default function DescribeScreen() {
  const { targetLanguage } = useTranslation();
  const [currentDescription, setCurrentDescription] = React.useState<string>("");

  // Add screen announcement
  useScreenAnnounce("Describe");
  const speakText = useSpeech();

  const [hasAnnouncedInstruction, setHasAnnouncedInstruction] = React.useState(false);

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

  const handleImageDescription = async (description: string) => {
    console.log("Image Description:", description);
    setCurrentDescription(description);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <CameraView onImageDescribed={handleImageDescription} />
      </View>
    </GestureHandlerRootView>
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
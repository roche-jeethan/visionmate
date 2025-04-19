import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useTranslation,
  SUPPORTED_LANGUAGES,
} from "../context/TranslationContext";
import { useSpeech } from "../hooks/useSpeech";
import { useScreenAnnounce } from "../hooks/useScreenAnnounce";

export default function SettingsScreen() {
  const { targetLanguage, setTargetLanguage, translateText, isLoading } =
    useTranslation();
  useScreenAnnounce("Settings");
  const speakText = useSpeech();
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const [translatedTitle, setTranslatedTitle] = useState("Language Settings");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  const uiStrings = {
    settings: "Settings",
  };

  useEffect(() => {
    const translateUI = async () => {
      if (targetLanguage === "en") {
        setTranslations(uiStrings);
        return;
      }

      setIsTranslating(true);
      try {
        const translated: Record<string, string> = {};
        for (const key in uiStrings) {
          translated[key] = await translateText(uiStrings[key]);
        }
        setTranslations(translated);
      } catch (error) {
        console.error("Translation error:", error);
        setTranslations(uiStrings); // fallback
      } finally {
        setIsTranslating(false);
      }
    };

    translateUI();
  }, [targetLanguage]);

  useEffect(() => {
    const translateTitle = async () => {
      const translated = await translateText("Language Settings");
      setTranslatedTitle(translated);
    };
    translateTitle();
  }, [targetLanguage, translateText]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    Animated.timing(animation, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleLanguageSelect = async (langCode: string) => {
    await setTargetLanguage(langCode);
    const confirmationText =
      langCode === "en"
        ? "Language changed to English"
        : "भाषा हिंदी में बदल दी गई है";
    await speakText(confirmationText);
  };

  const maxHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>
        {isTranslating ? "Translating..." : translations.settings}
      </Text>

      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>
          {isLoading ? "Loading..." : translatedTitle}
        </Text>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={24}
          color="#333"
        />
      </TouchableOpacity>

      <Animated.View style={[styles.languageList, { maxHeight }]}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[
              styles.languageItem,
              targetLanguage === lang.code && styles.selectedLanguage,
            ]}
            onPress={() => handleLanguageSelect(lang.code)}
          >
            <Text
              style={[
                styles.languageText,
                targetLanguage === lang.code && styles.selectedLanguageText,
              ]}
            >
              {lang.name}
            </Text>
            {targetLanguage === lang.code && (
              <Ionicons name="checkmark" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 30,
    fontWeight: "bold",
    margin: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#E6E6FA",
  },
  header: {
    backgroundColor: "#fff",
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    marginLeft: 16,
    marginRight: 16,
    borderRadius: 20,
  },
  headerText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  languageList: {
    overflow: "hidden",
  },
  languageItem: {
    backgroundColor: "#fff",
    padding: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    borderRadius: 20,
    marginTop: 2,
    marginLeft: 16,
    marginRight: 16,
  },
  selectedLanguage: {
    backgroundColor: "#005FCC",
  },
  languageText: {
    fontSize: 16,
    color: "#333",
  },
  selectedLanguageText: {
    color: "#fff",
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Button,
  Alert,
  ActivityIndicator,
  TextInput,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation, SUPPORTED_LANGUAGES } from '../context/TranslationContext';
import { useSpeech } from '../hooks/useSpeech';
import * as ImagePicker from 'expo-image-picker';

const MAX_IMAGES = 7;

export default function SettingsScreen() {
  const { targetLanguage, setTargetLanguage, translateText, isLoading: translationLoading } = useTranslation();
  const speakText = useSpeech();
  const [isExpanded, setIsExpanded] = useState(false);
  const [animation] = useState(new Animated.Value(0));
  const [translatedTitle, setTranslatedTitle] = useState('Language Settings');
  
  // Image capture states
  const [imageUris, setImageUris] = useState<{ uri: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personName, setPersonName] = useState('');

  useEffect(() => {
    const translateTitle = async () => {
      const translated = await translateText('Language Settings');
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
    const confirmationText = langCode === 'en' ? 
      'Language changed to English' : 
      'भाषा हिंदी में बदल दी गई है';
    await speakText(confirmationText);
  };

  const captureImages = async () => {
    if (!personName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name before capturing images.');
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission required', 'Camera access is needed to take pictures.');
      return;
    }

    try {
      const capturedImages: { uri: string }[] = [];
      let captured = 0;

      while (captured < MAX_IMAGES) {
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.7,
        });

        if (result.canceled || result.assets.length === 0) break;

        const newUri = result.assets[0].uri;
        capturedImages.push({ uri: newUri });
        setImageUris(prev => [...prev, { uri: newUri }]);
        captured++;

        if (captured < MAX_IMAGES) {
          Alert.alert(
            'Image Captured',
            `${captured} images captured. ${MAX_IMAGES - captured} remaining.`
          );
        }
      }

      Alert.alert('Capture Complete', `${captured} images captured successfully`);
    } catch (error) {
      console.error('Error capturing images:', error);
      Alert.alert('Error', 'Failed to capture images. Please try again.');
    }
  };

  const uploadImages = async () => {
    if (imageUris.length === 0) {
      Alert.alert('No Images', 'Please capture images first.');
      return;
    }

    if (!personName.trim()) {
      Alert.alert('Missing Name', 'Please enter a name before uploading.');
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      imageUris.forEach((img, idx) => {
        formData.append('images', {
          uri: img.uri,
          type: 'image/jpeg',
          name: `${personName.trim()}_${idx}.jpg`,
        } as any);
      });

      const SERVER_IP = process.env.SERVER_IP || '192.168.137.1';
      
      const orbResponse = await fetch(`http://${SERVER_IP}:8000/orb/process-images/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!orbResponse.ok) {
        throw new Error(`ORB processing failed: ${orbResponse.status}`);
      }

      const orbResult = await orbResponse.json();
      console.log('ORB Processing complete:', orbResult);

      Alert.alert('Success', `Images processed and descriptors saved for ${personName}`);
      setImageUris([]);
      setPersonName('');

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to process images. Please check server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const maxHeight = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200],
  });

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity 
        style={styles.header} 
        onPress={toggleExpand}
        activeOpacity={0.7}
      >
        <Text style={styles.headerText}>
          {translationLoading ? 'Loading...' : translatedTitle}
        </Text>
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
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
              targetLanguage === lang.code && styles.selectedLanguage
            ]}
            onPress={() => handleLanguageSelect(lang.code)}
          >
            <Text style={[
              styles.languageText,
              targetLanguage === lang.code && styles.selectedLanguageText
            ]}>
              {lang.name}
            </Text>
            {targetLanguage === lang.code && (
              <Ionicons name="checkmark" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>

      <View style={styles.imageSection}>
        <Text style={styles.title}>Instant Recognition</Text>
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#0000ff" />
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={personName}
              onChangeText={setPersonName}
              placeholder="Enter person's name"
              placeholderTextColor="#666"
            />

            <Button 
              title="Capture Images"
              onPress={captureImages}
              disabled={!personName.trim() || imageUris.length >= MAX_IMAGES}
            />

            <View style={styles.spacing} />

            {imageUris.length > 0 && (
              <ScrollView 
                horizontal 
                style={styles.imageScroll}
                contentContainerStyle={styles.imageContainer}
              >
                {imageUris.map((img, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image 
                      source={{ uri: img.uri }} 
                      style={styles.thumbnail}
                    />
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.spacing} />

            <Button
              title="Upload Images"
              onPress={uploadImages}
              disabled={imageUris.length === 0 || !personName.trim()}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  languageList: {
    overflow: 'hidden',
  },
  languageItem: {
    backgroundColor: '#fff',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedLanguage: {
    backgroundColor: '#005FCC',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  selectedLanguageText: {
    color: '#fff',
  },
  imageSection: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
    fontSize: 16,
  },
  spacing: {
    height: 20,
  },
  imageScroll: {
    maxHeight: 120,
  },
  imageContainer: {
    gap: 10,
  },
  imageWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 2,
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 3,
  },
});
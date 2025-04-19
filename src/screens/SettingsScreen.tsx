import React, { useState, useEffect } from 'react';
import { 
  View, 
  Button, 
  Alert, 
  ActivityIndicator, 
  TextInput, 
  Image, 
  ScrollView, 
  StyleSheet,
  Text 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const MAX_IMAGES = 7;

const SettingsScreen = () => {
  const [imageUris, setImageUris] = useState<{ uri: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [personName, setPersonName] = useState('');

  // Function to capture images
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

  // Function to upload images
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
      
      // First, process with ORB
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
      // Clear the captured images
      setImageUris([]);
      setPersonName('');

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert(
        'Error', 
        'Failed to process images. Please check server connection.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    marginBottom: 20,
    borderRadius: 5,
    fontSize: 16
  },
  spacing: {
    height: 20
  },
  imageScroll: {
    maxHeight: 120
  },
  imageContainer: {
    gap: 10
  },
  imageWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    padding: 2
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 3
  }
});

export default SettingsScreen;
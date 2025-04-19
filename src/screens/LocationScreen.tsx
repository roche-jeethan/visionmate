import React from 'react';
import { View, Text, Button, Alert, StyleSheet } from 'react-native';
import { useRef } from "react";
import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getDefaultContact } from '../services/userService';
import axios from 'axios';
import { SERVER_IP} from '../config/config';
import { TapGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSpeech } from '../hooks/useSpeech';
import { useFocusEffect } from '@react-navigation/native';

const LocationShare = () => {
  const doubleTapRef = React.useRef(null);
  const speakText = useSpeech();
  const isScreenFocused = useRef(false);

  useFocusEffect(
    React.useCallback(() => {
      speakText('Location screen, Double tap anywhere to send your location');
    }, [])
  );
  

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required');
      return null;
    }

    const location = await Location.getCurrentPositionAsync({});
    return location.coords;
  };

  const generateMapsLink = (lat: number, lon: number) => {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  };

  const getContactPhone = async (contactId: string): Promise<string> => {
    const db = getFirestore();
    
    const contactRef = doc(db, 'contacts', contactId); // Firestore uses collections
    const snapshot = await getDoc(contactRef);

    if (snapshot.exists()) {
    return snapshot.data().number;
    } else {
    throw new Error('Contact not found');
    }
  };

  /*const sendLocationViaWhatsApp = async (phone: string, locationUrl: string) => {
    const message = `Hi! I'm here: ${locationUrl}`;
    const whatsappUrl = `whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`;

    const canOpen = await Linking.canOpenURL(whatsappUrl);
    if (canOpen) {
      Linking.openURL(whatsappUrl);
    } else {
      Alert.alert('Error', 'WhatsApp is not installed on your device');
    }
  }; */

  const sendLocationViaWhatsApp = async (contact: string, locationUrl: string) => {
    const message = `Hi! I'm here: ${locationUrl}`;
    const number  = contact.replace(/\s+/g, '');
    try {
      const response = await axios.post(`http://${SERVER_IP}:8000/send-whatsapp`, {
        to: number,
        message
      });
      Alert.alert('WhatsApp Sent', `Status: ${response.data.status}`);
    } catch (error) {
      console.error('WhatsApp message failed:', error);
      Alert.alert('Failed', 'Could not send WhatsApp message.');
    }
  };

  const handleShareLocation = async () => {
    try {
      const coords = await getCurrentLocation();
      if (!coords) return;

      const mapLink = generateMapsLink(coords.latitude, coords.longitude);

      const phoneNumber = await getDefaultContact(); 
        console.log(phoneNumber);
      await sendLocationViaWhatsApp(phoneNumber, mapLink);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Something went wrong');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <TapGestureHandler
        ref={doubleTapRef}
        numberOfTaps={2}
        onActivated={handleShareLocation}
      >
        <View style={styles.container}>
          <Text style={styles.text}>Double tap anywhere to send your location.</Text>
        </View>
      </TapGestureHandler>
    </GestureHandlerRootView>
  );
};

export default LocationShare;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  text: {
    fontSize: 18,
    textAlign: 'center',
    paddingHorizontal: 20
  }
}); 
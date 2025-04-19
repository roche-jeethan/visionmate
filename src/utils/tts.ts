// utils/tts.ts
import * as Speech from "expo-speech";

export const speak = (text: string, lang: string = "en") => {
  Speech.speak(text, {
    language: lang,
    pitch: 1.0,
    rate: 1.0,
  });
};

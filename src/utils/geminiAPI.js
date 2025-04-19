// utils/geminiAPI.ts
import { GoogleGenAI, createUserContent } from "@google/genai";
import * as FileSystem from 'expo-file-system';

const GEMINI_API_KEY = "AIzaSyCoYQ0lz2LV2iDr6vEav7judHTW_1Am-zE";
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export const describeImage = async (imageUri, targetLang = 'en') => {
  try {
    console.log('📸 Starting image processing...', { imageUri });

    // Read the image file as base64
    const base64Data = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64
    });

    console.log('🤖 Requesting image description from Gemini...');

    const prompt = targetLang === 'hi' 
      ? "मैं अंधा हूं। मेरे परिवेश का संक्षेप में और स्पष्ट रूप से वर्णन करें, किसी भी चीज़ पर ध्यान केंद्रित करना जो मेरे आंदोलन या सुरक्षा को प्रभावित कर सकता है — जैसे कि लोग, वस्तुएं, या बाधाएं। मेरे तत्काल वातावरण में केवल प्रासंगिक विवरण शामिल करें जो मुझे एक ज्वलंत और सुखद मानसिक छवि बनाने में मदद करते हैं, इसलिए मैं आराम से और स्वतंत्र रूप से नेविगेट कर सकता हूं। इसे शांत और सरल रखें। ध्यान भंग करने से बचें, लेकिन मेरी यात्रा को आकर्षक और सुखद महसूस करें।"
      : "I am blind. Describe my surroundings briefly and clearly, focusing on anything that could affect my movement or safety — such as people, objects, or obstacles. Include only relevant details in my immediate environment that help me form a vivid and pleasant mental image, so I can navigate comfortably and independently. Keep it calm and simple. Avoid distractions, but make my journey feel engaging and enjoyable.";

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-lite",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data
              }
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      }
    });

    console.log('📝 Received response from Gemini');
    // The response already contains the text directly
    const description = response.text || "Could not generate description";
    console.log('🎯 Final description:', { description });
    return description;

  } catch (error) {
    console.error('❌ Error in describeImage:', {
      error: error.message,
      stack: error.stack,
      imageUri
    });
    return "Failed to process image";
  }
};
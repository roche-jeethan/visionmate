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
      ? "मैं अंधा हूँ। मेरे वातावरण का संक्षिप्त और स्पष्ट वर्णन करें, विशेष रूप से उन चीज़ों पर ध्यान केंद्रित करते हुए जो मेरी सुरक्षा और आवागमन को प्रभावित कर सकती हैं — जैसे कि लोग, वस्तुएँ, या बाधाएँ। मेरे तत्काल परिवेश में केवल वही प्रासंगिक विवरण शामिल करें जो मुझे एक ज्वलंत और सुखद मानसिक छवि बनाने में मदद करें, ताकि मैं आराम से और स्वतंत्र रूप से चल सकूँ। इसे शांत और सरल रखें। अनावश्यक विवरणों से बचें, लेकिन मेरी यात्रा को आकर्षक और सुखद बनाएँ"
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
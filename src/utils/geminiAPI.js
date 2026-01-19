// utils/geminiAPI.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as FileSystem from 'expo-file-system';
import { GEMINI_API_KEY } from '../config/config';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export const describeImage = async (imageUriOrBase64, targetLang = 'en') => {
  try {
    let base64Data;

    if (imageUriOrBase64.startsWith('data:image') || !imageUriOrBase64.includes('/') || imageUriOrBase64.length > 1000) {
      // It's likely base64 data already (strip prefix if present)
      base64Data = imageUriOrBase64.replace(/^data:image\/[a-z]+;base64,/, "");
      console.log('📸 Using provided base64 data');
    } else {
      // It's a URI
      console.log('📸 Reading image from URI...', { imageUri: imageUriOrBase64 });
      base64Data = await FileSystem.readAsStringAsync(imageUriOrBase64, {
        encoding: 'base64'
      });
    }

    if (!base64Data) {
      throw new Error("No image data found");
    }

    console.log('📸 Base64 data length:', base64Data.length);

    console.log('🤖 Requesting image description from Gemini...');

    const prompt = targetLang === 'hi'
      ? "मैं अंधा हूँ। मेरे वातावरण का संक्षिप्त और स्पष्ट वर्णन करें, विशेष रूप से उन चीज़ों पर ध्यान केंद्रित करते हुए जो मेरी सुरक्षा और आवागमन को प्रभावित कर सकती हैं — जैसे कि लोग, वस्तुएँ, या बाधाएँ। मेरे तत्काल परिवेश में केवल वही प्रासंगिक विवरण शामिल करें जो मुझे एक ज्वलंत और सुखद मानसिक छवि बनाने में मदद करें, ताकि मैं आराम से और स्वतंत्र रूप से चल सकूँ। इसे शांत और सरल रखें। अनावश्यक विवरणों से बचें, लेकिन मेरी यात्रा को आकर्षक और सुखद बनाएँ"
      : "I am blind. Describe my surroundings briefly and clearly, focusing on anything that could affect my movement or safety — such as people, objects, or obstacles. Include only relevant details in my immediate environment that help me form a vivid and pleasant mental image, so I can navigate comfortably and independently. Keep it calm and simple. Avoid distractions, but make my journey feel engaging and enjoyable.";

    // Use gemini-1.5-flash for better stability and speed
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Data
        }
      }
    ]);

    const response = await result.response;
    const description = response.text();

    console.log('📝 Received response from Gemini');
    console.log('🎯 Final description:', { description });
    return description;

  } catch (error) {
    console.error('❌ Error in describeImage:', error);
    return targetLang === 'hi'
      ? "छवि का वर्णन करने में विफल। कृपया पुन: प्रयास करें।"
      : "Failed to describe the image. Please try again.";
  }
};

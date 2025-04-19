// utils/geminiAPI.ts
import axios from "axios";

const GEMINI_API_KEY = "AIzaSyCoYQ0lz2LV2iDr6vEav7judHTW_1Am-zE"; 
export const describeImage = async (base64Image: string): Promise<string> => {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              { text: "Describe this image briefly in simple language." },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Image,
                },
              },
            ],
          },
        ],
      }
    );

    const description =
      response.data.candidates?.[0]?.content?.parts?.[0]?.text;
    return description || "Couldn't describe the image.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error contacting Gemini.";
  }
};
# VisionMate - Empowering the Blind & Visually Impaired

**VisionMate** is an intelligent mobile application designed to assist the visually impaired by combining real-time object detection, voice guidance, and emergency response functionalities. Built with a user-centric approach, VisionMate leverages the power of AI and modern mobile technologies to enable independence, safety, and accessibility in daily life.

---

## Features

### 1. Object Detection and Tracking
Detects objects in real time using advanced deep learning (YOLOv8) and provides auditory feedback about their location and movement.

### 2. Distance and Depth Estimation
Estimates object proximity and depth to help users navigate around obstacles safely.

### 3. Multilingual Interface
Supports multiple languages, enabling users to interact in their preferred language for better accessibility.

### 4. Describe Surroundings
Provides a comprehensive description of the user's environment, summarizing visible objects and spatial layout.

### 5. Fall Detection
Continuously monitors motion patterns to detect accidental falls and trigger alerts immediately.

### 6. SMS and Emergency Calling
In the event of danger or a fall, VisionMate automatically sends an SMS and places an emergency call using Twilio.

### 7. Location Tracking
Continuously tracks the user’s location and shares it with emergency contacts when needed.

### 8. Biometric Authentication
Secure login with FaceID and Fingerprint support ensures user data protection and easy access.

---

## Tech Stack

| Domain        | Technology Used |
|---------------|------------------|
| **Mobile App**   | React Native, Expo, TypeScript |
| **Backend**       | Python, PyTorch, TensorFlow |
| **Object Detection** | Ultralytics YOLOv8 |
| **Communication** | WebSocket |
| **Cloud & Services** | Firebase, Twilio |

---

## How It Works

1. **Real-Time Detection**: The YOLOv8 model detects and classifies objects using the phone’s camera.
2. **Depth Inference**: A lightweight model runs in the background estimating object distance.
3. **Audio Feedback**: Based on object type, direction, and proximity, speech is generated and played.
4. **Emergency Triggers**: If a fall is detected or help is needed, the app sends live location via SMS and places a call.
5. **Language Personalization**: Speech and interface are dynamically translated based on user preferences.


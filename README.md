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

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/visionmate.git
cd visionmate
```

### 2. Install Dependencies

Using Bun:

```bash
bun install
```

Using Python:

```bash
# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
# On Linux/macOS:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 3. Environment Variables Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Fill in your credentials in `.env`:

```env
EXPO_PUBLIC_SERVER_IP=your_server_ip

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone
TWILIO_WHATSAPP_NUMBER=your_whatsapp_number
```

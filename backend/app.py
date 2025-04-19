import os
from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import base64
from ultralytics import YOLO
from dotenv import load_dotenv
from translation import translate_text
from pydantic import BaseModel

class TranslationRequest(BaseModel):
    text: str
    target_lang: str
from orb import router as orb_router
import pickle
from pathlib import Path
import mediapipe as mp

mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

class DescriptorLoader:
    def __init__(self):
        self.descriptor_dir = Path("m:/visionmate/backend/src/descriptors")
        self.saved_descriptors = {}

    def load_descriptors(self):
        """Load all descriptor files from the descriptors directory"""
        try:
            # Create directory if it doesn't exist
            self.descriptor_dir.mkdir(parents=True, exist_ok=True)
            
            # Clear existing descriptors
            self.saved_descriptors.clear()
            
            # Load each .pkl file
            for pkl_file in self.descriptor_dir.glob("*_descriptors.pkl"):
                try:
                    with open(pkl_file, 'rb') as f:
                        data = pickle.load(f)
                        person_name = data['person_name']
                        self.saved_descriptors[person_name] = data
                        print(f"✅ Loaded descriptors for: {person_name}")
                        print(f"   - File: {pkl_file.name}")
                        print(f"   - Variations: {len(data['variations'])}")
                except Exception as e:
                    print(f"❌ Error loading {pkl_file.name}: {str(e)}")
                    continue

            print(f"\n📚 Total descriptors loaded: {len(self.saved_descriptors)} people")
            
            # Print details of loaded descriptors
            if self.saved_descriptors:
                print("\n📋 Loaded Descriptors Summary:")
                for person, data in self.saved_descriptors.items():
                    print(f"\n👤 {person}:")
                    print(f"   - Number of variations: {len(data['variations'])}")
                    for var in data['variations']:
                        print(f"   - {var['variation']}: {len(var['descriptors'])} descriptors")
            
            return self.saved_descriptors

        except Exception as e:
            print(f"❌ Error accessing descriptor directory: {str(e)}")
            return {}

    def get_descriptor(self, person_name: str):
        """Get descriptors for a specific person"""
        return self.saved_descriptors.get(person_name)

load_dotenv()
SERVER_IP = os.getenv("SERVER_IP")
if not SERVER_IP:
    raise ValueError("SERVER_IP not found in environment variables")

print(f"Server running on IP: {SERVER_IP}")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
print(f"Loading YOLO model from {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("Model loaded successfully")

def match_descriptors(frame_descriptors, saved_descriptors, min_matches=10):
    """Match frame descriptors with saved descriptors"""
    if not saved_descriptors:
        print("\n⚠️ No saved descriptors found")
        return None, 0
    
    best_match = None
    max_matches = 0
    
    # BFMatcher with Hamming distance
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    
    for person_name, person_data in saved_descriptors.items():
        for variation in person_data['variations']:
            stored_descriptors = np.array(variation['descriptors'])
            
            # Convert descriptors to same type if needed
            if frame_descriptors.dtype != stored_descriptors.dtype:
                stored_descriptors = stored_descriptors.astype(frame_descriptors.dtype)
            
            # Match descriptors
            matches = bf.match(frame_descriptors, stored_descriptors)
            
            # Filter good matches based on distance
            good_matches = [m for m in matches if m.distance < 50]
            num_matches = len(good_matches)
            
            if num_matches > max_matches and num_matches >= min_matches:
                max_matches = num_matches
                best_match = person_name
                
    return best_match, max_matches

async def process_frame_detection(frame, target_lang="en"):
    if frame is None:
        return None, "Invalid frame", []
    
    try:
        descriptor_loader = DescriptorLoader()
        descriptor_loader.load_descriptors()
        
        results = model(frame)[0]
        detected_objects = []
        boxes_info = []
        person_detected = False  # Add flag to track person detection
        
        for box in results.boxes:
            class_id = int(box.cls)
            class_name = model.names[class_id]
            confidence = float(box.conf[0])
            coords = [int(x) for x in box.xyxy[0].tolist()]
            
            if class_name == 'person':
                person_detected = True  # Set flag when person is detected
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results_mesh = face_mesh.process(rgb_frame)
                
                if results_mesh.multi_face_landmarks:
                    for face_landmarks in results_mesh.multi_face_landmarks:
                        h, w = frame.shape[:2]
                        x_coordinates = [int(landmark.x * w) for landmark in face_landmarks.landmark]
                        y_coordinates = [int(landmark.y * h) for landmark in face_landmarks.landmark]
                        
                        padding = 20
                        x1 = max(0, min(x_coordinates) - padding)
                        y1 = max(0, min(y_coordinates) - padding)
                        x2 = min(w, max(x_coordinates) + padding)
                        y2 = min(h, max(y_coordinates) + padding)
                        
                        face_crop = frame[y1:y2, x1:x2]
                        
                        if face_crop.size > 0:
                            orb = cv2.ORB_create(nfeatures=1000)
                            gray_face = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
                            keypoints, descriptors = orb.detectAndCompute(gray_face, None)
                            
                            # Only print descriptor info if person is detected
                            if person_detected and descriptors is not None:
                                print("\n🔍 Face ORB Features:")
                                print(f"   Image size: {gray_face.shape}")
                                print(f"   Keypoints found: {len(keypoints)}")
                                print(f"   Descriptor shape: {descriptors.shape}")
                                print("\n   Sample keypoints (first 3):")
                                for idx, kp in enumerate(keypoints[:3]):
                                    if descriptors is not None:
                                        person_name, num_matches = match_descriptors(
                                            descriptors, 
                                            descriptor_loader.saved_descriptors
                                        )
                                        
                                        if person_name:
                                            print(f"\n✅ Face Recognition Result:")
                                            print(f"   Matched Person: {person_name}")
                                            print(f"   Confidence: {num_matches} matches")
                                            
                                            # Update box info with recognized person
                                            box_info = {
                                                "label": f"Person: {person_name}",
                                                "matches": num_matches,
                                                "coords": coords,
                                                "confidence": confidence
                                            }
                                            boxes_info.append(box_info)
                                            
                                            # Draw name on frame (optional)
                                            cv2.putText(
                                                frame, 
                                                person_name, 
                                                (x1, y1 - 10),
                                                cv2.FONT_HERSHEY_SIMPLEX, 
                                                0.9, 
                                                (0, 255, 0), 
                                                2
                                            )
                                        else:
                                            print("\n❌ No match found for detected face")
            
        return results, "Detection completed", boxes_info

    except Exception as e:
        error_msg = translate_text("Detection error", target_lang)
        print(f" Detection error: {str(e)}")
        return None, error_msg, []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        await websocket.receive_text()
        lang_data = await websocket.receive_json()
        target_lang = lang_data.get("target_lang", "en")
        
        while True:
            data = await websocket.receive_text()
            frame_data = base64.b64decode(data)
            np_arr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            results, detection_text, boxes_info = await process_frame_detection(frame, target_lang)
            
            
            results, detection_text, boxes_info = await process_frame_detection(frame)
            
            await websocket.send_json({
                "translated_text": detection_text,
                "boxes": boxes_info,
                "status": "success"
            })
            
    except Exception as e:
        print(f" Error: {str(e)}")
        await websocket.close()

@app.post("/translate")
async def translate(request: TranslationRequest):
    try:
        translated_text = translate_text(request.text, request.target_lang)
        return {"translated_text": translated_text, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"status": "running", "server_ip": SERVER_IP}

# Add the ORB router
app.include_router(orb_router, prefix="/orb", tags=["orb"])
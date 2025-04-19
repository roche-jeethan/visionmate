import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
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
        # Update the path to match your system
        self.descriptor_dir = Path("M:/visionmate/src/descriptors")
        self.saved_descriptors = {}
        self.load_descriptors()  # Load descriptors on initialization

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
        results = model(frame)[0]
        detected_objects = []
        boxes_info = []
        
        for box in results.boxes:
            class_id = int(box.cls)
            class_name = model.names[class_id]
            confidence = float(box.conf[0])
            coords = [int(x) for x in box.xyxy[0].tolist()]
            
            if class_name == 'person' and confidence > 0.5:
                descriptor_loader = DescriptorLoader()
                saved_descriptors = descriptor_loader.saved_descriptors
                
                if saved_descriptors:
                    x1, y1, x2, y2 = coords
                    person_crop = frame[y1:y2, x1:x2]
                    
                    if person_crop.size > 0:
                        orb = cv2.ORB_create(nfeatures=1000)
                        gray = cv2.cvtColor(person_crop, cv2.COLOR_BGR2GRAY)
                        keypoints, current_descriptors = orb.detectAndCompute(gray, None)
                        
                        if current_descriptors is not None:
                            best_match, num_matches = match_descriptors(
                                current_descriptors,
                                saved_descriptors,
                                min_matches=10
                            )
                            
                            if best_match:
                                detection_msg = f"{best_match} detected"
                                translated_msg = await translate_text(detection_msg, target_lang)
                                detected_objects.append(translated_msg)
                                boxes_info.append({
                                    "label": best_match,
                                    "confidence": confidence,
                                    "coords": coords,
                                    "matches": num_matches
                                })
                                continue
                
                # If no face match or no descriptors, add as generic person
                translated_person = await translate_text("person", target_lang)
                detected_objects.append(translated_person)
                boxes_info.append({
                    "label": "person",
                    "coords": coords,
                    "confidence": confidence
                })
            
            else:
                # For non-person objects
                translated_name = await translate_text(class_name, target_lang)
                detected_objects.append(translated_name)
                boxes_info.append({
                    "label": class_name,
                    "coords": coords,
                    "confidence": confidence
                })

        # Prepare final detection text
        if not detected_objects:
            detection_text = await translate_text("No objects detected", target_lang)
        else:
            detection_text = ", ".join(set(detected_objects))
        
        print(f"Detection results: {detection_text}")
        return results, detection_text, boxes_info

    except Exception as e:
        print(f"Detection error: {str(e)}")
        error_msg = await translate_text("Detection error", target_lang)
        return None, error_msg, []

@app.websocket("/ws/video")
async def websocket_endpoint(websocket: WebSocket, target: str = "en"):
    await websocket.accept()
    try:
        while True:
            try:
                data = await websocket.receive_text()
                if not data:
                    continue
                    
                frame_data = base64.b64decode(data)
                np_arr = np.frombuffer(frame_data, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                
                results, detection_text, boxes_info = await process_frame_detection(frame, target)
                
                await websocket.send_json({
                    "translated_text": detection_text,
                    "boxes": boxes_info,
                    "status": "success"
                })
            except WebSocketDisconnect:
                print("Client disconnected")
                break
            except Exception as e:
                print(f"Error processing frame: {str(e)}")
                await websocket.send_json({
                    "error": str(e),
                    "status": "error"
                })
    finally:
        try:
            await websocket.close()
        except:
            pass

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
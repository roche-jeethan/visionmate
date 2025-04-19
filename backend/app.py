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
import asyncio
from concurrent.futures import ThreadPoolExecutor
from depth import get_depth

class TranslationRequest(BaseModel):
    text: str
    target_lang: str

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

depth_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="depth")

async def process_frame_detection(frame, target_lang="en"):
    if frame is None:
        print("🚫 Received invalid frame")
        return None, "Invalid frame"
    
    try:
        print("\n🔍 Starting object detection...")
        results = model(frame)[0]
        detected_objects = []
        boxes_info = []
        
        frame_width = frame.shape[1]  # Get frame width
        center_x = frame_width / 2
        
        for box in results.boxes:
            class_id = int(box.cls)
            class_name = model.names[class_id]
            coords = [int(x) for x in box.xyxy[0].tolist()]
            confidence = float(box.conf)
            
            # Calculate object's center x-coordinate
            object_center_x = (coords[0] + coords[2]) / 2
            
            # Determine position
            position = "center"
            dead_zone = frame_width * 0.05  # 5% dead zone
            
            if object_center_x < (center_x - dead_zone):
                position = "left"
            elif object_center_x > (center_x + dead_zone):
                position = "right"
            
            translated_name = translate_text(class_name, target_lang)
            
            box_info = {
                "label": translated_name,
                "confidence": confidence,
                "box": coords,
                "position": position
            }
            
            detected_objects.append(translated_name)
            boxes_info.append(box_info)
            
            print(f"📦 Detected Object:")
            print(f"  - Label: {translated_name}")
            print(f"  - Position: {position} ({coords})")
            print(f"  - Confidence: {confidence:.2f}")
            
        detection_text = ", ".join(set(detected_objects)) if detected_objects else "No objects detected"
        if not detected_objects:
            print("⚠️ No objects detected in frame")
            detection_text = translate_text("No objects detected", target_lang)
        else:
            print(f"✅ Found {len(detected_objects)} objects")
            
        return results, detection_text, boxes_info
        
    except Exception as e:
        print(f"❌ Detection error: {str(e)}")
        error_msg = translate_text("Detection error", target_lang)
        return None, error_msg, []

async def process_frame_depth(frame):
    if frame is None:
        return None
    try:
        depth_result = await asyncio.get_event_loop().run_in_executor(
            depth_executor,
            get_depth,
            frame
        )
        if isinstance(depth_result, dict):
            return depth_result
        return {"depth": depth_result, "confidence": 1.0, "method": "default"}
    except Exception as e:
        print(f"❌ Depth error: {str(e)}")
        return None

@app.websocket("/ws/video")
async def video_stream(websocket: WebSocket):
    await websocket.accept()
    print(f" WebSocket connection established on {SERVER_IP}")
    
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
            depth_result = await process_frame_depth(frame)
            
            await websocket.send_json({
                "translated_text": detection_text,
                "boxes": boxes_info,
                "depth": depth_result,
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

@app.get("/depth")
async def get_depth_value():
    """API endpoint to return the estimated depth in cm."""
    distance = get_depth()
    if distance is None:
        return {"error": "Failed to capture depth"}
    return {"estimated_distance_cm": distance}

@app.on_event("shutdown")
async def shutdown_event():
    depth_executor.shutdown(wait=True)
import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np
import base64
from ultralytics import YOLO
from dotenv import load_dotenv


load_dotenv()
SERVER_IP ="192.168.137.1"

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
print(f"Loading YOLO model from {MODEL_PATH}")
model = YOLO(MODEL_PATH)
print("Model loaded successfully")
print(" Model loaded successfully")

async def process_frame_detection(frame):
    if frame is None:
        return None, "Invalid frame"
    
    try:
        
        results = model(frame)[0]

        
        
        detected_objects = []
        boxes_info = []
        
        for box in results.boxes:
            
            class_id = int(box.cls)
            class_name = model.names[class_id]
            confidence = float(box.conf[0])
            coords = [int(x) for x in box.xyxy[0].tolist()]  # Convert to integers immediately
            
            box_info = {
                "label": class_name,
                "box": coords
            }
            
            detected_objects.append(class_name)
            boxes_info.append(box_info)
            
            
            print(f"\nDetection:")
            print(f"{{\n  \"label\": \"{class_name}\",\n  \"box\": {coords}\n}}")
            
        detection_text = ", ".join(set(detected_objects)) if detected_objects else "No objects detected"
        return results, detection_text, boxes_info
        
    except Exception as e:
        print(f" Detection error: {str(e)}")
        return None, "Detection error", []

@app.websocket("/ws/video")
async def video_stream(websocket: WebSocket):
    await websocket.accept()
    print(f" WebSocket connection established on {SERVER_IP}")
    
    try:
        while True:
            data = await websocket.receive_text()
            frame_data = base64.b64decode(data)
            np_arr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
            
            
            results, detection_text, boxes_info = await process_frame_detection(frame)
            
           
            await websocket.send_json({
                "translated_text": detection_text,
                "boxes": boxes_info,
                "status": "success"
            })
            
    except Exception as e:
        print(f" Error: {str(e)}")
        await websocket.close()

@app.get("/")
async def root():
    return {"status": "running", "server_ip": SERVER_IP}
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
from twilio_calls import router as twilio_router
import time
import logging

class TranslationRequest(BaseModel):
    text: str
    target_lang: str

load_dotenv()
EXPO_PUBLIC_SERVER_IP = os.getenv("EXPO_PUBLIC_SERVER_IP")
if not EXPO_PUBLIC_SERVER_IP:
    raise ValueError("EXPO_PUBLIC_SERVER_IP not found in environment variables")

print(f"Server running on IP: {EXPO_PUBLIC_SERVER_IP}")

app = FastAPI()

app.include_router(twilio_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
# configure basic logging (keeps console output tidy)
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# detection tuning (can be overridden via env)
YOLO_CONF = float(os.getenv("YOLO_CONF", 0.25))
YOLO_IOU = float(os.getenv("YOLO_IOU", 0.5))

# stats / logging control
_last_detection_ready_logged = False
_last_stats_log_time = 0.0
_STATS_LOG_INTERVAL = 1.0  # seconds - aggregate/log stats every N seconds
_stats_acc = {"frames": 0, "total_time": 0.0}

# warm up / preload model (reduces first-frame latency)
try:
    logger.info(f"Loading YOLO model from {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    # small warmup pass
    warmup_img = np.zeros((640, 640, 3), dtype=np.uint8)
    wstart = time.time()
    model(warmup_img)  # warmup
    wtime = time.time() - wstart
    logger.info(f"Model loaded and warmed up ({wtime * 1000:.1f}ms)")
except Exception as e:
    logger.exception("Failed to load YOLO model")
    raise


depth_executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="depth")


async def process_frame_detection(frame, target_lang="en"):
    global _last_detection_ready_logged, _last_stats_log_time, _stats_acc

    if frame is None:
        return None, "Invalid frame", []

    try:
        # Log readiness only once to avoid repetitive "starting detection" messages
        if not _last_detection_ready_logged:
            logger.info("🔍 Detector ready (continuous detection mode)")
            _last_detection_ready_logged = True

        # timing
        start_total = time.time()

        # Preprocess (explicit resize to model size keeps things consistent)
        t0 = time.time()
        logger.info(f"📸 Frame shape: {frame.shape}")
        img = cv2.resize(frame, (640, 640))
        preprocess_time = time.time() - t0

        # Inference (use conf and iou params; Ultralyics applies NMS internally)
        t1 = time.time()
        logger.info("🧠 Running YOLO inference")
        results = model(img, conf=YOLO_CONF, iou=YOLO_IOU)[0]
        inference_time = time.time() - t1

        # Postprocess - extract boxes
        t2 = time.time()
        boxes_info = []
        detected_labels = []

        for box in results.boxes:
            class_id = int(box.cls)
            class_name = model.names[class_id]
            coords = [int(x) for x in box.xyxy[0].tolist()]
            confidence = float(box.conf)

            # Clamp coordinates to frame boundaries (640x640)
            coords = [
                max(0, min(coords[0], 639)),
                max(0, min(coords[1], 639)),
                max(0, min(coords[2], 639)),
                max(0, min(coords[3], 639))
            ]

            object_center_x = (coords[0] + coords[2]) / 2
            
            # Spatial Classification (Direction) per user request
            model_width = 640
            if object_center_x < (model_width * 0.33):
                position = "left"
            elif object_center_x > (model_width * 0.66):
                position = "right"
            else:
                position = "center"

            # Translation with local per-frame cache for speed
            if target_lang == "en":
                translated_name = class_name
            else:
                translated_name = translate_text(class_name, target_lang)

            boxes_info.append(
                {
                    "label": translated_name,
                    "confidence": confidence,
                    "box": coords,
                    "position": position,
                }
            )
            detected_labels.append(translated_name)

        postprocess_time = time.time() - t2
        total_time = time.time() - start_total

        # accumulate stats and print aggregated stats at intervals
        _stats_acc["frames"] += 1
        _stats_acc["total_time"] += total_time
        now = time.time()
        if now - _last_stats_log_time >= _STATS_LOG_INTERVAL:
            avg_time = _stats_acc["total_time"] / max(1, _stats_acc["frames"])
            fps = 1.0 / avg_time if avg_time > 0 else float("inf")
            logger.info(
                f"⏱️  Timing (avg over {_stats_acc['frames']} frames): "
                f"pre={preprocess_time * 1000:.1f}ms inf={inference_time * 1000:.1f}ms post={postprocess_time * 1000:.1f}ms total={avg_time * 1000:.1f}ms fps={fps:.1f}"
            )
            _stats_acc = {"frames": 0, "total_time": 0.0}
            _last_stats_log_time = now

        # Build detection summary text
        if detected_labels:
            unique_labels = sorted(set(detected_labels))
            detection_text = ", ".join(unique_labels)
        else:
            detection_text = translate_text("No objects detected", target_lang)
            logger.debug("⚠️ No objects detected in frame")

        return results, detection_text, boxes_info

    except Exception as e:
        logger.exception(f"❌ Detection error: {e}")
        error_msg = translate_text("Detection error", target_lang)
        return None, error_msg, []


async def process_frame_depth(frame, boxes):
    if frame is None or not boxes:
        return []
    try:
        depth_result = await asyncio.get_event_loop().run_in_executor(
            depth_executor, get_depth, frame, boxes
        )
        return depth_result if depth_result else []
    except Exception as e:
        logger.error(f"❌ Depth error: {str(e)}")
        return []



@app.websocket("/ws/video")
async def video_stream(websocket: WebSocket):
    await websocket.accept()
    print(f" WebSocket connection established on {EXPO_PUBLIC_SERVER_IP}")

    try:
        # Robust initialization: receive target language once as JSON
        init_msg = await websocket.receive_json()
        target_lang = init_msg.get("target_lang", "en")
        logger.info(f"🌐 WebSocket started with language: {target_lang}")

        while True:
            data = await websocket.receive_text()
            
            try:
                # Expo Camera base64 decoding with padding fix
                jpg_bytes = base64.b64decode(data + "===")
                np_arr = np.frombuffer(jpg_bytes, dtype=np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if frame is None:
                    logger.warning("⚠️ Frame decode failed")
                    continue
            except Exception as e:
                logger.error(f"❌ Decode error: {e}")
                continue

            results, detection_text, boxes_info = await process_frame_detection(
                frame, target_lang
            )
            
            # Only run depth if we found objects, to save CPU
            depth_result = []
            if boxes_info:
                depth_result = await process_frame_depth(frame, boxes_info)

            await websocket.send_json(
                {
                    "translated_text": detection_text,
                    "boxes": boxes_info,
                    "depth": depth_result,
                    "count": len(boxes_info),
                    "status": "success",
                }
            )

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
    return {"status": "running", "server_ip": EXPO_PUBLIC_SERVER_IP}


@app.get("/depth")
async def get_depth_value():
    """API endpoint to return the estimated depth in cm."""
    return {"error": "Endpoint disabled. Use WebSocket for real-time depth."}


@app.on_event("shutdown")
async def shutdown_event():
    depth_executor.shutdown(wait=True)

# Initialize Face Recognition Engine
from vision_mate_insight import VisionMateInsight
try:
    face_engine = VisionMateInsight(db_path="../faces_db")
    logger.info("Face recognition engine initialized")
except Exception as e:
    logger.error(f"Failed to initialize face recognition engine: {e}")
    face_engine = None

@app.websocket("/ws/face")
async def face_stream(websocket: WebSocket):
    await websocket.accept()
    print(f"Face WebSocket connection established on {EXPO_PUBLIC_SERVER_IP}")

    try:
        if face_engine is None:
            await websocket.close(code=1011, reason="Face engine not initialized")
            return

        while True:
            data = await websocket.receive_text()
            try:
                frame_data = base64.b64decode(data)
                np_arr = np.frombuffer(frame_data, np.uint8)
                frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

                if frame is None:
                    continue

                # Resize to 640x640 to match frontend scaling
                frame = cv2.resize(frame, (640, 640))

                # Process frame for faces
                faces = await asyncio.get_event_loop().run_in_executor(
                    None, face_engine.process_frame, frame
                )

                await websocket.send_json({
                    "faces": faces,
                    "status": "success"
                })
            except Exception as e:
                print(f"Frame processing error: {e}")
                await websocket.send_json({"status": "error", "message": str(e)})

    except Exception as e:
        print(f"Face WebSocket Error: {str(e)}")
    finally:
        try:
            await websocket.close()
        except:
            pass

class AddPersonRequest(BaseModel):
    image: str # base64 string
    name: str = "new_user" # Optional name, default to new_user

@app.post("/add_person")
async def add_person(request: AddPersonRequest):
    try:
        # Define user directory based on name
        # If name is "new_user", we might want to put it in a generic folder or handle it differently
        # For now, let's follow the user's suggestion of using a specific folder for the person
        
        # We need to access the db_path from the face_engine instance if possible, 
        # or construct it relative to the project structure.
        # The face_engine was initialized with "../faces_db"
        
        base_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../faces_db"))
        user_dir = os.path.join(base_db_path, request.name)
        os.makedirs(user_dir, exist_ok=True)
        
        # Decode image
        image_data = base64.b64decode(request.image)
        
        # Generate filename with timestamp
        filename = f"photo_{int(time.time())}.jpg"
        filepath = os.path.join(user_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(image_data)
            
        logger.info(f"Saved new person photo to {filepath}")
        
        # Incremental Update
        if face_engine:
            success = face_engine.add_single_image_to_db(filepath, request.name)
            if success:
                return {"status": "success", "filename": filename, "message": f"Added {filename}"}
            else:
                # Even if face detection fails, we saved the photo. 
                # But for the purpose of "adding a person", it might be considered a partial failure if no face found.
                # The user's snippet returns error if no face detected.
                return {"status": "error", "message": "No face detected in the image"}
        
        return {"status": "success", "filename": filename, "message": "Saved to disk (engine not loaded)"}
    except Exception as e:
        logger.error(f"Failed to add person: {e}")
        raise HTTPException(status_code=500, detail=str(e))

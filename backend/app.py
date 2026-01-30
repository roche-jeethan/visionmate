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
SERVER_IP = os.getenv("SERVER_IP")
if not SERVER_IP:
    raise ValueError("SERVER_IP not found in environment variables")

print(f"Server running on IP: {SERVER_IP}")

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


# Utility: IoU and NMS (helps remove duplicate detections)
def _calculate_iou(box1, box2):
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2

    xi1 = max(x1_1, x1_2)
    yi1 = max(y1_1, y1_2)
    xi2 = min(x2_1, x2_2)
    yi2 = min(y2_1, y2_2)

    if xi2 <= xi1 or yi2 <= yi1:
        return 0.0

    inter = (xi2 - xi1) * (yi2 - yi1)
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    union = area1 + area2 - inter
    return inter / union if union > 0 else 0.0


def _non_max_suppression(dets, iou_thresh=0.5):
    """dets: list of {class_id, confidence, bbox} -> returns filtered list"""
    if not dets:
        return []
    # Sort by confidence descending
    dets = sorted(dets, key=lambda d: d["confidence"], reverse=True)
    keep = []
    while dets:
        best = dets.pop(0)
        keep.append(best)
        remaining = []
        for d in dets:
            if (
                d["class_id"] == best["class_id"]
                and _calculate_iou(best["bbox"], d["bbox"]) > iou_thresh
            ):
                # suppress
                continue
            remaining.append(d)
        dets = remaining
    return keep


depth_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="depth")


async def process_frame_detection(frame, target_lang="en"):
    global _last_detection_ready_logged, _last_stats_log_time, _stats_acc

    if frame is None:
        logger.warning("🚫 Received invalid frame")
        return None, "Invalid frame"

    try:
        # Log readiness only once to avoid repetitive "starting detection" messages
        if not _last_detection_ready_logged:
            logger.info("🔍 Detector ready (continuous detection mode)")
            _last_detection_ready_logged = True

        # timing
        start_total = time.time()

        # Preprocess (explicit resize to model size keeps things consistent)
        t0 = time.time()
        img = cv2.resize(frame, (640, 640))
        preprocess_time = time.time() - t0

        # Inference (use conf and iou params; Ultralyics applies NMS internally)
        t1 = time.time()
        results = model(img, conf=YOLO_CONF, iou=YOLO_IOU)[0]
        inference_time = time.time() - t1

        # Postprocess - extract boxes, apply an extra NMS to be sure duplicates are removed
        t2 = time.time()
        detections = []
        frame_width = frame.shape[1]
        center_x = frame_width / 2

        for box in results.boxes:
            class_id = int(box.cls)
            coords = [int(x) for x in box.xyxy[0].tolist()]  # [x1,y1,x2,y2]
            confidence = float(box.conf)
            # filter by conf just in case
            if confidence < YOLO_CONF:
                continue
            detections.append(
                {"class_id": class_id, "confidence": confidence, "bbox": coords}
            )

        # Additional NMS to remove remaining duplicate boxes (use same IOU threshold)
        detections = _non_max_suppression(detections, iou_thresh=YOLO_IOU)

        boxes_info = []
        detected_labels = []

        for det in detections:
            class_name = model.names[det["class_id"]]
            coords = det["bbox"]
            confidence = det["confidence"]

            object_center_x = (coords[0] + coords[2]) / 2
            position = "center"
            dead_zone = frame_width * 0.05
            if object_center_x < (center_x - dead_zone):
                position = "left"
            elif object_center_x > (center_x + dead_zone):
                position = "right"

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
            logger.info(
                f"✅ Detections: {len(unique_labels)} unique -> {detection_text}"
            )
        else:
            detection_text = translate_text("No objects detected", target_lang)
            logger.debug("⚠️ No objects detected in frame")

        return results, detection_text, boxes_info

    except Exception as e:
        logger.exception(f"❌ Detection error: {e}")
        error_msg = translate_text("Detection error", target_lang)
        return None, error_msg, []


async def process_frame_depth(frame):
    if frame is None:
        return None
    try:
        depth_result = await asyncio.get_event_loop().run_in_executor(
            depth_executor, get_depth, frame
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

            results, detection_text, boxes_info = await process_frame_detection(
                frame, target_lang
            )
            depth_result = await process_frame_depth(frame)

            await websocket.send_json(
                {
                    "translated_text": detection_text,
                    "boxes": boxes_info,
                    "depth": depth_result,
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
    print(f"Face WebSocket connection established on {SERVER_IP}")

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

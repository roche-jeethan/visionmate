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
import platform
import subprocess


class TranslationRequest(BaseModel):
    text: str
    target_lang: str


def is_intel_cpu():
    """Check if the CPU is Intel."""
    try:
        if platform.system().lower() == "linux":
            with open("/proc/cpuinfo", "r") as f:
                content = f.read().lower()
                return "intel" in content or "genuine intel" in content
        elif platform.system().lower() == "windows":
            result = subprocess.run(
                ["wmic", "cpu", "get", "name"], capture_output=True, text=True
            )
            return "intel" in result.stdout.lower()
        elif platform.system().lower() == "darwin":  # macOS
            result = subprocess.run(
                ["sysctl", "-n", "machdep.cpu.brand_string"],
                capture_output=True,
                text=True,
            )
            return "intel" in result.stdout.lower()
    except Exception:
        pass
    return False


def initialize_model():
    """Initialize the optimal model based on hardware."""
    base_path = os.path.dirname(os.path.abspath(__file__))

    # Check if Intel CPU and try OpenVINO
    if is_intel_cpu():
        openvino_path = os.path.join(base_path, "yolov8n_openvino_model")
        xml_file = os.path.join(openvino_path, "yolov8n.xml")

        if os.path.exists(xml_file):
            try:
                import openvino as ov

                print("⚡ Attempting to use OpenVINO model for Intel CPU...")

                core = ov.Core()
                ov_model = core.read_model(model=xml_file)
                compiled_model = core.compile_model(ov_model, device_name="CPU")

                print("✅ OpenVINO model loaded successfully")
                return compiled_model, "openvino"

            except Exception as e:
                print(f"❌ OpenVINO failed: {e}")
                print("🔄 Falling back to standard PyTorch model...")

    # Fallback to standard YOLO
    MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "yolov8n.pt")
    print(f"🔧 Loading standard YOLO model from {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    print("✅ Standard YOLO model loaded successfully")
    return model, "pytorch"


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

# Initialize model
model, model_type = initialize_model()

# COCO class names for OpenVINO (since we can't access model.names)
COCO_CLASSES = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "backpack",
    "umbrella",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush",
]

depth_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="depth")


def process_openvino_output(output, frame, conf_threshold=0.25):
    """Process OpenVINO model output to extract bounding boxes and classes."""
    detections = []

    # OpenVINO output shape is typically [1, 84, 8400] for YOLOv8
    # where 84 = 4 (bbox coords) + 80 (class scores)
    output = output.squeeze()  # Remove batch dimension

    if len(output.shape) == 2:
        output = output.transpose()  # Make it [8400, 84]

    frame_height, frame_width = frame.shape[:2]

    for detection in output:
        # Extract bbox coordinates and class scores
        x_center, y_center, width, height = detection[:4]
        class_scores = detection[4:]

        # Get class with highest confidence
        class_id = np.argmax(class_scores)
        confidence = class_scores[class_id]

        if confidence < conf_threshold:
            continue

        # Convert to corner coordinates
        x1 = int((x_center - width / 2) * frame_width)
        y1 = int((y_center - height / 2) * frame_height)
        x2 = int((x_center + width / 2) * frame_width)
        y2 = int((y_center + height / 2) * frame_height)

        # Clamp coordinates
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame_width, x2), min(frame_height, y2)

        detections.append(
            {
                "class_id": class_id,
                "confidence": float(confidence),
                "bbox": [x1, y1, x2, y2],
            }
        )

    return detections


async def process_frame_detection(frame, target_lang="en"):
    if frame is None:
        print("🚫 Received invalid frame")
        return None, "Invalid frame"

    try:
        print("\n🔍 Starting object detection...")

        if model_type == "openvino":
            # OpenVINO inference
            input_tensor = cv2.resize(frame, (640, 640))
            input_tensor = input_tensor.transpose(2, 0, 1)  # HWC to CHW
            input_tensor = np.expand_dims(input_tensor, axis=0)  # Add batch dimension
            input_tensor = input_tensor.astype(np.float32) / 255.0  # Normalize

            output = model(input_tensor)[0]
            detections = process_openvino_output(output, frame)

        else:
            # Standard YOLO inference
            results = model(frame)[0]
            detections = []
            for box in results.boxes:
                class_id = int(box.cls)
                class_name = model.names[class_id]
                coords = [int(x) for x in box.xyxy[0].tolist()]
                confidence = float(box.conf)

                detections.append(
                    {
                        "class_id": class_id,
                        "confidence": confidence,
                        "bbox": coords,
                        "class_name": class_name,
                    }
                )

        detected_objects = []
        boxes_info = []
        frame_width = frame.shape[1]
        center_x = frame_width / 2

        for det in detections:
            if model_type == "openvino":
                class_name = (
                    COCO_CLASSES[det["class_id"]]
                    if det["class_id"] < len(COCO_CLASSES)
                    else "unknown"
                )
            else:
                class_name = det.get("class_name", COCO_CLASSES[det["class_id"]])

            coords = det["bbox"]
            confidence = det["confidence"]

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
                "position": position,
            }

            detected_objects.append(translated_name)
            boxes_info.append(box_info)

            print("📦 Detected Object:")
            print(f"  - Label: {translated_name}")
            print(f"  - Position: {position} ({coords})")
            print(f"  - Confidence: {confidence:.2f}")

        detection_text = (
            ", ".join(set(detected_objects))
            if detected_objects
            else "No objects detected"
        )
        if not detected_objects:
            print("⚠️ No objects detected in frame")
            detection_text = translate_text("No objects detected", target_lang)
        else:
            print(f"✅ Found {len(detected_objects)} objects")

        return (
            None,
            detection_text,
            boxes_info,
        )  # Return None for results since we handle both cases

    except Exception as e:
        print(f"❌ Detection error: {str(e)}")
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

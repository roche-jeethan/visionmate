import cv2
import torch
import numpy as np
from transformers import pipeline
from PIL import Image

# -----------------------------
# Camera parameters
# -----------------------------
FOCAL_LENGTH_PX = 850     # calibrate for your phone
PERSON_HEIGHT_M = 1.7

# -----------------------------
# Load Depth Anything once
# -----------------------------
device = 0 if torch.cuda.is_available() else -1
print("🧠 Loading Depth Anything V2...")

depth_pipe = pipeline(
    task="depth-estimation",
    model="depth-anything/Depth-Anything-V2-Small-hf",
    device=device
)

print("✅ Depth model ready")

# -----------------------------
# Main function used by FastAPI
# -----------------------------
def get_depth(frame, boxes):
    """
    frame: OpenCV BGR image
    boxes: [{ "label": str, "box": [x1,y1,x2,y2] }]
    """

    if frame is None or boxes is None:
        return None

    h, w = frame.shape[:2]

    # Convert to RGB → PIL
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)

    # Run depth model
    depth = depth_pipe(pil_img)["depth"]
    depth_map = np.array(depth, dtype=np.float32)
    depth_map = cv2.resize(depth_map, (w, h))

    # Normalize depth for stability
    depth_norm = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min())

    results = []

    for obj in boxes:
        x1, y1, x2, y2 = obj["box"]
        label = obj["label"]

        box_height = y2 - y1
        if box_height < 30:
            continue

        # Object real height estimate
        if label.lower() == "person":
            H = PERSON_HEIGHT_M
        else:
            H = 1.5   # generic object height

        # Geometry-based distance
        distance_geom = (FOCAL_LENGTH_PX * H) / box_height

        # Depth-based correction
        roi = depth_norm[y1:y2, x1:x2]
        if roi.size == 0:
            continue

        depth_factor = float(np.median(roi))

        # Final fused metric distance
        distance_m = distance_geom * (0.5 + depth_factor)

        results.append({
            "label": label,
            "distance_m": round(float(distance_m), 2)
        })

    return results

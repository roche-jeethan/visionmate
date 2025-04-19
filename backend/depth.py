import cv2
import torch
import numpy as np
from collections import deque
from transformers import pipeline
from PIL import Image

device = "cuda" if torch.cuda.is_available() else "cpu"
pipe = pipeline(
    task="depth-estimation", 
    model="depth-anything/Depth-Anything-V2-Small-hf", 
    device=0 if device == "cuda" else -1
)


FOCAL_LENGTH = 900  
KNOWN_OBJECT_HEIGHT = 1.725  
PIXEL_HEIGHT = 1360  


distance_buffer = deque(maxlen=10)

def get_depth(frame, detected_objects=None):
   
    if frame is None:
        return {"depth": None, "error": "No frame provided"}

    try:
        
        image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        
        with torch.no_grad():
            depth_output = pipe(image)["depth"]

        depth_np = np.array(depth_output)

        
        h, w = depth_np.shape
        center_depth_value = depth_np[h // 2, w // 2]

       
        estimated_distance_cm = (FOCAL_LENGTH * KNOWN_OBJECT_HEIGHT) / (center_depth_value * PIXEL_HEIGHT + 1e-6) * 100

        
        distance_buffer.append(estimated_distance_cm)
        smoothed_distance = np.mean(distance_buffer)
        rounded_distance = round(smoothed_distance, 1)


        
        response = {
            "depth": rounded_distance,
            "confidence": min(len(distance_buffer) / 10.0, 1.0),
            "unit": "cm",
            "method": "depth-anything-v2"
        }

        return response

    except Exception as e:
        print(f"Depth estimation error: {str(e)}")
        return {"depth": None, "error": str(e)}

    finally:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

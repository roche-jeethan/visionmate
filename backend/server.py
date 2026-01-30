import asyncio
import base64
import cv2
import numpy as np
import os
import time
from fastapi import FastAPI, WebSocket
from pydantic import BaseModel
from vision_mate_insight import VisionMateInsight

app = FastAPI()
# Initialize your AI engine
engine = VisionMateInsight(db_path="../faces_db")

class AddPersonRequest(BaseModel):
    image: str
    name: str

@app.post("/add_person")
async def add_person(request: AddPersonRequest):
    try:
        # Decode image
        img_bytes = base64.b64decode(request.image)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"status": "error", "message": "Invalid image"}

        # Create folder if not exists
        # Use the engine's absolute path to be safe, or relative to where server runs
        # engine.db_path is absolute.
        person_dir = os.path.join(engine.db_path, request.name)
        os.makedirs(person_dir, exist_ok=True)
        
        # Save image
        filename = f"{int(time.time() * 1000)}.jpg"
        filepath = os.path.join(person_dir, filename)
        cv2.imwrite(filepath, img)
        
        # Update in-memory db
        success = engine.add_single_image_to_db(filepath, request.name)
        
        if success:
            return {"status": "success", "filepath": filepath}
        else:
            # Even if face not detected by InsightFace for embedding, we saved the image.
            # But maybe we should delete it if it's not useful?
            # For now, let's keep it as the user just said "store the person pictures".
            # But the return status is checked by frontend.
            # If add_single_image_to_db returns False, it means no face found.
            # The frontend expects "status": "success".
            # If we return error, frontend says "Partial Success".
            return {"status": "error", "message": "Face not detected"}
            
    except Exception as e:
        print(f"Error adding person: {e}")
        return {"status": "error", "message": str(e)}

@app.websocket("/ws/face")
async def face_recognition_websocket(websocket: WebSocket):
    await websocket.accept()
    print("Mobile app connected.")
    
    try:
        while True:
            # 1. Receive Base64 string from React Native
            data = await websocket.receive_text()
            
            # 2. Decode Base64 to OpenCV Image
            img_bytes = base64.b64decode(data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is not None:
                # Resize to 640x640 to match the frontend scaling assumptions
                frame = cv2.resize(frame, (640, 640))

                # 3. Process with InsightFace
                results = engine.process_frame(frame)
                
                # 4. Send names and box coordinates back to mobile
                await websocket.send_json({
                    "status": "success",
                    "faces": results
                })
    except Exception as e:
        print(f"Connection closed: {e}")
    finally:
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    # Run on 0.0.0.0 to be accessible
    uvicorn.run(app, host="0.0.0.0", port=8000)

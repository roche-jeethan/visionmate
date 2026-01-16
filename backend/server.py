import asyncio
import base64
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket
from vision_mate_insight import VisionMateInsight

app = FastAPI()
# Initialize your AI engine
engine = VisionMateInsight(db_path="../faces_db")

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

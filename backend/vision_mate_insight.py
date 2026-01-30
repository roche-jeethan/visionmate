import cv2
import numpy as np
import os
from insightface.app import FaceAnalysis
from scipy.spatial.distance import cosine

class VisionMateInsight:
    def __init__(self, db_path="../faces_db"):
        # Convert to absolute path to ensure Ubuntu finds the folder regardless of where run.py starts
        self.db_path = os.path.abspath(db_path)
        print(f"DEBUG: Looking for faces in: {self.db_path}")
        
        # buffalo_l is the high-accuracy model
        self.app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        
        self.known_embeddings = []
        self.known_names = []
        self.load_database()

    def load_database(self):
        print(f"--- Encoding Database at {self.db_path} ---")
        if not os.path.exists(self.db_path):
            print(f"CRITICAL ERROR: Folder does not exist at {self.db_path}")
            return

        image_count = 0
        for root, dirs, files in os.walk(self.db_path):
            for file in files:
                if file.lower().endswith((".jpg", ".jpeg", ".png")):
                    image_count += 1
                    img_path = os.path.join(root, file)
                    img = cv2.imread(img_path)
                    
                    if img is None:
                        print(f"Could not read file: {file}")
                        continue
                    
                    faces = self.app.get(img)
                    
                    if len(faces) > 0:
                        # Grab the largest face (ignores background faces)
                        face = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0])*(x.bbox[3]-x.bbox[1]), reverse=True)[0]
                        self.known_embeddings.append(face.normed_embedding)
                        
                        # Folder name becomes the Identity
                        name = os.path.basename(root)
                        self.known_names.append(name)
                        print(f"Successfully loaded: {name} ({file})")
                    else:
                        print(f"WARNING: No face found in {file}. Try better lighting.")

        if image_count == 0:
            print(f"No images found in {self.db_path}. Check your folder structure.")
        print(f"Total identities loaded: {len(set(self.known_names))} | Total embeddings: {len(self.known_embeddings)}")

    def add_single_image_to_db(self, img_path, name):
        """Processes one image and adds it to the live database in memory."""
        img = cv2.imread(img_path)
        if img is None:
            return False
            
        faces = self.app.get(img)
        if len(faces) > 0:
            # Get largest face
            face = sorted(faces, key=lambda x: (x.bbox[2]-x.bbox[0])*(x.bbox[3]-x.bbox[1]), reverse=True)[0]
            
            # Append to current lists instead of reloading everything
            self.known_embeddings.append(face.normed_embedding)
            self.known_names.append(name)
            print(f"Incrementally loaded: {name} from {os.path.basename(img_path)}")
            return True
        return False

    def process_frame(self, frame):
        if frame is None:
            return []

        faces = self.app.get(frame)
        results = []

        for face in faces:
            name = "Unknown"
            live_embedding = face.normed_embedding
            
            best_dist = 1.0
            for idx, db_embedding in enumerate(self.known_embeddings):
                dist = cosine(live_embedding, db_embedding)
                if dist < best_dist:
                    best_dist = dist
                    # 0.45 - 0.50 is the "Sweet Spot" for Buffalo_L
                    if dist < 0.50: 
                        name = self.known_names[idx]

            # --- CRITICAL FIX: JSON SERIALIZATION ---
            # We convert NumPy float32/int32 to standard Python types
            bbox = [float(x) for x in face.bbox] 
            
            results.append({
                "name": name,
                "bbox": bbox,
                "score": float(1 - best_dist), # Convert NumPy float32 to Python float
                "confidence": float(face.det_score) if hasattr(face, 'det_score') else 0.0
            })
            
        return results
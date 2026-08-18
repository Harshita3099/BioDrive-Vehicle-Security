"""
Face registration + recognition using OpenCV's Haar Cascade (detection)
and LBPH -- Local Binary Patterns Histogram (recognition).

Why LBPH instead of the `face_recognition` / dlib library?
LBPH ships inside opencv-contrib-python, so there's no dlib/cmake build
step -- it installs with one `pip install` on Windows, Mac or Linux, and
trains in under a second on a handful of images. It's a classic, well
documented ML technique (texture-histogram based classification), which
makes it easy to explain the pipeline in an interview.
"""

import os
import cv2
import numpy as np

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import HAAR_CASCADE_PATH, DATASET_DIR, TRAINER_MODEL_PATH, TRAINER_DIR, FACE_MATCH_CONFIDENCE_THRESHOLD

face_cascade = cv2.CascadeClassifier(HAAR_CASCADE_PATH)


def _ensure_dirs():
    os.makedirs(DATASET_DIR, exist_ok=True)
    os.makedirs(TRAINER_DIR, exist_ok=True)


def detect_faces(gray_image):
    """Return list of (x, y, w, h) boxes for faces found in a grayscale image."""
    return face_cascade.detectMultiScale(gray_image, scaleFactor=1.2, minNeighbors=5, minSize=(60, 60))


def save_face_samples(image_bgr, label_id, sample_index):
    """
    Detect the face in a single BGR image and save the cropped, grayscale
    face to disk under dataset/user.<label_id>.<sample_index>.jpg

    Returns True if a face was found and saved, False otherwise.
    """
    _ensure_dirs()
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(gray)
    if len(faces) == 0:
        return False

    # Use the largest detected face (closest to camera)
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face_crop = cv2.resize(gray[y:y + h, x:x + w], (200, 200))
    filename = f"{DATASET_DIR}/user.{label_id}.{sample_index}.jpg"
    cv2.imwrite(filename, face_crop)
    return True


def train_model():
    """
    Train (or retrain) the LBPH recognizer on everything currently in
    dataset/ and write the model to trainer/trainer.yml.
    Call this after registering a new user.
    """
    _ensure_dirs()
    recognizer = cv2.face.LBPHFaceRecognizer_create()

    image_paths = [os.path.join(DATASET_DIR, f) for f in os.listdir(DATASET_DIR) if f.endswith(".jpg")]
    if not image_paths:
        return False

    face_samples = []
    ids = []
    for path in image_paths:
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        # filename format: user.<label_id>.<sample_index>.jpg
        label_id = int(os.path.basename(path).split(".")[1])
        face_samples.append(img)
        ids.append(label_id)

    recognizer.train(face_samples, np.array(ids))
    recognizer.write(TRAINER_MODEL_PATH)
    return True


def recognize_face(image_bgr):
    """
    Detect + recognize the largest face in a BGR image.

    Returns a dict: {"found": bool, "label_id": int|None, "confidence": float|None, "match": bool}
    - "match" is True only if a face was found AND confidence is below the threshold
      (for LBPH, LOWER confidence value = better/more certain match).
    """
    if not os.path.exists(TRAINER_MODEL_PATH):
        return {"found": False, "label_id": None, "confidence": None, "match": False, "error": "Model not trained yet"}

    recognizer = cv2.face.LBPHFaceRecognizer_create()
    recognizer.read(TRAINER_MODEL_PATH)

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    faces = detect_faces(gray)
    if len(faces) == 0:
        return {"found": False, "label_id": None, "confidence": None, "match": False}

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    face_crop = cv2.resize(gray[y:y + h, x:x + w], (200, 200))

    label_id, confidence = recognizer.predict(face_crop)
    is_match = confidence < FACE_MATCH_CONFIDENCE_THRESHOLD

    return {
        "found": True,
        "label_id": label_id,
        "confidence": round(float(confidence), 2),
        "match": is_match,
    }


def derived_match_score(confidence):
    """
    LBPH's predict() returns a *distance* (lower = better match) -- it is
    NOT a calibrated probability. This converts it into a rough 0-100
    "match score" purely for a friendlier UI display. Always label this
    as a derived score, not a statistical confidence, when showing it.
    """
    if confidence is None:
        return None
    score = max(0, min(100, 100 - confidence))
    return round(score, 1)


def decode_base64_image(base64_str):
    """Convert a base64 data-URL (from webcam capture in the browser) to a BGR OpenCV image."""
    import base64
    if "," in base64_str:
        base64_str = base64_str.split(",")[1]
    img_bytes = base64.b64decode(base64_str)
    img_array = np.frombuffer(img_bytes, dtype=np.uint8)
    return cv2.imdecode(img_array, cv2.IMREAD_COLOR)

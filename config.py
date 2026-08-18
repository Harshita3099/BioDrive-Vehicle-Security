"""
Edit these to match your local MySQL setup.
"""

MYSQL_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "YOUR_MYSQL_PASSWORD",   # <-- change this
    "database": "biodrive",
}

# Path to Haar Cascade file used for face detection (bundled with opencv-python)
import cv2
HAAR_CASCADE_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"

DATASET_DIR = "dataset"     # stores captured face images per user
TRAINER_DIR = "trainer"     # stores the trained LBPH model
TRAINER_MODEL_PATH = TRAINER_DIR + "/trainer.yml"

# LBPH recognizer will report a "confidence" distance for each match.
# Lower = more confident match. Anything below this threshold is accepted.
FACE_MATCH_CONFIDENCE_THRESHOLD = 65

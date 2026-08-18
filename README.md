# BioDrive – AI Vehicle Security System

BioDrive is an AI-based vehicle security system designed to provide secure vehicle access using facial recognition and fingerprint-based authentication.

## Features

- Facial recognition for vehicle/user authentication
- Fingerprint authentication
- User registration
- Secure login and authentication
- MySQL database integration
- Flask-based web application
- Dashboard for managing users
- AI-based face detection and recognition using OpenCV

## Technologies Used

- Python
- Flask
- OpenCV
- OpenCV LBPH Face Recognizer
- MySQL
- HTML
- CSS
- JavaScript

## Project Structure

```text
biodrive/
│
├── app.py
├── config.py
├── db.py
├── fingerprint_utils.py
├── requirements.txt
│
├── database/
│   └── schema.sql
│
├── face/
│   └── face_utils.py
│
├── static/
│   ├── css/
│   └── js/
│
├── templates/
│
└── trainer/

## How It Works

1. A user registers with their details.
2. The system captures the user's face data.
3. Face data is processed using OpenCV.
4. The trained face recognition model identifies the user.
5. Fingerprint authentication provides an additional authentication layer.
6. User information is stored in a MySQL database.
7. Successful authentication allows secure access to the vehicle system.

## Installation

### 1. Create a Virtual Environment

```bash
python -m venv venv

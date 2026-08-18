-- BioDrive Vehicle Security System
-- Run this once in MySQL to set up the database:
--   mysql -u root -p < database/schema.sql

CREATE DATABASE IF NOT EXISTS biodrive;
USE biodrive;

-- Registered drivers
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fingerprint_id VARCHAR(100) NOT NULL UNIQUE,   -- simulated fingerprint template/ID
    face_label_id INT NOT NULL UNIQUE,              -- numeric ID used by the LBPH recognizer
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Every authentication attempt (fingerprint + face + vehicle start + lockout events)
CREATE TABLE IF NOT EXISTS auth_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_name VARCHAR(100) DEFAULT 'Unknown',
    stage VARCHAR(30) NOT NULL,        -- fingerprint | face | vehicle_start | lockout
    result VARCHAR(20) NOT NULL,       -- success | failed
    confidence FLOAT DEFAULT NULL,     -- raw LBPH distance (lower = better match)
    reason VARCHAR(255) DEFAULT NULL,  -- human-readable reason, shown in the log & security panel
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

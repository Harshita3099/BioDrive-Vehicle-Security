import mysql.connector
from config import MYSQL_CONFIG


def get_connection():
    return mysql.connector.connect(**MYSQL_CONFIG)


def add_user(name, fingerprint_id, face_label_id):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (name, fingerprint_id, face_label_id) VALUES (%s, %s, %s)",
        (name, fingerprint_id, face_label_id),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_next_face_label_id():
    """LBPH needs a small integer ID per person. Auto-increment it ourselves."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(face_label_id), 0) + 1 FROM users")
    next_id = cur.fetchone()[0]
    cur.close()
    conn.close()
    return next_id


def get_user_by_fingerprint(fingerprint_id):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE fingerprint_id = %s", (fingerprint_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return user


def get_user_by_face_label(face_label_id):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM users WHERE face_label_id = %s", (face_label_id,))
    user = cur.fetchone()
    cur.close()
    conn.close()
    return user


def get_all_users():
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT id, name, fingerprint_id, face_label_id, created_at FROM users ORDER BY created_at DESC")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def log_attempt(user_name, stage, result, confidence=None, reason=None):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO auth_logs (user_name, stage, result, confidence, reason) VALUES (%s, %s, %s, %s, %s)",
        (user_name, stage, result, confidence, reason),
    )
    conn.commit()
    cur.close()
    conn.close()


def get_recent_logs(limit=50):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT * FROM auth_logs ORDER BY attempt_time DESC LIMIT %s", (limit,)
    )
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def get_failed_count():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM auth_logs WHERE result = 'failed'")
    count = cur.fetchone()[0]
    cur.close()
    conn.close()
    return count


def get_stats():
    """Aggregate numbers for the system status dashboard."""
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM users")
    total_drivers = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM auth_logs WHERE DATE(attempt_time) = CURDATE()")
    today_total = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM auth_logs WHERE DATE(attempt_time) = CURDATE() AND result = 'success'")
    today_success = cur.fetchone()[0]

    cur.execute("SELECT COUNT(*) FROM auth_logs WHERE DATE(attempt_time) = CURDATE() AND result = 'failed'")
    today_failed = cur.fetchone()[0]

    cur.close()
    conn.close()
    return {
        "total_drivers": total_drivers,
        "today_total": today_total,
        "today_success": today_success,
        "today_failed": today_failed,
    }


def get_last_successful_unlock():
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute(
        "SELECT user_name, attempt_time FROM auth_logs WHERE stage = 'vehicle_start' AND result = 'success' ORDER BY attempt_time DESC LIMIT 1"
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row

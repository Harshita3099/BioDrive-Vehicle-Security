import time
from flask import Flask, render_template, request, jsonify
import db
from face import face_utils
from fingerprint import fingerprint_utils

app = Flask(__name__)

# ---------- In-memory security state ----------
# NOTE: this is a demo-scale, single-process lockout tracker (resets on
# server restart). A production system would persist this in the DB or
# a shared cache (e.g. Redis) so it survives restarts and works across
# multiple app instances.
MAX_CONSECUTIVE_FAILURES = 3
LOCKOUT_SECONDS = 30

security_state = {
    "consecutive_failures": 0,
    "lockout_until": 0,  # unix timestamp; 0 = not locked out
}


def is_locked_out():
    return time.time() < security_state["lockout_until"]


def lockout_remaining():
    return max(0, round(security_state["lockout_until"] - time.time()))


def register_failure(stage, user_name="Unknown", reason=None, confidence=None):
    db.log_attempt(user_name, stage, "failed", confidence, reason)
    security_state["consecutive_failures"] += 1
    if security_state["consecutive_failures"] >= MAX_CONSECUTIVE_FAILURES and not is_locked_out():
        security_state["lockout_until"] = time.time() + LOCKOUT_SECONDS
        db.log_attempt(
            "Unknown", "lockout", "failed",
            reason=f"{MAX_CONSECUTIVE_FAILURES} consecutive failed attempts — system locked for {LOCKOUT_SECONDS}s",
        )


def register_success(stage, user_name, confidence=None):
    db.log_attempt(user_name, stage, "success", confidence)
    security_state["consecutive_failures"] = 0
    security_state["lockout_until"] = 0


# ---------- Pages ----------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/register")
def register_page():
    return render_template("register.html")


@app.route("/dashboard")
def dashboard_page():
    return render_template("dashboard.html")


# ---------- Registration ----------

@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.get_json()
    name = data.get("name", "").strip()
    fingerprint_id = data.get("fingerprint_id", "").strip()
    images_b64 = data.get("images", [])

    if not name or not fingerprint_id:
        return jsonify({"success": False, "message": "Name and fingerprint ID are required."}), 400
    if not images_b64:
        return jsonify({"success": False, "message": "At least one face image is required."}), 400

    label_id = db.get_next_face_label_id()

    saved_count = 0
    for i, b64 in enumerate(images_b64):
        img = face_utils.decode_base64_image(b64)
        if face_utils.save_face_samples(img, label_id, i):
            saved_count += 1

    if saved_count == 0:
        return jsonify({"success": False, "message": "No face detected in the provided image(s). Try again with better lighting."}), 400

    try:
        db.add_user(name, fingerprint_id, label_id)
    except Exception as e:
        err_msg = str(e)
        if "Duplicate entry" in err_msg and "fingerprint_id" in err_msg:
            return jsonify({"success": False, "message": f"Fingerprint ID '{fingerprint_id}' is already registered to another driver. Choose a unique ID."}), 400
        return jsonify({"success": False, "message": f"Database error: {err_msg}"}), 500

    face_utils.train_model()

    return jsonify({"success": True, "message": f"Registered {name} with {saved_count} face sample(s).", "samples": saved_count})


# ---------- Authentication flow ----------

@app.route("/api/scan_fingerprint", methods=["POST"])
def api_scan_fingerprint():
    if is_locked_out():
        return jsonify({
            "success": False,
            "locked_out": True,
            "remaining": lockout_remaining(),
            "message": f"System locked. Try again in {lockout_remaining()}s.",
        })

    data = request.get_json()
    fingerprint_id = data.get("fingerprint_id", "").strip()

    user = fingerprint_utils.verify_fingerprint(fingerprint_id)

    if user:
        register_success("fingerprint", user["name"])
        return jsonify({"success": True, "user_name": user["name"], "face_label_id": user["face_label_id"]})
    else:
        register_failure("fingerprint", "Unknown", reason="Fingerprint template not matched to any registered driver")
        locked = is_locked_out()
        return jsonify({
            "success": False,
            "message": "Fingerprint template not matched.",
            "locked_out": locked,
            "remaining": lockout_remaining() if locked else 0,
        })


@app.route("/api/verify_face", methods=["POST"])
def api_verify_face():
    if is_locked_out():
        return jsonify({
            "success": False,
            "locked_out": True,
            "remaining": lockout_remaining(),
            "message": f"System locked. Try again in {lockout_remaining()}s.",
        })

    data = request.get_json()
    b64_image = data.get("image")
    expected_label_id = data.get("expected_label_id")

    if not b64_image:
        return jsonify({"success": False, "message": "No image provided."}), 400

    img = face_utils.decode_base64_image(b64_image)
    result = face_utils.recognize_face(img)
    score = face_utils.derived_match_score(result.get("confidence"))

    if not result["found"]:
        register_failure("face", "Unknown", reason="No face detected in frame")
        locked = is_locked_out()
        return jsonify({
            "success": False, "message": "No face detected.",
            "locked_out": locked, "remaining": lockout_remaining() if locked else 0,
        })

    two_factor_match = result["match"] and result["label_id"] == expected_label_id

    if two_factor_match:
        user = db.get_user_by_face_label(result["label_id"])
        register_success("face", user["name"], result["confidence"])
        return jsonify({
            "success": True,
            "user_name": user["name"],
            "confidence": result["confidence"],
            "match_score": score,
        })
    else:
        if result["match"] and result["label_id"] != expected_label_id:
            reason = "Face matched a different registered driver than the fingerprint used"
        else:
            reason = f"Face did not match within confidence threshold (distance={result['confidence']})"
        register_failure("face", "Unknown", reason=reason, confidence=result["confidence"])
        locked = is_locked_out()
        return jsonify({
            "success": False,
            "message": reason,
            "confidence": result["confidence"],
            "match_score": score,
            "locked_out": locked,
            "remaining": lockout_remaining() if locked else 0,
        })


@app.route("/api/start_vehicle", methods=["POST"])
def api_start_vehicle():
    data = request.get_json()
    user_name = data.get("user_name", "Unknown")
    register_success("vehicle_start", user_name)
    return jsonify({"success": True, "message": f"Vehicle started for {user_name}."})


# ---------- Dashboard / system status ----------

@app.route("/api/logs")
def api_logs():
    logs = db.get_recent_logs(50)
    failed_count = db.get_failed_count()
    for log in logs:
        log["attempt_time"] = log["attempt_time"].strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({"logs": logs, "failed_count": failed_count})


@app.route("/api/users")
def api_users():
    users = db.get_all_users()
    for u in users:
        u["created_at"] = u["created_at"].strftime("%Y-%m-%d %H:%M:%S")
    return jsonify({"users": users})


@app.route("/api/system_status")
def api_system_status():
    stats = db.get_stats()
    locked = is_locked_out()
    last_unlock = db.get_last_successful_unlock()
    stats.update({
        "security_status": "LOCKOUT" if locked else "NORMAL",
        "lockout_remaining": lockout_remaining() if locked else 0,
        "consecutive_failures": security_state["consecutive_failures"],
        "last_unlock_user": last_unlock["user_name"] if last_unlock else None,
        "last_unlock_time": last_unlock["attempt_time"].strftime("%Y-%m-%d %H:%M:%S") if last_unlock else None,
    })
    return jsonify(stats)


@app.route("/api/recent_events")
def api_recent_events():
    logs = db.get_recent_logs(8)
    for log in logs:
        log["attempt_time"] = log["attempt_time"].strftime("%H:%M:%S")
    return jsonify({"events": logs})


if __name__ == "__main__":
    app.run(debug=True, port=5000)

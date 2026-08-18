// ---------- Elements ----------
const vehicleBadge = document.getElementById("vehicleBadge");
const vehicleState = document.getElementById("vehicleState");
const msgBox = document.getElementById("msgBox");
const lockoutBanner = document.getElementById("lockoutBanner");

const stepFingerprint = document.getElementById("stepFingerprint");
const stepFace = document.getElementById("stepFace");
const stepResult = document.getElementById("stepResult");
const stepUnlock = document.getElementById("stepUnlock");

const fpPill = document.getElementById("fpPill");
const facePill = document.getElementById("facePill");
const resultPill = document.getElementById("resultPill");
const unlockPill = document.getElementById("unlockPill");

const fingerprintSelect = document.getElementById("fingerprintSelect");
const scanFpBtn = document.getElementById("scanFpBtn");

const cameraWrap = document.getElementById("cameraWrap");
const video = document.getElementById("video");
const scanRing = document.getElementById("scanRing");
const startCameraBtn = document.getElementById("startCameraBtn");
const verifyFaceBtn = document.getElementById("verifyFaceBtn");
const captureCanvas = document.getElementById("captureCanvas");
const faceDetail = document.getElementById("faceDetail");

const resultHeadline = document.getElementById("resultHeadline");
const resultReason = document.getElementById("resultReason");
const resultChecklist = document.getElementById("resultChecklist");

const startBtn = document.getElementById("startBtn");

const sessDriver = document.getElementById("sessDriver");
const sessFp = document.getElementById("sessFp");
const sessFace = document.getElementById("sessFace");

const dbDot = document.getElementById("dbDot");
const camDot = document.getElementById("camDot");
const footerDbDot = document.getElementById("footerDbDot");
const footerDbLabel = document.getElementById("footerDbLabel");
const footerCamDot = document.getElementById("footerCamDot");
const footerCamLabel = document.getElementById("footerCamLabel");

let expectedLabelId = null;
let currentUserName = null;
let stream = null;
let lockoutTimer = null;

// ---------- Clock ----------
function tick() { document.getElementById("clock").textContent = new Date().toLocaleTimeString(); }
setInterval(tick, 1000); tick();

// ---------- Helpers ----------
function showMsg(text, type) { msgBox.innerHTML = `<div class="msg ${type}">${text}</div>`; }
function clearMsg() { msgBox.innerHTML = ""; }
function setPill(el, state, text) { el.className = `flow-status-pill ${state}`; el.textContent = text; }
function setStepState(el, state) { el.className = `flow-step ${state}`; }

function markCameraReady(ready) {
  camDot.className = `check-dot ${ready ? "on" : "off"}`;
  footerCamDot.className = `dot ${ready ? "on" : "off"}`;
  footerCamLabel.textContent = ready ? "Camera Ready" : "Camera Idle";
}

function applyLockout(remainingSeconds) {
  if (lockoutTimer) clearInterval(lockoutTimer);
  let remaining = remainingSeconds;
  scanFpBtn.disabled = true;
  verifyFaceBtn.disabled = true;
  setStepState(stepResult, "failed");
  resultHeadline.textContent = "🔴 SECURITY LOCKOUT";

  const update = () => {
    lockoutBanner.classList.remove("hidden");
    lockoutBanner.textContent = `🔒 SYSTEM LOCKED — ${remaining}s remaining after repeated failed attempts`;
    resultReason.textContent = `Too many failed attempts. Vehicle remains locked for ${remaining}s.`;
    remaining -= 1;
    if (remaining < 0) {
      clearInterval(lockoutTimer);
      lockoutBanner.classList.add("hidden");
      scanFpBtn.disabled = false;
      verifyFaceBtn.disabled = false;
      setStepState(stepResult, "pending");
      resultHeadline.textContent = "Awaiting both factors…";
      resultReason.textContent = "Lockout expired. You may try again.";
    }
  };
  update();
  lockoutTimer = setInterval(update, 1000);
}

// ---------- Load registered users into fingerprint dropdown ----------
async function loadUsers() {
  const res = await fetch("/api/users");
  const data = await res.json();
  fingerprintSelect.innerHTML = "";
  if (data.users.length === 0) {
    fingerprintSelect.innerHTML = `<option value="">No drivers registered yet</option>`;
    return;
  }
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "-- choose a fingerprint to scan --";
  fingerprintSelect.appendChild(placeholder);

  data.users.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.fingerprint_id;
    opt.textContent = `${u.fingerprint_id}  (${u.name})`;
    fingerprintSelect.appendChild(opt);
  });

  const badOpt = document.createElement("option");
  badOpt.value = "FP-UNKNOWN-999";
  badOpt.textContent = "FP-UNKNOWN-999  (simulate unauthorized attempt)";
  fingerprintSelect.appendChild(badOpt);
}
loadUsers();

// ---------- System status polling (left panel + bottom bar) ----------
async function pollSystemStatus() {
  try {
    const res = await fetch("/api/system_status");
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();

    dbDot.className = "check-dot on";
    footerDbDot.className = "dot on";
    footerDbLabel.textContent = "Database Connected";

    document.getElementById("qsDrivers").textContent = data.total_drivers;
    document.getElementById("qsToday").textContent = data.today_total;
    document.getElementById("qsFailed").textContent = data.today_failed;

    document.getElementById("lastDriver").textContent = data.last_unlock_user || "—";
    document.getElementById("lastTime").textContent = data.last_unlock_time || "—";
  } catch (e) {
    dbDot.className = "check-dot off";
    footerDbDot.className = "dot off";
    footerDbLabel.textContent = "Database Disconnected";
  }
}
pollSystemStatus();
setInterval(pollSystemStatus, 5000);

// ---------- Recent events feed ----------
async function pollEvents() {
  try {
    const res = await fetch("/api/recent_events");
    const data = await res.json();
    const feed = document.getElementById("eventFeed");
    if (data.events.length === 0) {
      feed.innerHTML = `<div style="color: var(--text-faint); font-family: var(--font-mono); font-size: 11px;">No events yet.</div>`;
      return;
    }
    feed.innerHTML = data.events.map(ev => `
      <div class="event-item ${ev.result}">
        <div class="row1"><span>${ev.user_name}</span><span>${ev.result === 'success' ? '✓' : '✗'}</span></div>
        <div class="row2">${ev.stage} · ${ev.attempt_time}</div>
      </div>
    `).join("");
  } catch (e) { /* ignore */ }
}
pollEvents();
setInterval(pollEvents, 5000);

// ---------- Step 1: Fingerprint ----------
scanFpBtn.addEventListener("click", async () => {
  const fpId = fingerprintSelect.value;
  if (!fpId) { showMsg("Select a fingerprint template first.", "error"); return; }

  clearMsg();
  scanFpBtn.disabled = true;
  scanFpBtn.textContent = "Scanning…";
  setPill(fpPill, "scanning", "Scanning");

  const res = await fetch("/api/scan_fingerprint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fingerprint_id: fpId })
  });
  const data = await res.json();

  scanFpBtn.textContent = "Scan Fingerprint";
  scanFpBtn.disabled = false;

  if (data.locked_out) { applyLockout(data.remaining); return; }

  if (data.success) {
    setStepState(stepFingerprint, "success");
    setPill(fpPill, "verified", "Verified");
    currentUserName = data.user_name;
    expectedLabelId = data.face_label_id;

    sessDriver.textContent = data.user_name;
    sessFp.textContent = "✓ Matched";

    setStepState(stepFace, "active");
    setPill(facePill, "waiting", "Waiting");
    startCameraBtn.disabled = false;

    showMsg(`✓ Fingerprint template matched. User: ${data.user_name}. Door unlocked — starting camera step.`, "success");
    vehicleBadge.className = "vehicle-badge unlocked";
    vehicleState.textContent = "UNLOCKED";
  } else {
    setStepState(stepFingerprint, "failed");
    setPill(fpPill, "failed", "Denied");
    sessFp.textContent = "✗ No match";
    showMsg("🚨 Fingerprint template not matched. Attempt logged.", "error");

    setStepState(stepResult, "failed");
    setPill(resultPill, "failed", "Denied");
    resultHeadline.textContent = "🔴 ACCESS DENIED — VEHICLE REMAINS LOCKED";
    resultReason.textContent = "Reason: Fingerprint authentication failed";
  }
});

// ---------- Step 2: Face ----------
startCameraBtn.addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    cameraWrap.classList.remove("hidden");
    startCameraBtn.classList.add("hidden");
    verifyFaceBtn.classList.remove("hidden");
    markCameraReady(true);
    clearMsg();
  } catch (e) {
    showMsg("Camera access denied or unavailable: " + e.message, "error");
  }
});

verifyFaceBtn.addEventListener("click", async () => {
  clearMsg();
  scanRing.classList.add("scanning");
  verifyFaceBtn.disabled = true;
  verifyFaceBtn.textContent = "Verifying…";
  setPill(facePill, "scanning", "Scanning");

  captureCanvas.width = video.videoWidth;
  captureCanvas.height = video.videoHeight;
  captureCanvas.getContext("2d").drawImage(video, 0, 0);
  const imageData = captureCanvas.toDataURL("image/jpeg", 0.9);

  const res = await fetch("/api/verify_face", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageData, expected_label_id: expectedLabelId })
  });
  const data = await res.json();

  scanRing.classList.remove("scanning");
  verifyFaceBtn.disabled = false;
  verifyFaceBtn.textContent = "Verify Face";

  if (data.locked_out) { applyLockout(data.remaining); return; }

  faceDetail.classList.remove("hidden");

  if (data.success) {
    setStepState(stepFace, "success");
    setPill(facePill, "verified", "Verified");
    sessFace.textContent = `✓ ${data.match_score}% score`;

    faceDetail.innerHTML = `
      <span class="k">User:</span> ${data.user_name}<br>
      <span class="k">Recognition:</span> Verified<br>
      <span class="k">Match score:</span> ${data.match_score}% &nbsp;<span class="k">(LBPH distance: ${data.confidence})</span><br>
      <span class="k">Status:</span> ✓ AUTHENTICATED
      <div class="disclaimer">Match score is a derived value from LBPH's distance metric, not a calibrated statistical probability.</div>
    `;
    showMsg(`Authorized face ✓ for ${data.user_name}.`, "success");
    stopCamera();
    markCameraReady(false);

    setStepState(stepResult, "success");
    setPill(resultPill, "verified", "Verified");
    resultHeadline.textContent = "🟢 AUTHENTICATED — IGNITION ENABLED";
    resultReason.textContent = "";
    resultChecklist.classList.remove("hidden");
    resultChecklist.innerHTML = `<span>Fingerprint ✓</span><span>Face ✓</span><span>Ignition authorization pending</span>`;

    setStepState(stepUnlock, "active");
    setPill(unlockPill, "waiting", "Ready");
    startBtn.disabled = false;
  } else {
    setStepState(stepFace, "failed");
    setPill(facePill, "failed", "Denied");
    sessFace.textContent = "✗ No match";

    faceDetail.innerHTML = `
      <span class="k">Recognition:</span> Not verified<br>
      ${data.confidence != null ? `<span class="k">Match score:</span> ${data.match_score}% <span class="k">(LBPH distance: ${data.confidence})</span><br>` : ""}
      <span class="k">Status:</span> ✗ DENIED
    `;
    showMsg(`🚨 ${data.message} Attempt logged.`, "error");

    setStepState(stepResult, "failed");
    setPill(resultPill, "failed", "Denied");
    resultHeadline.textContent = "🔴 ACCESS DENIED — VEHICLE REMAINS LOCKED";
    resultReason.textContent = `Reason: ${data.message}`;
  }
});

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); }
  cameraWrap.classList.add("hidden");
}

// ---------- Step 4: Vehicle Unlock ----------
startBtn.addEventListener("click", async () => {
  const res = await fetch("/api/start_vehicle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_name: currentUserName })
  });
  const data = await res.json();
  if (data.success) {
    vehicleBadge.className = "vehicle-badge running";
    vehicleState.textContent = "RUNNING";
    startBtn.disabled = true;
    startBtn.textContent = "Vehicle Started ✓";
    setPill(unlockPill, "verified", "Unlocked");
    setStepState(stepUnlock, "success");
    resultChecklist.innerHTML = `<span>Fingerprint ✓</span><span>Face ✓</span><span>Ignition authorization ✓</span>`;
    pollSystemStatus();
    pollEvents();
  }
});

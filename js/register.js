function tick() { document.getElementById("clock").textContent = new Date().toLocaleTimeString(); }
setInterval(tick, 1000); tick();

const tabWebcam = document.getElementById("tabWebcam");
const tabUpload = document.getElementById("tabUpload");
const webcamPane = document.getElementById("webcamPane");
const uploadPane = document.getElementById("uploadPane");

const regVideo = document.getElementById("regVideo");
const startRegCameraBtn = document.getElementById("startRegCameraBtn");
const captureBtn = document.getElementById("captureBtn");
const captureCountEl = document.getElementById("captureCount");
const regCanvas = document.getElementById("regCanvas");
const livePreview = document.getElementById("livePreview");

const fileInput = document.getElementById("fileInput");
const registerBtn = document.getElementById("registerBtn");
const regMsg = document.getElementById("regMsg");
const confirmCard = document.getElementById("confirmCard");

const footerCamDot = document.getElementById("footerCamDot");
const footerCamLabel = document.getElementById("footerCamLabel");

let regStream = null;
let capturedImages = [];
let mode = "webcam";

const lc1 = document.getElementById("lc1");
const lc2 = document.getElementById("lc2");
const lc3 = document.getElementById("lc3");
const lc4 = document.getElementById("lc4");
const lc5 = document.getElementById("lc5");

function markDone(el, label) { el.textContent = `✓ ${label}`; el.style.color = "var(--green)"; }
function markActive(el, label) { el.textContent = `● ${label}`; el.style.color = "var(--cyan)"; }

document.getElementById("nameInput").addEventListener("input", (e) => {
  if (e.target.value.trim()) markDone(lc1, "Name"); else lc1.textContent = "○ Name";
});
document.getElementById("fingerprintInput").addEventListener("input", (e) => {
  if (e.target.value.trim()) markDone(lc2, "Fingerprint Template"); else lc2.textContent = "○ Fingerprint Template";
});

function renderPreview() {
  livePreview.innerHTML = capturedImages.map(src => `<img src="${src}">`).join("");
}

function showMsg(text, type) { regMsg.innerHTML = `<div class="msg ${type}">${text}</div>`; }

// ---------- Tab switching ----------
tabWebcam.addEventListener("click", () => {
  mode = "webcam";
  tabWebcam.classList.add("active");
  tabUpload.classList.remove("active");
  webcamPane.classList.remove("hidden");
  uploadPane.classList.add("hidden");
});
tabUpload.addEventListener("click", () => {
  mode = "upload";
  tabUpload.classList.add("active");
  tabWebcam.classList.remove("active");
  uploadPane.classList.remove("hidden");
  webcamPane.classList.add("hidden");
});

// ---------- Webcam capture ----------
startRegCameraBtn.addEventListener("click", async () => {
  try {
    regStream = await navigator.mediaDevices.getUserMedia({ video: true });
    regVideo.srcObject = regStream;
    startRegCameraBtn.classList.add("hidden");
    captureBtn.classList.remove("hidden");
    footerCamDot.className = "dot on";
    footerCamLabel.textContent = "Camera Ready";
  } catch (e) {
    showMsg("Camera access denied: " + e.message, "error");
  }
});

captureBtn.addEventListener("click", () => {
  if (capturedImages.length >= 3) return;
  regCanvas.width = regVideo.videoWidth;
  regCanvas.height = regVideo.videoHeight;
  regCanvas.getContext("2d").drawImage(regVideo, 0, 0);
  const imageData = regCanvas.toDataURL("image/jpeg", 0.9);
  capturedImages.push(imageData);
  captureCountEl.textContent = capturedImages.length;
  renderPreview();
  markActive(lc3, `Capture Face Samples (${capturedImages.length}/3)`);

  if (capturedImages.length >= 3) {
    markDone(lc3, "Capture Face Samples");
    captureBtn.disabled = true;
    captureBtn.textContent = "Captured 3/3 ✓";
    if (regStream) regStream.getTracks().forEach(t => t.stop());
    footerCamDot.className = "dot off";
    footerCamLabel.textContent = "Camera Idle";
  }
});

// ---------- File upload ----------
fileInput.addEventListener("change", () => {
  capturedImages = [];
  const files = Array.from(fileInput.files).slice(0, 3);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      capturedImages.push(e.target.result);
      renderPreview();
      markDone(lc3, `Capture Face Samples (${capturedImages.length} uploaded)`);
    };
    reader.readAsDataURL(file);
  });
});

// ---------- Submit registration ----------
registerBtn.addEventListener("click", async () => {
  const name = document.getElementById("nameInput").value.trim();
  const fingerprintId = document.getElementById("fingerprintInput").value.trim();

  if (!name || !fingerprintId) {
    showMsg("Please enter a name and a fingerprint ID.", "error");
    return;
  }
  if (capturedImages.length === 0) {
    showMsg("Capture or upload at least one face image.", "error");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Registering…";
  markActive(lc4, "Train Model");
  confirmCard.classList.add("hidden");

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, fingerprint_id: fingerprintId, images: capturedImages })
  });
  const data = await res.json();

  registerBtn.disabled = false;
  registerBtn.textContent = "Register Driver";

  if (data.success) {
    markDone(lc4, "Train Model");
    markDone(lc5, "Save Driver");
    showMsg(`✅ ${data.message}`, "success");

    document.getElementById("confName").textContent = name;
    document.getElementById("confFp").textContent = fingerprintId;
    document.getElementById("confSamples").textContent = data.samples;
    document.getElementById("confTime").textContent = new Date().toLocaleString();
    document.getElementById("sampleThumbs").innerHTML = capturedImages.map(src => `<img src="${src}">`).join("");
    confirmCard.classList.remove("hidden");
  } else {
    lc4.textContent = "○ Train Model";
    showMsg(`🚨 ${data.message}`, "error");
  }
});

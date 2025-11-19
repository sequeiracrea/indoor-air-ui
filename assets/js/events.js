/* assets/js/events.js
   Version stable - compatible IndoorAPI + Canvas fixe + play/pause + timeline
*/

let allFrames = [];
let currentFrame = 0;
let playing = false;
let ctx, canvas;

// -------------------------
// Convert history→points
// -------------------------
function normalizeHistoryToPoints(series) {
  return series
    .filter(entry => entry.indices && typeof entry.indices.GAQI === "number")
    .map(entry => ({
      x: entry.indices.GAQI,   // axis X
      y: entry.indices.GEI,    // axis Y
      sri: entry.indices.SRI,
      tci: entry.indices.TCI,
      timestamp: entry.timestamp
    }));
}

// -------------------------
// Filtres
// -------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(p =>
    p.tci >= tciMin &&
    p.tci <= tciMax &&
    p.sri >= sriMin &&
    p.sri <= sriMax
  );
}

// -------------------------
// Rendu du canvas
// -------------------------
function renderCanvas(points) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // axes
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, canvas.height - 40);
  ctx.lineTo(canvas.width - 20, canvas.height - 40);
  ctx.moveTo(50, 20);
  ctx.lineTo(50, canvas.height - 40);
  ctx.stroke();

  // labels
  ctx.fillStyle = "#333";
  ctx.font = "14px Arial";
  ctx.fillText("GAQI →", canvas.width - 100, canvas.height - 10);
  ctx.fillText("GEI ↑", 10, 30);

  // points
  points.forEach(p => {
    const px = 50 + (p.x / 100) * (canvas.width - 80);
    const py = (canvas.height - 40) - (p.y / 100) * (canvas.height - 80);

    ctx.fillStyle = "rgba(0,100,255,0.8)";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

// -------------------------
// Animation
// -------------------------
function nextFrame() {
  if (!playing) return;

  currentFrame++;
  if (currentFrame >= allFrames.length) currentFrame = 0;

  const tciMin = parseInt(document.getElementById("tciMin").value);
  const tciMax = parseInt(document.getElementById("tciMax").value);
  const sriMin = parseInt(document.getElementById("sriMin").value);
  const sriMax = parseInt(document.getElementById("sriMax").value);

  const framePoints = filterPoints([allFrames[currentFrame]], tciMin, tciMax, sriMin, sriMax);
  renderCanvas(framePoints);

  document.getElementById("timeSlider").value = currentFrame;

  setTimeout(() => requestAnimationFrame(nextFrame), 120);
}

// -------------------------
// INIT
// -------------------------
async function init() {
  canvas = document.getElementById("stabilityCanvas");
  ctx = canvas.getContext("2d");

  // Fix responsive canvas
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  console.log("Fetching history...");

  try {
    const history = await window.IndoorAPI.fetchHistory(1800);
    if (!history || !history.series) {
      console.error("History malformed :", history);
      return;
    }

    allFrames = normalizeHistoryToPoints(history.series);
    console.log("Frames loaded :", allFrames.length);

    document.getElementById("timeSlider").max = allFrames.length - 1;

    // render initial frame
    renderCanvas(allFrames);
  } catch (err) {
    console.error("Erreur chargement historique :", err);
  }
}

// -------------------------
// EVENTS
// -------------------------
document.addEventListener("DOMContentLoaded", () => {
  init();

  document.getElementById("playBtn").addEventListener("click", () => {
    playing = !playing;
    document.getElementById("playBtn").innerText = playing ? "Pause" : "Play";
    if (playing) nextFrame();
  });

  document.getElementById("timeSlider").addEventListener("input", e => {
    currentFrame = parseInt(e.target.value);
    renderCanvas([allFrames[currentFrame]]);
  });

  ["tciMin", "tciMax", "sriMin", "sriMax"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      renderCanvas([allFrames[currentFrame]]);
    });
  });
});

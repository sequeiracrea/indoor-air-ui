/* assets/js/events.js */
const TRAIL_LENGTH = 60;
const POINT_MIN_SIZE = 2;
const POINT_MAX_SIZE = 8;

let canvas, ctx;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let displayedPoints = [];

async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series || !history.series.length) return [];
    return history.series.map(entry => {
      const idx = entry.indices || {};
      const { GAQI = 0, GEI = 0, SRI = 0, TCI = 0 } = idx;
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI };
    });
  } catch (err) {
    console.error("Erreur historique :", err);
    return [];
  }
}

function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

function getPointColor(p) {
  const score = Math.sqrt((p.x / 100) ** 2 + (p.y / 100) ** 2 + (p.tci / 100) ** 2 + (p.sri / 100) ** 2);
  if (score > 0.75) return "255,0,0";       // rouge instable
  else if (score > 0.5) return "255,165,0"; // orange alerte
  return "0,200,0";                           // vert stable
}

function drawThermalBackground() {
  const w = canvas.width;
  const h = canvas.height;
  const grd = ctx.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, "#0040ff"); // bleu froid
  grd.addColorStop(0.5, "#00ff00"); // vert
  grd.addColorStop(1, "#ff0000"); // rouge chaud
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
}

function drawPoints() {
  const w = canvas.width;
  const h = canvas.height;

  for (let i = 0; i < displayedPoints.length; i++) {
    const p = displayedPoints[i];
    const ageFactor = (i + 1) / displayedPoints.length; // ancien = petit & transparent
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * ageFactor;
    const color = getPointColor(p);

    // halo néon
    const gradient = ctx.createRadialGradient(
      (p.x / 100) * w,
      h - (p.y / 100) * h,
      0,
      (p.x / 100) * w,
      h - (p.y / 100) * h,
      size * 3
    );
    gradient.addColorStop(0, `rgba(${color},${0.6 + 0.4 * ageFactor})`);
    gradient.addColorStop(0.2, `rgba(${color},${0.4 * ageFactor})`);
    gradient.addColorStop(0.6, `rgba(${color},0.1)`);
    gradient.addColorStop(1, `rgba(${color},0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc((p.x / 100) * w, h - (p.y / 100) * h, size, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function nextFrame() {
  if (!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const framePoints = filterPoints([allFrames[currentFrame]], tciMin, tciMax, sriMin, sriMax);
  displayedPoints.push(...framePoints);
  if (displayedPoints.length > TRAIL_LENGTH) displayedPoints = displayedPoints.slice(-TRAIL_LENGTH);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawThermalBackground();
  drawPoints();

  document.getElementById("timeline").value = currentFrame;
  currentFrame = (currentFrame + 1) % allFrames.length;
  if (animating) animationId = requestAnimationFrame(nextFrame);
}

function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if (animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

function applyFilters() {
  displayedPoints = [];
  nextFrame();
}

async function init() {
  canvas = document.getElementById("stabilityChart");
  if (!canvas) return console.error("Canvas introuvable");
  ctx = canvas.getContext("2d");

  allFrames = await loadFramesFromHistory(1800);
  if (!allFrames.length) return console.warn("Aucune frame chargée");

  // timeline
  const slider = document.getElementById("timeline");
  slider.max = allFrames.length - 1;
  slider.addEventListener("input", e => {
    currentFrame = parseInt(e.target.value, 10);
    displayedPoints = allFrames.slice(Math.max(0, currentFrame - TRAIL_LENGTH), currentFrame + 1);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawThermalBackground();
    drawPoints();
  });

  // play/pause
  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // légende
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="color:green;">● Stable</span> &nbsp;
    <span style="color:orange;">● Alerte</span> &nbsp;
    <span style="color:red;">● Instable</span><br>
    Fond : bleu→vert→rouge (froid → chaud)<br>
    Points récents plus gros, halo néon
  `;

  nextFrame();
}

window.addEventListener("load", init);

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
let heatmapData = []; // pour le fond dynamique

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
  if (score > 0.75) return "255,0,0";
  else if (score > 0.5) return "255,165,0";
  return "0,200,0";
}

function updateHeatmap() {
  // On applique un léger fade sur le fond pour créer un effet fluide
  ctx.fillStyle = "rgba(20,20,20,0.1)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // chaque point laisse un halo diffus
  for (let i = 0; i < displayedPoints.length; i++) {
    const p = displayedPoints[i];
    const ageFactor = (i + 1) / displayedPoints.length;
    const color = getPointColor(p);

    const gradient = ctx.createRadialGradient(
      (p.x / 100) * canvas.width,
      canvas.height - (p.y / 100) * canvas.height,
      0,
      (p.x / 100) * canvas.width,
      canvas.height - (p.y / 100) * canvas.height,
      50 * ageFactor
    );
    gradient.addColorStop(0, `rgba(${color},${0.6 * ageFactor})`);
    gradient.addColorStop(0.5, `rgba(${color},${0.2 * ageFactor})`);
    gradient.addColorStop(1, `rgba(${color},0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc((p.x / 100) * canvas.width, canvas.height - (p.y / 100) * canvas.height, 50 * ageFactor, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function drawPoints() {
  for (let i = 0; i < displayedPoints.length; i++) {
    const p = displayedPoints[i];
    const ageFactor = (i + 1) / displayedPoints.length;
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * ageFactor;
    const color = getPointColor(p);

    ctx.fillStyle = `rgba(${color},1)`;
    ctx.beginPath();
    ctx.arc((p.x / 100) * canvas.width, canvas.height - (p.y / 100) * canvas.height, size, 0, 2 * Math.PI);
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

  updateHeatmap();
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

  const slider = document.getElementById("timeline");
  slider.max = allFrames.length - 1;
  slider.addEventListener("input", e => {
    currentFrame = parseInt(e.target.value, 10);
    displayedPoints = allFrames.slice(Math.max(0, currentFrame - TRAIL_LENGTH), currentFrame + 1);
    updateHeatmap();
    drawPoints();
  });

  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="color:green;">● Stable</span> &nbsp;
    <span style="color:orange;">● Alerte</span> &nbsp;
    <span style="color:red;">● Instable</span><br>
    Taille + couleur = récence / état<br>
    Halo = flux thermique dynamique
  `;

  nextFrame();
}

window.addEventListener("load", init);

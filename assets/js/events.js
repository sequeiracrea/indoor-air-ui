/* assets/js/events.js */

const STABILITY_COLORS = { stable: "rgba(0,200,0,0.15)", alert: "rgba(255,165,0,0.15)", unstable: "rgba(255,0,0,0.15)" };
const POINT_MIN_SIZE = 4;
const POINT_MAX_SIZE = 10;
const TRAIL_LENGTH = 60;

let canvas, ctx;
let allFrames = [];
let displayedPoints = [];
let currentFrame = 0;
let animating = false;
let animationId;

async function loadFrames(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series) return [];

    return history.series.map(entry => {
      const idx = entry.indices || {};
      return {
        x: idx.GAQI || 0,
        y: idx.GEI || 0,
        sri: idx.SRI || 0,
        tci: idx.TCI || 0
      };
    });
  } catch (err) {
    console.error("Erreur historique :", err);
    return [];
  }
}

// Zones de fond 4 diagonales
function drawBackground() {
  const { width, height } = canvas;
  ctx.save();

  // Quart supérieur gauche : stable
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(0, 0, width/2, height/2);

  // Quart supérieur droit : alert
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(width/2, 0, width/2, height/2);

  // Quart inférieur gauche : alert
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(0, height/2, width/2, height/2);

  // Quart inférieur droit : unstable
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(width/2, height/2, width/2, height/2);

  ctx.restore();
}

function drawPoints() {
  for (let i = 0; i < displayedPoints.length; i++) {
    const p = displayedPoints[i];
    const ageFactor = (i + 1) / displayedPoints.length;
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * ageFactor;

    // Couleur dynamique selon GAQI et GEI
    const r = Math.min(255, Math.floor(p.x * 2.55));
    const g = Math.min(255, Math.floor((100 - p.y) * 2.55));
    const b = Math.floor((100 - (p.x + p.y)/2) * 2.55);
    const color = `${r},${g},${b}`;

    const haloRadius = size * 3;

    const x = (p.x / 100) * canvas.width;
    const y = canvas.height - (p.y / 100) * canvas.height;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    gradient.addColorStop(0, `rgba(${color},${0.5 * ageFactor})`);
    gradient.addColorStop(0.5, `rgba(${color},${0.2 * ageFactor})`);
    gradient.addColorStop(1, `rgba(${color},0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, 2*Math.PI);
    ctx.fill();

    ctx.fillStyle = `rgba(${color},1)`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2*Math.PI);
    ctx.fill();
  }
}

function nextFrame() {
  if (!allFrames.length) return;

  displayedPoints.push(allFrames[currentFrame]);
  if (displayedPoints.length > TRAIL_LENGTH) displayedPoints.shift();

  drawBackground();
  drawPoints();

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

function updateTimeline() {
  const slider = document.getElementById("timeline");
  currentFrame = parseInt(slider.value);
  displayedPoints = allFrames.slice(Math.max(0, currentFrame - TRAIL_LENGTH), currentFrame + 1);
  drawBackground();
  drawPoints();
}

function initLegend() {
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="background:${STABILITY_COLORS.stable};padding:0 6px;border-radius:3px">Stable</span> 
    <span style="background:${STABILITY_COLORS.alert};padding:0 6px;border-radius:3px">Alerte</span> 
    <span style="background:${STABILITY_COLORS.unstable};padding:0 6px;border-radius:3px">Instable</span><br>
    Halo coloré : intensité selon GAQI/GEI<br>
    Points récents plus gros
  `;
}

async function init() {
  canvas = document.getElementById("stabilityChart");
  if (!canvas) return console.error("Canvas introuvable");
  ctx = canvas.getContext("2d");

  allFrames = await loadFrames(1800);
  if (!allFrames.length) return;

  const slider = document.getElementById("timeline");
  slider.max = allFrames.length - 1;
  slider.addEventListener("input", updateTimeline);

  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);

  initLegend();

  displayedPoints = [];
  nextFrame();
}

window.addEventListener("load", init);

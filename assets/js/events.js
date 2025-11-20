/* assets/js/events.js - Version thermique artistique */

const POINT_MIN_SIZE = 4;
const POINT_MAX_SIZE = 12;
const TRAIL_LENGTH = 60;

let canvas, ctx;
let allFrames = [];
let displayedPoints = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Convert GAQI/GEI (0-100) en couleur thermique
function thermalColor(gaqi, gei) {
  // gaqi + gei = intensité globale
  const intensity = Math.min(1, (gaqi + gei)/200);
  const r = Math.floor(255 * intensity);
  const g = Math.floor(255 * (1 - Math.abs(intensity - 0.5)*2));
  const b = 50;
  return `rgba(${r},${g},${b},1)`;
}

// Chargement des frames depuis l'API
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

// Fond dégradé thermique
function drawThermalBackground() {
  const { width, height } = canvas;
  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, "green");
  grd.addColorStop(0.5, "yellow");
  grd.addColorStop(1, "red");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);
}

// Dessiner points et halos
function drawPoints() {
  for (let i = 0; i < displayedPoints.length; i++) {
    const p = displayedPoints[i];
    const ageFactor = (i + 1) / displayedPoints.length;
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * ageFactor;

    const color = thermalColor(p.x, p.y);
    const haloRadius = size * 2;

    const x = (p.x / 100) * canvas.width;
    const y = canvas.height - (p.y / 100) * canvas.height;

    // Halo dégradé
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    gradient.addColorStop(0, color.replace("1)", `${0.5 * ageFactor})`));
    gradient.addColorStop(0.5, color.replace("1)", `${0.2 * ageFactor})`));
    gradient.addColorStop(1, color.replace("1)", `0)`));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, 2*Math.PI);
    ctx.fill();

    // Point principal
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2*Math.PI);
    ctx.fill();
  }
}

function nextFrame() {
  if (!allFrames.length) return;

  displayedPoints.push(allFrames[currentFrame]);
  if (displayedPoints.length > TRAIL_LENGTH) displayedPoints.shift();

  drawThermalBackground();
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
  drawThermalBackground();
  drawPoints();
}

// Légende artistique
function initLegend() {
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    Fond : vert → stable, jaune → intermédiaire, rouge → critique<br>
    Points : halo + couleur selon GAQI/GEI<br>
    Plus récents → plus gros et lumineux
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

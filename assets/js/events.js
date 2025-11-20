/* assets/js/events.js - Version immersive + lente + halos subtils */

const POINT_MIN_SIZE = 3;      // avant : 4
const POINT_MAX_SIZE = 10;     // avant : 14
const HALO_SCALE = 1.4;        // avant : 2
const TRAIL_LENGTH = 60;

const FRAME_SKIP = 3; // ← diminue la vitesse : une frame sur 3
let frameCounter = 0;

let canvas, ctx;
let allFrames = [];
let displayedPoints = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Convertir GAQI/GEI en couleur thermique
function thermalColor(gaqi, gei, alpha = 1) {
  const intensity = Math.min(1, (gaqi + gei) / 200);
  const r = Math.floor(255 * intensity);
  const g = Math.floor(255 * (1 - Math.abs(intensity - 0.5) * 2));
  return `rgba(${r},${g},50,${alpha})`;
}

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

// Fond thermique artistique
function drawThermalBackground() {
  const { width, height } = canvas;
  const grd = ctx.createLinearGradient(0, 0, width, height);

  const last = displayedPoints[displayedPoints.length - 1];
  const colorStart = last ? thermalColor(last.x, last.y, 0.15) : "rgba(0,200,0,0.15)";
  const colorMid   = last ? thermalColor(last.x, last.y, 0.35) : "rgba(255,255,0,0.15)";
  const colorEnd   = last ? thermalColor(last.x, last.y, 0.55) : "rgba(255,0,0,0.15)";

  grd.addColorStop(0,   colorStart);
  grd.addColorStop(0.5, colorMid);
  grd.addColorStop(1,   colorEnd);

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);
}

// Points + halo + trail subtils
function drawPoints() {
  ctx.globalCompositeOperation = "lighter";

  displayedPoints.forEach((p, i) => {
    const ageFactor = (i + 1) / displayedPoints.length;
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * ageFactor;

    const color = thermalColor(p.x, p.y, 0.5 * ageFactor);
    const haloRadius = size * HALO_SCALE + ageFactor * 3; // halo réduit

    const x = (p.x / 100) * canvas.width;
    const y = canvas.height - (p.y / 100) * canvas.height;

    // Halo
    const g = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    g.addColorStop(0,   color.replace(/[^,]+(?=\))/, 0.35 * ageFactor));
    g.addColorStop(0.6, color.replace(/[^,]+(?=\))/, 0.15 * ageFactor));
    g.addColorStop(1,   color.replace(/[^,]+(?=\))/, 0));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Point
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();

    // Trail subtil
    if (i > 0) {
      const prev = displayedPoints[i - 1];
      const px = (prev.x / 100) * canvas.width;
      const py = canvas.height - (prev.y / 100) * canvas.height;

      ctx.strokeStyle = thermalColor((p.x + prev.x) / 2, (p.y + prev.y) / 2, 0.12 * ageFactor);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  });

  ctx.globalCompositeOperation = "source-over";
}

// Frame suivante (plus lente)
function nextFrame() {
  if (!allFrames.length) return;

  frameCounter++;
  if (frameCounter % FRAME_SKIP !== 0) {
    if (animating) animationId = requestAnimationFrame(nextFrame);
    return;
  }

  displayedPoints.push(allFrames[currentFrame]);
  if (displayedPoints.length > TRAIL_LENGTH) displayedPoints.shift();

  // Mise à jour du slider
  document.getElementById("timeline").value = currentFrame;

  drawThermalBackground();
  drawPoints();

  currentFrame = (currentFrame + 1) % allFrames.length;

  if (animating) animationId = requestAnimationFrame(nextFrame);
}

// Contrôles
function toggleAnimation() {
  animating = !animating;
  document.getElementById("playPauseBtn").textContent = animating ? "Pause" : "Play";
  if (animating) nextFrame();
}

function updateTimeline() {
  const slider = document.getElementById("timeline");
  currentFrame = parseInt(slider.value);
  displayedPoints = allFrames.slice(Math.max(0, currentFrame - TRAIL_LENGTH), currentFrame + 1);
  drawThermalBackground();
  drawPoints();
}

// Initialisation
async function init() {
  canvas = document.getElementById("stabilityChart");
  ctx = canvas.getContext("2d");

  allFrames = await loadFrames(1800);
  if (!allFrames.length) return;

  const slider = document.getElementById("timeline");
  slider.max = allFrames.length - 1;
  slider.addEventListener("input", updateTimeline);

  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);

  displayedPoints = [];
  nextFrame();
}

window.addEventListener("load", init);

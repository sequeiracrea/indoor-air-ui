/* assets/js/events.js - Version fond blanc + grille + halo & trail thermiques */

const POINT_MIN_SIZE = 3;
const POINT_MAX_SIZE = 10;
const HALO_SCALE = 1.4;
const TRAIL_LENGTH = 60;

const FRAME_SKIP = 3; 
let frameCounter = 0;

let canvas, ctx;
let allFrames = [];
let displayedPoints = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Couleur thermique (halo + trail)
function thermalColor(gaqi, gei, alpha = 1) {
  const intensity = Math.min(1, (gaqi + gei) / 200);
  const r = Math.floor(255 * intensity);
  const g = Math.floor(255 * (1 - Math.abs(intensity - 0.5) * 2));
  return `rgba(${r},${g},50,${alpha})`;
}

// Charger frames
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
  } catch {
    return [];
  }
}

// Grille blanche + axes
function drawGrid() {
  const { width, height } = canvas;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = 1;

  const step = 50; // spacing of the grid

  // vertical
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // horizontal
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Axes (plus visibles)
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;

  // Axe GAQI (x)
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(width, height);
  ctx.stroke();

  // Axe GEI (y)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, height);
  ctx.stroke();
}

// Points + halo + trail thermiques
function drawPoints() {
  ctx.globalCompositeOperation = "lighter";

  displayedPoints.forEach((p, i) => {
    const age = (i + 1) / displayedPoints.length;
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * age;

    const color = thermalColor(p.x, p.y, 0.5 * age);
    const haloRadius = size * HALO_SCALE + age * 3;

    const x = (p.x / 100) * canvas.width;
    const y = canvas.height - (p.y / 100) * canvas.height;

    // ---- HALO ----
    const g = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    g.addColorStop(0,   color.replace(/[^,]+(?=\))/, 0.35));
    g.addColorStop(0.6, color.replace(/[^,]+(?=\))/, 0.12));
    g.addColorStop(1,   color.replace(/[^,]+(?=\))/, 0));

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, 2 * Math.PI);
    ctx.fill();

    // ---- POINT ----
    ctx.fillStyle = color.replace(/[^,]+(?=\))/, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();

    // ---- TRAIL ----
    if (i > 0) {
      const prev = displayedPoints[i - 1];
      const px = (prev.x / 100) * canvas.width;
      const py = canvas.height - (prev.y / 100) * canvas.height;

      ctx.strokeStyle = thermalColor((p.x + prev.x) / 2, (p.y + prev.y) / 2, 0.18 * age);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  });

  ctx.globalCompositeOperation = "source-over";
}

// Frame suivante (lente)
function nextFrame() {
  if (!allFrames.length) return;

  frameCounter++;
  if (frameCounter % FRAME_SKIP !== 0) {
    if (animating) animationId = requestAnimationFrame(nextFrame);
    return;
  }

  displayedPoints.push(allFrames[currentFrame]);
  if (displayedPoints.length > TRAIL_LENGTH) displayedPoints.shift();

  // update slider
  document.getElementById("timeline").value = currentFrame;

  // redraw
  drawGrid();
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
  drawGrid();
  drawPoints();
}

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

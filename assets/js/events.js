/* assets/js/events.js - Version immersive et artistique */

const POINT_MIN_SIZE = 4;
const POINT_MAX_SIZE = 14;
const TRAIL_LENGTH = 60;

let canvas, ctx;
let allFrames = [];
let displayedPoints = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Convertir GAQI/GEI en couleur thermique RGBA
function thermalColor(gaqi, gei, alpha = 1) {
  const intensity = Math.min(1, (gaqi + gei) / 200);
  const r = Math.floor(255 * intensity);
  const g = Math.floor(255 * (1 - Math.abs(intensity - 0.5) * 2));
  const b = 50;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Charger frames depuis l’API
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

// Dessin du fond thermique animé
function drawThermalBackground() {
  const { width, height } = canvas;
  const grd = ctx.createLinearGradient(0, 0, width, height);

  const last = displayedPoints[displayedPoints.length - 1];
  const colorStart = last ? thermalColor(last.x, last.y, 0.3) : 'rgba(0,200,0,0.3)';
  const colorMid = last ? thermalColor(last.x, last.y, 0.6) : 'rgba(255,255,0,0.3)';
  const colorEnd = last ? thermalColor(last.x, last.y, 0.9) : 'rgba(255,0,0,0.3)';

  grd.addColorStop(0, colorStart);
  grd.addColorStop(0.5, colorMid);
  grd.addColorStop(1, colorEnd);

  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);
}

// Dessiner points avec trail et halo dynamique
function drawPoints() {
  ctx.globalCompositeOperation = 'lighter'; // effet lumineux
  for (let i = 0; i < displayedPoints.length; i++) {
    const p = displayedPoints[i];
    const ageFactor = (i + 1) / displayedPoints.length;
    const size = POINT_MIN_SIZE + (POINT_MAX_SIZE - POINT_MIN_SIZE) * ageFactor;

    const color = thermalColor(p.x, p.y, ageFactor);
    const haloRadius = size * 2 + ageFactor * 4;

    const x = (p.x / 100) * canvas.width;
    const y = canvas.height - (p.y / 100) * canvas.height;

    // Halo dynamique
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, haloRadius);
    gradient.addColorStop(0, color.replace(/[^,]+(?=\))/, 0.6 * ageFactor));
    gradient.addColorStop(0.5, color.replace(/[^,]+(?=\))/, 0.3 * ageFactor));
    gradient.addColorStop(1, color.replace(/[^,]+(?=\))/, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Point principal
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, 2 * Math.PI);
    ctx.fill();

    // Trail progressif
    if (i > 0) {
      const prev = displayedPoints[i - 1];
      const px = (prev.x / 100) * canvas.width;
      const py = canvas.height - (prev.y / 100) * canvas.height;
      ctx.strokeStyle = thermalColor((prev.x + p.x)/2, (prev.y + p.y)/2, 0.2 * ageFactor);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// Frame suivante
function nextFrame() {
  if (!allFrames.length) return;

  displayedPoints.push(allFrames[currentFrame]);
  if (displayedPoints.length > TRAIL_LENGTH) displayedPoints.shift();

  drawThermalBackground();
  drawPoints();

  currentFrame = (currentFrame + 1) % allFrames.length;
  if (animating) animationId = requestAnimationFrame(nextFrame);
}

// Play/Pause
function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if (animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// Curseur timeline
function updateTimeline() {
  const slider = document.getElementById("timeline");
  currentFrame = parseInt(slider.value);
  displayedPoints = allFrames.slice(Math.max(0, currentFrame - TRAIL_LENGTH), currentFrame + 1);
  drawThermalBackground();
  drawPoints();
}

// Légende dynamique
function initLegend() {
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    Fond : dégradé thermique selon GAQI/GEI<br>
    Points : halo + couleur selon valeur<br>
    Taille et luminosité proportionnelles à la récence<br>
    Trail semi-transparent montre trajectoire
  `;
}

// Initialisation
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

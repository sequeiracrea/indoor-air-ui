// assets/js/events.js
const STABILITY_COLORS = { stable: "rgba(0,200,0,0.15)", alert: "rgba(255,165,0,0.15)", unstable: "rgba(255,0,0,0.15)" };
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

const TRAIL_LENGTH = 60;     // nombre de points du trail
const MICRO_POINTS = 30;     // facultatif pour micro-points statiques

let stabilityChart;
let frames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let trailPoints = [];
let microPoints = [];

// Charger les frames depuis l'historique de l'API
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

// Filtrer les points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// Zones de fond type nucléide
function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const width = right - left;
  const height = bottom - top;

  ctx.save();
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, width * 0.5, height * 0.5);
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + width * 0.5, top, width * 0.5, height * 0.5);
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + height * 0.5, width, height * 0.5);
  ctx.restore();
}

// Rendu du chart
function renderChart(points) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Trail",
        data: points.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: points.map(p => {
          const score = Math.sqrt((p.x / 100) ** 2 + (p.y / 100) ** 2 + (p.tci / 100) ** 2 + (p.sri / 100) ** 2);
          if (score > 0.75) return POINT_COLORS.unstable;
          else if (score > 0.5) return POINT_COLORS.alert;
          return POINT_COLORS.stable;
        }),
        pointRadius: 6,
        pointHoverRadius: 10
      },
      {
        label: "Micro-points",
        data: microPoints.map(p => ({ x: p.x, y: p.y })),
        pointBackgroundColor: "rgba(0,0,0,0.1)",
        pointRadius: 2,
        showLine: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: "GAQI" } },
        y: { min: 0, max: 100, title: { display: true, text: "GEI" } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              if (!p) return '';
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}`;
            }
          }
        },
        legend: {
          display: true,
          labels: {
            generateLabels: chart => [
              { text: "Stable (vert)", fillStyle: STABILITY_COLORS.stable, strokeStyle: STABILITY_COLORS.stable },
              { text: "Alerte (orange)", fillStyle: STABILITY_COLORS.alert, strokeStyle: STABILITY_COLORS.alert },
              { text: "Instable (rouge)", fillStyle: STABILITY_COLORS.unstable, strokeStyle: STABILITY_COLORS.unstable }
            ]
          }
        }
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// Avancer d’une frame (avec trail persistant)
function nextFrame() {
  if (!frames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const newPoint = filterPoints([frames[currentFrame]], tciMin, tciMax, sriMin, sriMax);

  // Ajouter au trail
  newPoint.forEach(p => trailPoints.push(p));
  if (trailPoints.length > TRAIL_LENGTH) trailPoints.splice(0, trailPoints.length - TRAIL_LENGTH);

  renderChart(trailPoints);

  currentFrame = (currentFrame + 1) % frames.length;
  if (animating) animationId = requestAnimationFrame(nextFrame);
}

// Play / Pause
function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if (animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// Application des filtres manuels
function applyFilters() {
  currentFrame = 0;
  trailPoints = [];
  nextFrame();
}

// Initialisation
async function init() {
  frames = await loadFramesFromHistory(1800);
  if (!frames.length) return;

  // Initialiser micro-points statiques
  microPoints = frames.slice(0, MICRO_POINTS);

  // Ajouter boutons Play/Pause
  const btn = document.createElement("button");
  btn.id = "playPauseBtn";
  btn.textContent = "Play";
  btn.addEventListener("click", toggleAnimation);
  document.getElementById("filters").appendChild(btn);

  // Ajouter bouton Appliquer filtre
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Légende explicative
  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    Fond vert : stable<br>
    Fond orange : alerte<br>
    Fond rouge : instable<br>
    Points : trail dynamique<br>
    Micro-points : statiques<br>
    Tooltip : GAQI, GEI, SRI, TCI
  `;

  // Premier rendu
  nextFrame();
}

window.addEventListener("load", init);

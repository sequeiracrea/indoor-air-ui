const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};

const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

const TRAIL_LENGTH = 60;  // nombre de frames conservées pour trail
const MICRO_POINTS = 30;   // nombre de micro-points statiques (optionnel)

async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series || !history.series.length) return [];

    // Chaque frame contient x,y,tci,sri
    const frames = history.series.map(entry => {
      const idx = entry.indices || {};
      const { GAQI = 0, GEI = 0, SRI = 0, TCI = 0 } = idx;
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI };
    });

    return frames;
  } catch (err) {
    console.error("Erreur historique :", err);
    return [];
  }
}

function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

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

function initChart() {
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "État environnemental",
        data: [],
        pointBackgroundColor: [],
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}`;
            }
          }
        },
        legend: { display: false }
      },
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: "GAQI" } },
        y: { min: 0, max: 100, title: { display: true, text: "GEI" } }
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

function updateChartTrail(filtered) {
  // Ajoute les points à l'historique trail
  if (!stabilityChart) return;

  let trailData = stabilityChart.data.datasets[0].data || [];
  trailData.push(...filtered.map(p => ({ x: p.x, y: p.y, extra: p })));
  if (trailData.length > TRAIL_LENGTH) trailData = trailData.slice(-TRAIL_LENGTH);

  // Taille variable des points selon récence
  const sizes = trailData.map((_, i) => 4 + (i / trailData.length) * 6);

  // Couleurs selon score
  const colors = trailData.map(p => {
    const score = Math.sqrt((p.extra.x / 100) ** 2 + (p.extra.y / 100) ** 2 + (p.extra.tci / 100) ** 2 + (p.extra.sri / 100) ** 2);
    if (score > 0.75) return POINT_COLORS.unstable;
    if (score > 0.5) return POINT_COLORS.alert;
    return POINT_COLORS.stable;
  });

  stabilityChart.data.datasets[0].data = trailData;
  stabilityChart.data.datasets[0].pointRadius = sizes;
  stabilityChart.data.datasets[0].pointBackgroundColor = colors;

  stabilityChart.update("none");
}

function nextFrame() {
  if (!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const filtered = filterPoints([allFrames[currentFrame]], tciMin, tciMax, sriMin, sriMax);
  updateChartTrail(filtered);

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
  currentFrame = 0;
  if (!animating) nextFrame();
}

function initLegend() {
  const leg = document.getElementById("stabilityLegend");
  leg.innerHTML = `
    <strong>Légende :</strong><br>
    Fond vert : stable<br>
    Fond orange : alerte<br>
    Fond rouge : instable<br>
    Points : état + récence (taille)<br>
    Tooltip : GAQI, GEI, SRI, TCI
  `;
}

async function init() {
  initChart();
  allFrames = await loadFramesFromHistory(1800);
  if (!allFrames.length) return;

  // Play/Pause button
  const btn = document.createElement("button");
  btn.id = "playPauseBtn";
  btn.textContent = "Play";
  btn.addEventListener("click", toggleAnimation);
  document.getElementById("filters").appendChild(btn);

  // Appliquer filtres
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Légende
  initLegend();

  // Premier rendu
  nextFrame();
}

window.addEventListener("load", init);

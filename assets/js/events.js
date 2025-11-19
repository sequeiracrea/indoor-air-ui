/* assets/js/events.js */
const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let frames = [];
let currentFrameIndex = 0;
let animating = false;

const TRAIL_LENGTH = 60; // nombre de frames visibles dans le trail

// --- Chargement historique depuis l'API ---
async function loadFrames(sec = 1800) {
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

// --- Filtre des points selon TCI / SRI ---
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// --- Fond type nucléide ---
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

// --- Rendu du chart ---
function renderChartForIndex(frameIndex, tciMin, tciMax, sriMin, sriMax) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if (!frames.length) return;

  // récupère les frames pour le trail
  const trailFrames = [];
  for (let i = TRAIL_LENGTH - 1; i >= 0; i--) {
    const idx = frameIndex - i;
    if (idx >= 0 && frames[idx]) trailFrames.push(frames[idx]);
  }

  const filtered = filterPoints(trailFrames, tciMin, tciMax, sriMin, sriMax);
  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "État environnemental",
        data: filtered.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: filtered.map(p => {
          const score = Math.sqrt(
            (p.x / 100) ** 2 + (p.y / 100) ** 2 + (p.tci / 100) ** 2 + (p.sri / 100) ** 2
          );
          if (score > 0.75) return POINT_COLORS.unstable;
          if (score > 0.5) return POINT_COLORS.alert;
          return POINT_COLORS.stable;
        }),
        pointRadius: 6,
        pointHoverRadius: 10
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
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}`;
            }
          }
        },
        legend: { display: true, position: "bottom" }
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// --- Animation ---
function animate() {
  if (!animating || !frames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin")?.value || "0");
  const tciMax = parseFloat(document.getElementById("tciMax")?.value || "100");
  const sriMin = parseFloat(document.getElementById("sriMin")?.value || "0");
  const sriMax = parseFloat(document.getElementById("sriMax")?.value || "100");

  renderChartForIndex(currentFrameIndex, tciMin, tciMax, sriMin, sriMax);

  const slider = document.getElementById("timeSlider");
  if (slider) slider.value = currentFrameIndex;

  currentFrameIndex = (currentFrameIndex + 1) % frames.length;

  requestAnimationFrame(animate);
}

// --- Play / Pause ---
function togglePlayPause() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  if (btn) btn.textContent = animating ? "Pause" : "Play";
  if (animating) animate();
}

// --- Application filtre manuel ---
function applyFilters() {
  currentFrameIndex = 0;
  renderChartForIndex(currentFrameIndex,
    parseFloat(document.getElementById("tciMin")?.value || "0"),
    parseFloat(document.getElementById("tciMax")?.value || "100"),
    parseFloat(document.getElementById("sriMin")?.value || "0"),
    parseFloat(document.getElementById("sriMax")?.value || "100")
  );
}

// --- Initialisation ---
async function init() {
  frames = await loadFrames(1800);
  if (!frames.length) {
    console.warn("Aucune frame chargée !");
    return;
  }

  // bouton play / pause
  const btn = document.createElement("button");
  btn.id = "playPauseBtn";
  btn.textContent = "Play";
  btn.addEventListener("click", togglePlayPause);
  document.getElementById("filters").appendChild(btn);

  // slider temporel
  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = "timeSlider";
  slider.min = 0;
  slider.max = frames.length - 1;
  slider.value = 0;
  slider.addEventListener("input", e => {
    currentFrameIndex = parseInt(e.target.value, 10);
    renderChartForIndex(currentFrameIndex,
      parseFloat(document.getElementById("tciMin")?.value || "0"),
      parseFloat(document.getElementById("tciMax")?.value || "100"),
      parseFloat(document.getElementById("sriMin")?.value || "0"),
      parseFloat(document.getElementById("sriMax")?.value || "100")
    );
  });
  document.getElementById("filters").appendChild(slider);

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // afficher la première frame
  renderChartForIndex(currentFrameIndex,
    parseFloat(document.getElementById("tciMin")?.value || "0"),
    parseFloat(document.getElementById("tciMax")?.value || "100"),
    parseFloat(document.getElementById("sriMin")?.value || "0"),
    parseFloat(document.getElementById("sriMax")?.value || "100")
  );

  // légende complète
  const legend = document.getElementById("stabilityLegend");
  if (legend) legend.innerHTML = `
    <strong>Légende :</strong><br>
    - Fond vert : stable<br>
    - Fond orange : alerte<br>
    - Fond rouge : instable<br>
    - Points : indices GAQI/GEI filtrés<br>
    - Tooltip : GAQI, GEI, SRI, TCI
  `;
}

window.addEventListener("load", init);

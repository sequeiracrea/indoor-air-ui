
/* assets/js/events.js */

// Couleurs stabilité et points
const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.2)",
  unstable: "rgba(255,0,0,0.2)"
};
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let allFrames = [];
let timeIndex = 0;
let animationId = null;
let isPlaying = true;

// ------------------------
// Construire frames depuis l'historique API
// ------------------------
async function loadFramesFromHistory() {
  try {
    const history = await window.IndoorAPI.fetchHistory(1800);
    const series = history.series || [];
    if (!series.length) return;

    allFrames = series.map(entry => {
      const { GAQI, GEI, SRI, TCI } = entry.indices || {};
      const stabilityScore = Math.sqrt(
        ((SRI || 0)/100)**2 +
        ((GAQI || 0)/100)**2 +
        ((GEI || 0)/100)**2 +
        ((TCI || 0)/100)**2
      );
      let status = "stable";
      if (stabilityScore > 0.5 && stabilityScore <= 0.75) status = "alert";
      else if (stabilityScore > 0.75) status = "unstable";

      return {
        x: GAQI || 0,
        y: GEI || 0,
        sri: SRI || 0,
        tci: TCI || 0,
        score: stabilityScore,
        status
      };
    });
  } catch (err) {
    console.error("Erreur historique :", err);
  }
}

// ------------------------
// Filtrer points selon curseurs
// ------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(p =>
    p.tci >= tciMin &&
    p.tci <= tciMax &&
    p.sri >= sriMin &&
    p.sri <= sriMax
  );
}

// ------------------------
// Fond type nucléide
// ------------------------
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

// ------------------------
// Rendu chart
// ------------------------
function renderChart(points) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "État environnemental",
        data: points.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: points.map(p => POINT_COLORS[p.status]),
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "GAQI" }, min: 0, max: 100 },
        y: { title: { display: true, text: "GEI" }, min: 0, max: 100 }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, Score: ${p.score.toFixed(2)}, État: ${p.status}`;
            }
          }
        },
        legend: { display: false }
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// ------------------------
// Animation
// ------------------------
function animateStep() {
  if (!isPlaying) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  const stepPoints = filterPoints(allFrames, tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);

  timeIndex = (timeIndex + 1) % allFrames.length;
  animationId = requestAnimationFrame(() => setTimeout(animateStep, 400));
}

// ------------------------
// Contrôles Play/Pause
// ------------------------
function togglePlayPause() {
  isPlaying = !isPlaying;
  document.getElementById("playPauseBtn").textContent = isPlaying ? "Pause" : "Play";
  if (isPlaying) animateStep();
}

// ------------------------
// Application filtre manuel
// ------------------------
function applyFilters() {
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  const stepPoints = filterPoints(allFrames, tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);
}

// ------------------------
// Initialisation
// ------------------------
window.addEventListener("load", async () => {
  await loadFramesFromHistory();

  // Initial render
  applyFilters();

  // Animation
  animateStep();

  // Contrôles
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Bouton Play/Pause
  const controlsDiv = document.createElement("div");
  controlsDiv.id = "animationControls";
  controlsDiv.style.margin = "10px 0";
  controlsDiv.innerHTML = `<button id="playPauseBtn">Pause</button>`;
  document.querySelector("#stabilitySection").insertBefore(controlsDiv, document.getElementById("stabilityChart"));
  document.getElementById("playPauseBtn").addEventListener("click", togglePlayPause);

  // Légende
  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    - Fond vert : stable<br>
    - Fond orange : alerte<br>
    - Fond rouge : instable<br>
    - Points : états issus de l'API<br>
    - Tooltip : tous les indices et score global
  `;
});

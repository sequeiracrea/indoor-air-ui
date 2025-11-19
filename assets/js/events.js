const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};

const POINT_COLORS = {
  stable: "green",
  alert: "orange",
  unstable: "red"
};

let stabilityChart = null;
let allPoints = [];
let timeIndex = 0;
let isPlaying = true;
let animationId = null;

// --------------------------------------------------
// Charger les données depuis l'API
// --------------------------------------------------
async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    const series = history.series || [];

    const frames = series.map(entry => {
      if (!entry.indices) return null;
      const { GAQI, GEI, TCI, SRI } = entry.indices;
      if ([GAQI, GEI, TCI, SRI].some(v => v === undefined)) return null;

      const stabilityScore = Math.sqrt(
        (GAQI / 100) ** 2 + (GEI / 100) ** 2 + (TCI / 100) ** 2 + (SRI / 100) ** 2
      );

      let status = "stable";
      if (stabilityScore > 0.5 && stabilityScore <= 0.75) status = "alert";
      else if (stabilityScore > 0.75) status = "unstable";

      return { x: GAQI, y: GEI, sri: SRI, tci: TCI, status, score: stabilityScore };
    }).filter(f => f !== null);

    return frames;
  } catch (e) {
    console.error("Erreur historique :", e);
    return [];
  }
}

// --------------------------------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(
    p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax
  );
}

// --------------------------------------------------
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

// --------------------------------------------------
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

// --------------------------------------------------
function animateStep() {
  if (!isPlaying || allPoints.length === 0) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);

  const slider = document.getElementById("timeSlider");
  if (slider) slider.value = timeIndex;

  timeIndex = (timeIndex + 1) % allPoints.length;

  animationId = requestAnimationFrame(() => setTimeout(animateStep, 400));
}

// --------------------------------------------------
function togglePlay() {
  isPlaying = !isPlaying;
  if (isPlaying) animateStep();
  document.getElementById("playBtn").textContent = isPlaying ? "Pause" : "Play";
}

// --------------------------------------------------
function setupSlider() {
  const slider = document.getElementById("timeSlider");
  if (!slider || allPoints.length === 0) return;

  slider.min = 0;
  slider.max = allPoints.length - 1;
  slider.value = timeIndex;

  slider.addEventListener("input", e => {
    timeIndex = parseInt(e.target.value);
    const tciMin = parseFloat(document.getElementById("tciMin").value);
    const tciMax = parseFloat(document.getElementById("tciMax").value);
    const sriMin = parseFloat(document.getElementById("sriMin").value);
    const sriMax = parseFloat(document.getElementById("sriMax").value);

    const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);
    renderChart(stepPoints);
  });
}

// --------------------------------------------------
async function init() {
  allPoints = await loadFramesFromHistory(1800);
  if (allPoints.length === 0) return;

  renderChart(allPoints[0]);

  const playBtn = document.getElementById("playBtn");
  if (playBtn) playBtn.addEventListener("click", togglePlay);

  document.getElementById("applyFilters").addEventListener("click", () => {
    const tciMin = parseFloat(document.getElementById("tciMin").value);
    const tciMax = parseFloat(document.getElementById("tciMax").value);
    const sriMin = parseFloat(document.getElementById("sriMin").value);
    const sriMax = parseFloat(document.getElementById("sriMax").value);

    const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);
    renderChart(stepPoints);
  });

  setupSlider();
  animateStep();

  const legend = document.getElementById("stabilityLegend");
  if (legend) {
    legend.innerHTML = `
      <strong>Légende :</strong><br>
      - Fond vert : stable<br>
      - Fond orange : alerte<br>
      - Fond rouge : instable<br>
      - Points : indices GAQI/GEI filtrés par TCI/SRI<br>
      - Tooltip : tous les indices et score global
    `;
  }
}

window.addEventListener("load", init);

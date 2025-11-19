let stabilityChart = null;
let allFrames = [];
let timeIndex = 0;
let isPlaying = true;
let animationId = null;

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

// --------------------------------------------------
// Charger les frames depuis l'historique
async function loadFrames() {
  try {
    const data = await window.IndoorAPI.fetchHistory(3600);
    const series = data.series || [];
    // chaque frame = un tableau de points (ici 1 point par timestamp)
    allFrames = series.map(entry => {
      if (!entry.indices) return null;
      const { GAQI, GEI, TCI, SRI } = entry.indices;
      if ([GAQI, GEI, TCI, SRI].some(v => v === undefined)) return null;

      const score = Math.sqrt(
        (GAQI / 100) ** 2 + (GEI / 100) ** 2 + (TCI / 100) ** 2 + (SRI / 100) ** 2
      );

      let status = "stable";
      if (score > 0.5 && score <= 0.75) status = "alert";
      else if (score > 0.75) status = "unstable";

      return [{ x: GAQI, y: GEI, tci: TCI, sri: SRI, status, score }];
    }).filter(f => f !== null);
  } catch (e) {
    console.error("Erreur historique :", e);
  }
}

// --------------------------------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
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
              return `GAQI:${p.x.toFixed(1)}, GEI:${p.y.toFixed(1)}, SRI:${p.sri.toFixed(1)}, TCI:${p.tci.toFixed(1)}, Score:${p.score.toFixed(2)}, Etat:${p.status}`;
            }
          }
        },
        legend: { display: false }
      }
    },
    plugins: [{
      id: "bg",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// --------------------------------------------------
function animateStep() {
  if (!isPlaying || allFrames.length === 0) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  const stepPoints = filterPoints(allFrames[timeIndex], tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);

  const slider = document.getElementById("timeSlider");
  if (slider) slider.value = timeIndex;

  timeIndex = (timeIndex + 1) % allFrames.length;
  animationId = requestAnimationFrame(() => setTimeout(animateStep, 400));
}

// --------------------------------------------------
function initControls() {
  document.getElementById("playBtn").addEventListener("click", () => {
    isPlaying = !isPlaying;
    document.getElementById("playBtn").textContent = isPlaying ? "Pause" : "Play";
    if (isPlaying) animateStep();
  });

  document.getElementById("applyFilters").addEventListener("click", () => {
    const tciMin = parseFloat(document.getElementById("tciMin").value);
    const tciMax = parseFloat(document.getElementById("tciMax").value);
    const sriMin = parseFloat(document.getElementById("sriMin").value);
    const sriMax = parseFloat(document.getElementById("sriMax").value);

    const stepPoints = filterPoints(allFrames[timeIndex], tciMin, tciMax, sriMin, sriMax);
    renderChart(stepPoints);
  });

  const slider = document.getElementById("timeSlider");
  slider.min = 0;
  slider.max = allFrames.length - 1;
  slider.value = timeIndex;
  slider.addEventListener("input", e => {
    timeIndex = parseInt(e.target.value);
    const tciMin = parseFloat(document.getElementById("tciMin").value);
    const tciMax = parseFloat(document.getElementById("tciMax").value);
    const sriMin = parseFloat(document.getElementById("sriMin").value);
    const sriMax = parseFloat(document.getElementById("sriMax").value);

    const stepPoints = filterPoints(allFrames[timeIndex], tciMin, tciMax, sriMin, sriMax);
    renderChart(stepPoints);
  });
}

// --------------------------------------------------
async function init() {
  await loadFrames();
  if (allFrames.length === 0) return;

  renderChart(allFrames[0]);
  initControls();
  animateStep();

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    - Fond vert : stable<br>
    - Fond orange : alerte<br>
    - Fond rouge : instable<br>
    - Points : indices GAQI/GEI filtrés par TCI/SRI<br>
    - Tooltip : tous les indices et score global
  `;
}

window.addEventListener("load", init);

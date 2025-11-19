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

let stabilityChart;
let allPoints = [];
let isAnimating = false;
let animationIndex = 0;
let animationFrameId = null;

// Récupération des données de l'API
async function loadPoints() {
  try {
    const history = await window.IndoorAPI.fetchHistory(3600);
    const series = history.series || [];
    allPoints = series.map(entry => {
      const { GAQI = 0, GEI = 0, SRI = 0, TCI = 0 } = entry.indices || {};
      const stabilityScore = Math.sqrt((SRI/100)**2 + (GAQI/100)**2 + (GEI/100)**2 + (TCI/100)**2);
      let status = "stable";
      if (stabilityScore > 0.5 && stabilityScore <= 0.75) status = "alert";
      else if (stabilityScore > 0.75) status = "unstable";
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI, score: stabilityScore, status };
    });
    renderChart(filterPoints());
  } catch (e) {
    console.error("Erreur historique :", e);
  }
}

// Filtrer points selon TCI et SRI
function filterPoints() {
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);
  return allPoints.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// Dessiner le graphique
function renderChart(points) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: 'scatter',
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
      },
      scales: {
        x: { title: { display: true, text: "GAQI" }, min: 0, max: 100 },
        y: { title: { display: true, text: "GEI" }, min: 0, max: 100 }
      }
    },
    plugins: [{
      id: 'backgroundPlugin',
      beforeDraw: chart => {
        const { left, right, top, bottom } = chart.chartArea;
        const width = right - left;
        const height = bottom - top;
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = STABILITY_COLORS.stable;
        ctx.fillRect(left, top, width * 0.5, height * 0.5);
        ctx.fillStyle = STABILITY_COLORS.alert;
        ctx.fillRect(left + width * 0.5, top, width * 0.5, height * 0.5);
        ctx.fillStyle = STABILITY_COLORS.unstable;
        ctx.fillRect(left, top + height * 0.5, width, height * 0.5);
        ctx.restore();
      }
    }]
  });
}

// Animation simple : faire défiler les points un par un
function animate() {
  if (!isAnimating) return;
  const frameSize = 20; // nombre de points affichés à la fois
  const slice = allPoints.slice(animationIndex, animationIndex + frameSize);
  renderChart(slice);
  animationIndex = (animationIndex + 1) % allPoints.length;
  animationFrameId = setTimeout(animate, 400);
}

// Toggle Play/Pause
document.addEventListener("DOMContentLoaded", () => {
  loadPoints();

  document.getElementById("applyFilters").addEventListener("click", () => {
    renderChart(filterPoints());
  });

  document.getElementById("toggleAnimation").addEventListener("click", e => {
    isAnimating = !isAnimating;
    e.target.textContent = isAnimating ? "Pause" : "Play";
    if (isAnimating) animate();
    else clearTimeout(animationFrameId);
  });
});

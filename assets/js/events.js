/* ============================================
   CONFIG
=============================================== */
const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.2)",
  alert: "rgba(255,165,0,0.2)",
  unstable: "rgba(255,0,0,0.2)"
};

const POINT_COLORS = {
  stable: "green",
  alert: "orange",
  unstable: "red"
};

let stabilityChart = null;
let allPoints = [];
let timeIndex = 0;
const maxTimeSteps = 50;
let animationRunning = true;

/* ============================================
   SIMULATE DATA
=============================================== */
function generateAnimatedData(numPoints = 150, steps = maxTimeSteps) {
  const data = [];

  for (let t = 0; t < steps; t++) {
    const stepPoints = [];

    for (let i = 0; i < numPoints; i++) {
      const SRI = Math.random() * 100;
      const GAQI = Math.random() * 100;
      const GEI = Math.random() * 100;
      const TCI = Math.random() * 100;

      const stabilityScore = Math.sqrt(
        (SRI / 100) ** 2 +
        (GAQI / 100) ** 2 +
        (GEI / 100) ** 2 +
        (TCI / 100) ** 2
      );

      let status = "stable";
      if (stabilityScore > 0.5 && stabilityScore <= 0.75) status = "alert";
      else if (stabilityScore > 0.75) status = "unstable";

      stepPoints.push({
        x: GAQI,
        y: GEI,
        sri: SRI,
        tci: TCI,
        score: stabilityScore,
        status
      });
    }
    data.push(stepPoints);
  }
  return data;
}

/* ============================================
   FILTER LOGIC
=============================================== */
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(p =>
    p.tci >= tciMin &&
    p.tci <= tciMax &&
    p.sri >= sriMin &&
    p.sri <= sriMax
  );
}

/* ============================================
   BACKGROUND PLUGIN
=============================================== */
function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const w = right - left;
  const h = bottom - top;

  ctx.save();
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, w * 0.5, h * 0.5);

  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + w * 0.5, top, w * 0.5, h * 0.5);

  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + h * 0.5, w, h * 0.5);
  ctx.restore();
}

/* ============================================
   INIT CHART ONCE
=============================================== */
function initChart() {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "État environnemental",
        data: [],
        pointRadius: 6,
        pointHoverRadius: 10,
        pointBackgroundColor: []
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, Score: ${p.score.toFixed(2)}, État: ${p.status}`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: "GAQI" }, min: 0, max: 100 },
        y: { title: { display: true, text: "GEI" }, min: 0, max: 100 }
      }
    },
    plugins: [{
      id: "bg",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

/* ============================================
   UPDATE CHART ONLY (NO RECREATION)
=============================================== */
function updateChart(points) {
  const ds = stabilityChart.data.datasets[0];

  ds.data = points.map(p => ({ x: p.x, y: p.y, extra: p }));
  ds.pointBackgroundColor = points.map(p => POINT_COLORS[p.status]);

  stabilityChart.update();
}

/* ============================================
   ANIMATION LOOP SAFE
=============================================== */
function animate() {
  if (!animationRunning) return;

  const tciMin = +document.getElementById("tciMin").value;
  const tciMax = +document.getElementById("tciMax").value;
  const sriMin = +document.getElementById("sriMin").value;
  const sriMax = +document.getElementById("sriMax").value;

  const filtered = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);

  updateChart(filtered);

  timeIndex = (timeIndex + 1) % maxTimeSteps;

  setTimeout(() => requestAnimationFrame(animate), 400);
}

/* ============================================
   APPLY MANUAL FILTERS
=============================================== */
function applyFilters() {
  const tciMin = +document.getElementById("tciMin").value;
  const tciMax = +document.getElementById("tciMax").value;
  const sriMin = +document.getElementById("sriMin").value;
  const sriMax = +document.getElementById("sriMax").value;

  const filtered = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);
  updateChart(filtered);
}

/* ============================================
   INIT
=============================================== */
window.addEventListener("load", () => {
  allPoints = generateAnimatedData();
  initChart();
  animate();

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    ✔ Fond vert : stable<br>
    ⚠ Fond orange : alerte<br>
    ✖ Fond rouge : instable<br>
    • Points colorés selon état<br>
    • Animation dans le temps<br>
    • Tooltip complet<br>
  `;
});

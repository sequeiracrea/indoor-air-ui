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

// -------------------------------
// 1. Génération des données
// -------------------------------
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
        status,
        score: stabilityScore
      });
    }
    data.push(stepPoints);
  }
  return data;
}

// -------------------------------
// 2. Filtre dynamique
// -------------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(
    p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax
  );
}

// -------------------------------
// 3. Dessin background (zones nucléides)
// -------------------------------
function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const w = right - left;
  const h = bottom - top;

  ctx.save();

  // stable
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, w * 0.5, h * 0.5);

  // alert
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + w * 0.5, top, w * 0.5, h * 0.5);

  // unstable
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + h * 0.5, w, h * 0.5);

  ctx.restore();
}

// -------------------------------
// 4. Création du chart (une seule fois)
// -------------------------------
function createChart() {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "État environnemental",
        data: [],
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
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

// -------------------------------
// 5. Mise à jour du dataset (animation sans reboot !)
// -------------------------------
function updateChart(points) {
  const dataset = stabilityChart.data.datasets[0];

  dataset.data = points.map(p => ({
    x: p.x,
    y: p.y,
    extra: p,
    backgroundColor: POINT_COLORS[p.status]
  }));

  // Chart.js 4 : backgroundColor par point
  dataset.pointBackgroundColor = points.map(p => POINT_COLORS[p.status]);

  stabilityChart.update();
}

// -------------------------------
// 6. Boucle animation stable
// -------------------------------
function animateStep() {
  const tciMin = parseFloat(tciMinInput.value);
  const tciMax = parseFloat(tciMaxInput.value);
  const sriMin = parseFloat(sriMinInput.value);
  const sriMax = parseFloat(sriMaxInput.value);

  const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);

  updateChart(stepPoints);

  timeIndex = (timeIndex + 1) % maxTimeSteps;

  setTimeout(() => {
    requestAnimationFrame(animateStep);
  }, 400);
}

// -------------------------------
// 7. Gestion filtres manuels
// -------------------------------
function applyFilters() {
  const tciMin = parseFloat(tciMinInput.value);
  const tciMax = parseFloat(tciMaxInput.value);
  const sriMin = parseFloat(sriMinInput.value);
  const sriMax = parseFloat(sriMaxInput.value);

  const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);

  updateChart(stepPoints);
}

// -------------------------------
// 8. Initialisation
// -------------------------------
let tciMinInput, tciMaxInput, sriMinInput, sriMaxInput;

window.addEventListener("load", () => {
  tciMinInput = document.getElementById("tciMin");
  tciMaxInput = document.getElementById("tciMax");
  sriMinInput = document.getElementById("sriMin");
  sriMaxInput = document.getElementById("sriMax");

  allPoints = generateAnimatedData(150, maxTimeSteps);

  createChart();
  animateStep();

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    Fond vert : stable<br>
    Fond orange : alerte<br>
    Fond rouge : instable<br>
    Points : états animés<br>
    Tooltip : indices + score global
  `;
});

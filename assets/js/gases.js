/* assets/js/gases.js */

/* stock des instances Chart.js pour pouvoir les détruire avant recréation */
const chartInstances = {};

/* -------- LINES CHARTS (4 gaz) -------- */
async function loadCharts() {
  const history = await IndoorAPI.fetchHistory(3600); // 1h
  const data = history.series;

  if (!data || data.length === 0) return;

  const labels = data.map(d => d.timestamp);

  makeLineChart("coChart",  labels, data.map(d => d.measures.co),  "CO (ppm)");
  makeLineChart("co2Chart", labels, data.map(d => d.measures.co2), "CO₂ (ppm)");
  makeLineChart("no2Chart", labels, data.map(d => d.measures.no2), "NO₂ (ppb)");
  makeLineChart("nh3Chart", labels, data.map(d => d.measures.nh3), "NH₃ (ppm)");
}

// Afficher la carte scatter si elle existe
const scatterCard = document.getElementById("scatterCard");
if (scatterCard) scatterCard.style.display = "block";


/* Create a Chart.js line (corrigé) */
function makeLineChart(canvasId, labels, values, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Détruit l'ancien chart si déjà existant
  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  // Nouveau chart
  chartInstances[canvasId] = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

/* -------- SCATTER (depuis relationships) -------- */
async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const x = params.get("x");
  const y = params.get("y");

  if (!x || !y) return;  // Rien à faire

  const title = document.getElementById("scatterTitle");
  if (title) {
    title.textContent = `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;
  }

  const history = await IndoorAPI.fetchHistory(1800);
  const data = history.series;

  const points = data.map(d => ({
    x: d.measures[x],
    y: d.measures[y]
  }));

  const canvas = document.getElementById("gasesScatter");
  if (!canvas) return;

  // Détruit un ancien scatter s'il existe
  if (chartInstances["scatter"]) {
    chartInstances["scatter"].destroy();
  }

  chartInstances["scatter"] = new Chart(canvas, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${x} vs ${y}`,
          data: points,
          pointRadius: 4,
          borderWidth: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: item => `${x}: ${item.raw.x} — ${y}: ${item.raw.y}`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: x.toUpperCase() } },
        y: { title: { display: true, text: y.toUpperCase() } }
      }
    }
  });
}

/* -------- START -------- */
window.addEventListener("load", async () => {
  await loadScatterFromQuery();   // scatter si demandé
  await loadCharts();             // toujours afficher les 4 gaz
});

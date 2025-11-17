/* assets/js/gases.js */

async function loadCharts() {
  const history = await IndoorAPI.fetchHistory(3600); // 1h
  const data = history.series;

  if (!data || data.length === 0) return;

  const labels = data.map(d => d.timestamp);

  // ---- CHART LINES ----
  makeLineChart("coChart", labels, data.map(d => d.measures.co), "CO (ppm)");
  makeLineChart("co2Chart", labels, data.map(d => d.measures.co2), "CO₂ (ppm)");
  makeLineChart("no2Chart", labels, data.map(d => d.measures.no2), "NO₂ (ppb)");
  makeLineChart("nh3Chart", labels, data.map(d => d.measures.nh3), "NH₃ (ppm)");
}

/* Create a Chart.js line */
function makeLineChart(canvasId, labels, values, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  new Chart(canvas, {
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

/* -------- SCATTER SELECTION FROM RELATIONSHIPS -------- */
async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const x = params.get("x");
  const y = params.get("y");

  // No scatter requested → exit silently
  if (!x || !y) return;

  document.getElementById("scatterTitle").textContent = `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;

  const history = await IndoorAPI.fetchHistory(1800);
  const data = history.series;

  const points = data.map(d => ({
    x: d.measures[x],
    y: d.measures[y]
  }));

  const ctx = document.getElementById("gasesScatter");
  if (!ctx) return;

  new Chart(ctx, {
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
            label: (item) => `${x}: ${item.raw.x} — ${y}: ${item.raw.y}`
          }
        }
      }
    }
  });
}

/* -------- START -------- */
window.addEventListener("load", async () => {
  await loadScatterFromQuery();   // load scatter if needed
  await loadCharts();             // always load the 4 gases charts
});

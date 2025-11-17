/* assets/js/gases.js */

/* -----------------------------------------------------
   GLOBAL CHART INSTANCES
------------------------------------------------------*/
let scatterChart = null;
let coChartInstance = null;
let co2ChartInstance = null;
let no2ChartInstance = null;
let nh3ChartInstance = null;

/* -----------------------------------------------------
   LINE CHARTS : CO, CO2, NO2, NH3
------------------------------------------------------*/
async function loadCharts() {
  const history = await IndoorAPI.fetchHistory(3600);
  const data = history.series;
  if (!data || data.length === 0) return;

  const labels = data.map(d => d.timestamp);

  createLineChart("coChart", labels, data.map(d => d.measures.co), "CO (ppm)", "coChartInstance");
  createLineChart("co2Chart", labels, data.map(d => d.measures.co2), "CO₂ (ppm)", "co2ChartInstance");
  createLineChart("no2Chart", labels, data.map(d => d.measures.no2), "NO₂ (ppb)", "no2ChartInstance");
  createLineChart("nh3Chart", labels, data.map(d => d.measures.nh3), "NH₃ (ppm)", "nh3ChartInstance");
}

function createLineChart(canvasId, labels, values, label, instanceName) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // destroy existing chart if present
  if (window[instanceName]) window[instanceName].destroy();

  window[instanceName] = new Chart(canvas, {
    type: "line",
    data: { labels, datasets: [{ label, data: values, borderWidth: 2, fill: false }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

/* -----------------------------------------------------
   SCATTER DYNAMIQUE
------------------------------------------------------*/
function buildScatter(xvar, yvar, series) {
  const ctx = document.getElementById("gasesScatter");
  if (!ctx) return;

  const points = series.map(d => ({ x: d.measures[xvar], y: d.measures[yvar] }));

  // destroy existing scatter
  if (scatterChart) scatterChart.destroy();

  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: `${xvar.toUpperCase()} vs ${yvar.toUpperCase()}`,
        data: points,
        pointRadius: 4,
        pointBackgroundColor: points.map((_, i) => {
          const alpha = 0.2 + i / points.length * 0.8;
          return `rgba(30,100,220,${alpha})`;
        }),
        showLine: false,
        parsing: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: xvar.toUpperCase() } },
        y: { title: { display: true, text: yvar.toUpperCase() } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: item => `${xvar}: ${item.raw.x}, ${yvar}: ${item.raw.y}`
          }
        }
      }
    }
  });

  updateScatterDetails(xvar, yvar, series);
}

/* -----------------------------------------------------
   DETAILS STATISTIQUES
------------------------------------------------------*/
function updateScatterDetails(xvar, yvar, series) {
  const valuesX = series.map(s => s.measures[xvar]);
  const valuesY = series.map(s => s.measures[yvar]);
  if (!valuesX.length || !valuesY.length) return;

  const minX = Math.min(...valuesX);
  const maxX = Math.max(...valuesX);
  const minY = Math.min(...valuesY);
  const maxY = Math.max(...valuesY);
  const r = computeCorrelation(valuesX, valuesY);

  const detailsEl = document.getElementById("scatterDetails");
  if (!detailsEl) return;

  detailsEl.innerHTML = `
    <strong>Statistiques :</strong><br>
    n = ${series.length} points<br>
    Corrélation r = <strong>${r.toFixed(3)}</strong><br>
    ${xvar}: min ${minX.toFixed(2)} / max ${maxX.toFixed(2)}<br>
    ${yvar}: min ${minY.toFixed(2)} / max ${maxY.toFixed(2)}
  `;
}

/* -----------------------------------------------------
   PEARSON CORRELATION
------------------------------------------------------*/
function computeCorrelation(a, b) {
  const n = a.length;
  if (n < 2) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  return denA && denB ? num / Math.sqrt(denA * denB) : 0;
}

/* -----------------------------------------------------
   SELECTION MANUELLE X/Y
------------------------------------------------------*/
async function refreshScatterFromSelectors() {
  const x = document.getElementById("select-x").value;
  const y = document.getElementById("select-y").value;
  const history = await IndoorAPI.fetchHistory(1800);
  buildScatter(x, y, history.series);
  document.getElementById("scatterTitle").textContent =
    `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;
}

/* -----------------------------------------------------
   LOAD SCATTER FROM URL (relationships.html → gases)
------------------------------------------------------*/
async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const x = params.get("x") || "co2";
  const y = params.get("y") || "co";

  const xSelect = document.getElementById("select-x");
  const ySelect = document.getElementById("select-y");
  if (xSelect) xSelect.value = x;
  if (ySelect) ySelect.value = y;

  const history = await IndoorAPI.fetchHistory(1800);
  if (!history.series || history.series.length === 0) return;

  buildScatter(x, y, history.series);
  document.getElementById("scatterTitle").textContent =
    `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;
}

/* -----------------------------------------------------
   SETUP SELECTORS
------------------------------------------------------*/
function setupScatterSelector() {
  const btn = document.getElementById("btn-update-scatter");
  if (btn) btn.addEventListener("click", refreshScatterFromSelectors);

  const xSelect = document.getElementById("select-x");
  const ySelect = document.getElementById("select-y");
  if (!xSelect || !ySelect) return;

  const reload = async () => {
    const x = xSelect.value;
    const y = ySelect.value;
    const params = new URLSearchParams(window.location.search);
    params.set("x", x);
    params.set("y", y);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    await loadScatterFromQuery();
  };

  xSelect.addEventListener("change", reload);
  ySelect.addEventListener("change", reload);
}

/* -----------------------------------------------------
   INITIALISATION
------------------------------------------------------*/
window.addEventListener("load", async () => {
  setupScatterSelector();
  await loadCharts();
  await loadScatterFromQuery();
});

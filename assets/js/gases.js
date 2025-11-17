/* assets/js/gases.js */

let scatterChart = null;

/* -----------------------------------------------------
   LOAD LINE CHARTS (CO, CO2, NO2, NH3)
------------------------------------------------------*/
async function loadCharts() {
  const history = await IndoorAPI.fetchHistory(3600);
  const data = history.series;
  if (!data || data.length === 0) return;

  const labels = data.map(d => d.timestamp);

  makeLineChart("coChart", labels, data.map(d => d.measures.co), "CO (ppm)");
  makeLineChart("co2Chart", labels, data.map(d => d.measures.co2), "CO₂ (ppm)");
  makeLineChart("no2Chart", labels, data.map(d => d.measures.no2), "NO₂ (ppb)");
  makeLineChart("nh3Chart", labels, data.map(d => d.measures.nh3), "NH₃ (ppm)");
}

function makeLineChart(canvasId, labels, values, label) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label, data: values, borderWidth: 2, fill: false }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

/* -----------------------------------------------------
   SCATTER WITH GRADIENT + AUTO DETAILS
------------------------------------------------------*/
function buildScatter(xvar, yvar, series) {
  const ctx = document.getElementById("gasesScatter");
  if (!ctx) return;

  // gradient temporel : index 0 → clair, dernier → foncé
  const colors = series.map((_, i) => {
    const t = i / series.length;
    const alpha = 0.2 + t * 0.8; // transparence croissante
    return `rgba(30, 100, 220, ${alpha})`;
  });

  const points = series.map(d => ({
    x: d.measures[xvar],
    y: d.measures[yvar],
    backgroundColor: colors[series.indexOf(d)]
  }));

  if (scatterChart) scatterChart.destroy();

  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${xvar.toUpperCase()} vs ${yvar.toUpperCase()}`,
          data: points,
          pointRadius: 4,
          showLine: false,
          parsing: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: item =>
              `${xvar}: ${item.raw.x} — ${yvar}: ${item.raw.y}`
          }
        }
      }
    }
  });

  updateScatterDetails(xvar, yvar, series);
}

/* -----------------------------------------------------
   DETAILS : MIN/MAX/ÉCHANTILLONS/RÉSUMÉ CORRÉLATION
------------------------------------------------------*/
function updateScatterDetails(xvar, yvar, series) {
  const valuesX = series.map(s => s.measures[xvar]);
  const valuesY = series.map(s => s.measures[yvar]);

  const minX = Math.min(...valuesX);
  const maxX = Math.max(...valuesX);
  const minY = Math.min(...valuesY);
  const maxY = Math.max(...valuesY);

  const r = computeCorrelation(valuesX, valuesY);

  document.getElementById("scatterDetails").innerHTML = `
    <strong>Statistiques :</strong><br>
    n = ${series.length} points<br>
    Corrélation r = <strong>${r.toFixed(3)}</strong><br>
    ${xvar}: min ${minX.toFixed(2)} / max ${maxX.toFixed(2)}<br>
    ${yvar}: min ${minY.toFixed(2)} / max ${maxY.toFixed(2)}
  `;
}

/* Pearson */
function computeCorrelation(a, b) {
  const n = a.length;
  if (n < 2) return 0;

  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;

  let num = 0, da2 = 0, db2 = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    num += da * db;
    da2 += da * da;
    db2 += db * db;
  }
  const den = Math.sqrt(da2 * db2);
  return den === 0 ? 0 : num / den;
}

/* -----------------------------------------------------
   MANUAL SELECTION MODE (g)
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
  const x = params.get("x");
  const y = params.get("y");
  if (!x || !y) return;

  // update dropdowns
  document.getElementById("select-x").value = x;
  document.getElementById("select-y").value = y;

  const history = await IndoorAPI.fetchHistory(1800);
  buildScatter(x, y, history.series);

  document.getElementById("scatterTitle").textContent =
    `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;
}


/* -------- SCATTER AVEC HISTOGRAMMES MARGIN, LEGENDES ET RELOAD -------- */

let scatterChart = null;
let histXChart = null;
let histYChart = null;

async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const x = params.get("x") || "co2";
  const y = params.get("y") || "co";

  const titleEl = document.getElementById("scatterTitle");
  if (titleEl) titleEl.textContent = `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;

  const history = await IndoorAPI.fetchHistory(1800);
  const data = history.series;
  if (!data || data.length === 0) return;

  const points = data.map(d => ({ x: d.measures[x], y: d.measures[y] }));

  // --- Calcul histogrammes ---
  const bins = 20; // nombre de bins
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const histX = new Array(bins).fill(0);
  const histY = new Array(bins).fill(0);
  const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues), yMax = Math.max(...yValues);

  xValues.forEach(v => {
    const idx = Math.floor(((v - xMin) / (xMax - xMin)) * (bins - 1));
    histX[idx]++;
  });
  yValues.forEach(v => {
    const idx = Math.floor(((v - yMin) / (yMax - yMin)) * (bins - 1));
    histY[idx]++;
  });

  // --- Détruire chart existant ---
  if (scatterChart) scatterChart.destroy();
  if (histXChart) histXChart.destroy();
  if (histYChart) histYChart.destroy();

  const ctxScatter = document.getElementById("gasesScatter");
  const ctxHistX = document.getElementById("histX");
  const ctxHistY = document.getElementById("histY");

  // --- Scatter principal ---
  scatterChart = new Chart(ctxScatter, {
    type: "scatter",
    data: {
      datasets: [{
        label: `${x.toUpperCase()} vs ${y.toUpperCase()}`,
        data: points,
        pointRadius: 4,
        pointBackgroundColor: "#3B82F6",
        pointBorderColor: "#0f172a"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: x.toUpperCase() } },
        y: { title: { display: true, text: y.toUpperCase() } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => `${x.toUpperCase()}: ${item.raw.x}, ${y.toUpperCase()}: ${item.raw.y}`
          }
        }
      }
    }
  });

  // --- Histogrammes ---
  histXChart = new Chart(ctxHistX, {
    type: "bar",
    data: {
      labels: Array.from({ length: bins }, (_, i) => (xMin + i*(xMax-xMin)/bins).toFixed(2)),
      datasets: [{ label: `${x.toUpperCase()} distribution`, data: histX, backgroundColor: "#3B82F6" }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  histYChart = new Chart(ctxHistY, {
    type: "bar",
    data: {
      labels: Array.from({ length: bins }, (_, i) => (yMin + i*(yMax-yMin)/bins).toFixed(2)),
      datasets: [{ label: `${y.toUpperCase()} distribution`, data: histY, backgroundColor: "#ef4444" }]
    },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
}

/* -------- Setup select pour rechargement dynamique -------- */
function setupScatterSelector() {
  const xSelect = document.getElementById("scatterX");
  const ySelect = document.getElementById("scatterY");
  if (!xSelect || !ySelect) return;

  const reload = () => {
    const newX = xSelect.value;
    const newY = ySelect.value;
    const params = new URLSearchParams(window.location.search);
    params.set("x", newX);
    params.set("y", newY);
    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
    loadScatterFromQuery(); // rechargement dynamique
  };

  xSelect.addEventListener("change", reload);
  ySelect.addEventListener("change", reload);
}

/* -------- START -------- */
window.addEventListener("load", async () => {
  setupScatterSelector();
  await loadScatterFromQuery();
});




/* -----------------------------------------------------
   START
------------------------------------------------------*/
window.addEventListener("load", async () => {
  await loadScatterFromQuery();  
  await loadCharts();

  document
    .getElementById("btn-update-scatter")
    .addEventListener("click", refreshScatterFromSelectors);
});

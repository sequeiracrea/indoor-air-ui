/* -----------------------------------------------------
   GASES.JS — VERSION UNIFIÉE & PROPRE
------------------------------------------------------*/

let scatterChart = null;
let histXChart = null;
let histYChart = null;

/* -----------------------------------------------------
   CHARGEMENT DES COURBES CO / CO2 / NO2 / NH3
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
      datasets: [{ label, data: values, borderWidth: 2, fill: false }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

/* -----------------------------------------------------
   SCATTER + HISTOGRAMMES X/Y
------------------------------------------------------*/
function buildScatter(xvar, yvar, series) {
  const ctxScatter = document.getElementById("gasesScatter");
  const ctxHistX = document.getElementById("histX");
  const ctxHistY = document.getElementById("histY");
  if (!ctxScatter || !ctxHistX || !ctxHistY) return;

  const points = series.map(d => ({
    x: d.measures[xvar],
    y: d.measures[yvar]
  }));

  /* -------- Gradient temporel pour le scatter -------- */
  const colors = points.map((_, i) => {
    const t = i / points.length;
    return `rgba(30, 100, 220, ${0.2 + t * 0.8})`;
  });

  /* -------- Détruire anciens charts -------- */
  if (scatterChart) scatterChart.destroy();
  if (histXChart) histXChart.destroy();
  if (histYChart) histYChart.destroy();

  /* -------- SCATTER PRINCIPAL -------- */
  scatterChart = new Chart(ctxScatter, {
    type: "scatter",
    data: {
      datasets: [{
        label: `${xvar.toUpperCase()} vs ${yvar.toUpperCase()}`,
        data: points,
        pointRadius: 4,
        parsing: false,
        pointBackgroundColor: colors
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

  /* -----------------------------------------------------
     HISTOGRAMMES X ET Y
  ------------------------------------------------------*/
  const bins = 20;
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);

  const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues), yMax = Math.max(...yValues);

  const histX = new Array(bins).fill(0);
  const histY = new Array(bins).fill(0);

  xValues.forEach(v => {
    histX[Math.floor(((v - xMin) / (xMax - xMin)) * (bins - 1))]++;
  });
  yValues.forEach(v => {
    histY[Math.floor(((v - yMin) / (yMax - yMin)) * (bins - 1))]++;
  });

  /* -------- HISTO X -------- */
  histXChart = new Chart(ctxHistX, {
    type: "bar",
    data: {
      labels: Array.from({ length: bins }, (_, i) =>
        (xMin + i * (xMax - xMin) / bins).toFixed(2)
      ),
      datasets: [{ data: histX, backgroundColor: "#3B82F6" }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });

  /* -------- HISTO Y (horizontal) -------- */
  histYChart = new Chart(ctxHistY, {
    type: "bar",
    data: {
      labels: Array.from({ length: bins }, (_, i) =>
        (yMin + i * (yMax - yMin) / bins).toFixed(2)
      ),
      datasets: [{ data: histY, backgroundColor: "#ef4444" }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } }
    }
  });

  /* -------- Détails statistiques -------- */
  updateScatterDetails(xvar, yvar, series);
}

/* -----------------------------------------------------
   CALCUL STATISTIQUES : MIN / MAX / R
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
   MISE À JOUR VIA BOUTON (MANUELLE)
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
   CHARGEMENT VIA URL (depuis relationships.html)
------------------------------------------------------*/
async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const x = params.get("x") || "co2";
  const y = params.get("y") || "co";

  document.getElementById("select-x").value = x;
  document.getElementById("select-y").value = y;

  document.getElementById("scatterTitle").textContent =
    `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;

  const history = await IndoorAPI.fetchHistory(1800);
  buildScatter(x, y, history.series);
}

/* -----------------------------------------------------
   DÉMARRAGE
------------------------------------------------------*/
window.addEventListener("load", async () => {
  await loadCharts();
  await loadScatterFromQuery();

  document
    .getElementById("btn-update-scatter")
    .addEventListener("click", refreshScatterFromSelectors);
});

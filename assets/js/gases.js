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


/* -------- SCATTER AVEC LÉGENDE DYNAMIQUE ET RELOAD -------- */
async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  let x = params.get("x") || "co2";
  let y = params.get("y") || "co";

  const titleEl = document.getElementById("scatterTitle");
  if(titleEl) titleEl.textContent = `Scatter : ${x.toUpperCase()} vs ${y.toUpperCase()}`;

  const history = await IndoorAPI.fetchHistory(1800);
  const data = history.series;
  if (!data || data.length === 0) return;

  // Préparer les points et densité
  const points = data.map(d => ({ x: d.measures[x], y: d.measures[y] }));
  const maxDistance = 0.05 * (Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)));
  const densities = points.map(p => 
    points.filter(q => Math.abs(q.x - p.x) < maxDistance && Math.abs(q.y - p.y) < maxDistance).length
  );
  const maxDensity = Math.max(...densities);

  const colors = densities.map((d, i) => {
    const intensity = Math.min(1, d / maxDensity);
    const r = Math.floor(255 * intensity * 0.6 + 200 * (i / points.length) * 0.4); // rouge
    const g = Math.floor(100 * (1 - intensity));
    const b = Math.floor(255 * (1 - intensity) * 0.8); // bleu
    return `rgb(${r},${g},${b})`;
  });

  const ctx = document.getElementById("gasesScatter");
  if (!ctx) return;

  // Détruire chart précédent si présent
  if (ctx.chartInstance) ctx.chartInstance.destroy();

  ctx.chartInstance = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${x.toUpperCase()} vs ${y.toUpperCase()}`,
          data: points,
          pointBackgroundColor: colors,
          pointBorderColor: "#333",
          pointRadius: 5,
          showLine: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => `${x.toUpperCase()}: ${item.raw.x} — ${y.toUpperCase()}: ${item.raw.y}`
          }
        },
        legend: {
          display: true,
          labels: {
            generateLabels: (chart) => [
              { text: `Variable X: ${x.toUpperCase()}`, fillStyle: "blue" },
              { text: `Variable Y: ${y.toUpperCase()}`, fillStyle: "red" },
              { text: "Intensité = densité locale", fillStyle: "grey" }
            ]
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

/* -------- LISTENER POUR RELOAD DYNAMIQUE -------- */
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
    loadScatterFromQuery();
  };

  xSelect.addEventListener("change", reload);
  ySelect.addEventListener("change", reload);
}

/* -------- START -------- */
window.addEventListener("load", async () => {
  await loadScatterFromQuery();   
  setupScatterSelector();          // active le reload dynamique si selects présents
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

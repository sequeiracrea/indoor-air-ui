/* assets/js/gases.js */
let scatterChart = null;
let histXChart = null;
let histYChart = null;

/* ---------- LOAD LINE CHARTS ---------- */
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

function makeLineChart(id, labels, values, label) {
  const ctx = document.getElementById(id);
  if (!ctx) return;
  new Chart(ctx, { type: "line", data: { labels, datasets: [{ label, data: values, borderWidth: 2, fill: false }] }, options: { responsive: true, maintainAspectRatio: false }});
}

/* ---------- SCATTER + HISTOS ---------- */
async function loadScatter(x, y) {
  const history = await IndoorAPI.fetchHistory(1800);
  const series = history.series;
  if (!series || series.length === 0) return;

  const points = series.map(d => ({ x: d.measures[x], y: d.measures[y] }));

  // Histogrammes
  const bins = 20;
  const xVals = points.map(p => p.x), yVals = points.map(p => p.y);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  const histX = new Array(bins).fill(0), histY = new Array(bins).fill(0);

  xVals.forEach(v => histX[Math.floor(((v - xMin)/(xMax - xMin))*(bins-1))]++);
  yVals.forEach(v => histY[Math.floor(((v - yMin)/(yMax - yMin))*(bins-1))]++);

  // Détruire charts existants
  [scatterChart, histXChart, histYChart].forEach(c => c && c.destroy());

  // Scatter
  scatterChart = new Chart(document.getElementById("gasesScatter"), {
    type: "scatter",
    data: { datasets: [{ label: `${x} vs ${y}`, data: points, pointRadius: 4, backgroundColor: "#3B82F6" }] },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: x.toUpperCase() } }, y: { title: { display: true, text: y.toUpperCase() } } } }
  });

  // Histogrammes
  histXChart = new Chart(document.getElementById("histX"), {
    type: "bar",
    data: { labels: Array.from({length: bins}, (_, i) => (xMin + i*(xMax-xMin)/bins).toFixed(2)), datasets: [{ data: histX, backgroundColor: "#3B82F6" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });
  histYChart = new Chart(document.getElementById("histY"), {
    type: "bar",
    indexAxis: 'y',
    data: { labels: Array.from({length: bins}, (_, i) => (yMin + i*(yMax-yMin)/bins).toFixed(2)), datasets: [{ data: histY, backgroundColor: "#ef4444" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
  });

  updateScatterDetails(x, y, series);
}

/* ---------- STATS ---------- */
function updateScatterDetails(x, y, series) {
  const valsX = series.map(s => s.measures[x]);
  const valsY = series.map(s => s.measures[y]);
  const r = computeCorrelation(valsX, valsY);
  document.getElementById("scatterDetails").innerHTML = `
    <strong>Stats :</strong><br>
    n=${series.length} points<br>
    Corrélation r=${r.toFixed(3)}<br>
    ${x}: min ${Math.min(...valsX).toFixed(2)} / max ${Math.max(...valsX).toFixed(2)}<br>
    ${y}: min ${Math.min(...valsY).toFixed(2)} / max ${Math.max(...valsY).toFixed(2)}
  `;
}

function computeCorrelation(a,b) {
  const n=a.length; if(n<2) return 0;
  const ma=a.reduce((s,x)=>s+x,0)/n;
  const mb=b.reduce((s,x)=>s+x,0)/n;
  let num=0,da2=0,db2=0;
  for(let i=0;i<n;i++){const da=a[i]-ma,db=b[i]-mb;num+=da*db;da2+=da*da;db2+=db*db;}
  const den=Math.sqrt(da2*db2); return den===0?0:num/den;
}

/* ---------- SETUP SELECT ---------- */
function setupScatterSelector() {
  const xSelect = document.getElementById("scatterX");
  const ySelect = document.getElementById("scatterY");
  const btn = document.getElementById("btn-update-scatter");
  if(!xSelect || !ySelect || !btn) return;

  const reload = () => loadScatter(xSelect.value, ySelect.value);
  xSelect.addEventListener("change", reload);
  ySelect.addEventListener("change", reload);
  btn.addEventListener("click", reload);
}

/* ---------- START ---------- */
window.addEventListener("load", async () => {
  setupScatterSelector();
  await loadCharts();
  await loadScatter(
    new URLSearchParams(window.location.search).get("x") || "co2",
    new URLSearchParams(window.location.search).get("y") || "co"
  );
});

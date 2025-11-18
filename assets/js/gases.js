/* -------------------------------------------------------
   PALETTE DE COULEURS COHÉRENTE
---------------------------------------------------------*/
const GAS_COLORS = {
  co:  "#e74c3c",
  co2: "#3498db",
  no2: "#f1c40f",
  nh3: "#2ecc71",
  temp: "#e67e22",
  rh:  "#1abc9c",
  pres:"#9b59b6"
};

/* -------------------------------------------------------
   UTILITAIRES COULEURS
---------------------------------------------------------*/
function mixColors(hexA, hexB, ratio = 0.5) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const r = ((a >> 16) * ratio + (b >> 16) * (1 - ratio)) | 0;
  const g = (((a >> 8) & 255) * ratio + ((b >> 8) & 255) * (1 - ratio)) | 0;
  const b2 = ((a & 255) * ratio + (b & 255) * (1 - ratio)) | 0;
  return `rgb(${r},${g},${b2})`;
}

function lighten(color, amount) {
  const c = color.match(/\d+/g).map(Number);
  return `rgb(${Math.min(255, c[0]+amount)},${Math.min(255, c[1]+amount)},${Math.min(255, c[2]+amount)})`;
}

function localDensity(points, index, radius = 0.8) {
  let count = 0;
  const p = points[index];
  for (let i = 0; i < points.length; i++) {
    if (i === index) continue;
    const dx = p.x - points[i].x;
    const dy = p.y - points[i].y;
    if (dx*dx + dy*dy < radius*radius) count++;
  }
  return count;
}

/* -------------------------------------------------------
   LINE CHARTS DES 4 GAZ
---------------------------------------------------------*/
async function loadCharts() {
  const history = await IndoorAPI.fetchHistory(3600);
  const data = history.series;
  if (!data || data.length === 0) return;

  const labels = data.map(d => d.timestamp);
  makeLineChart("coChart", labels, data.map(d => d.measures.co), "co");
  makeLineChart("co2Chart", labels, data.map(d => d.measures.co2), "co2");
  makeLineChart("no2Chart", labels, data.map(d => d.measures.no2), "no2");
  makeLineChart("nh3Chart", labels, data.map(d => d.measures.nh3), "nh3");
}

function makeLineChart(canvasId, labels, values, key) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: key.toUpperCase(),
        data: values,
        borderWidth: 2,
        fill: false,
        borderColor: GAS_COLORS[key],
        backgroundColor: GAS_COLORS[key]+"55",
        tension: 0.15
      }]
    },
    options: { responsive:true, maintainAspectRatio:false }
  });
}

/* -------------------------------------------------------
   SCATTER + HISTOGRAMMES + LIGNES SURVOLE
---------------------------------------------------------*/
let scatterChart = null;
let histXChart = null;
let histYChart = null;

// Plugin Chart.js pour lignes de survol
const hoverLinesPlugin = {
  id: 'hoverLines',
  afterDraw: chart => {
    if(chart.tooltip?._active && chart.tooltip._active.length){
      const ctx = chart.ctx;
      const x = chart.tooltip._active[0].element.x;
      const y = chart.tooltip._active[0].element.y;
      ctx.save();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, chart.chartArea.top);
      ctx.lineTo(x, chart.chartArea.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(chart.chartArea.left, y);
      ctx.lineTo(chart.chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    }
  }
};

async function loadScatterFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const xVar = params.get("x") || "co2";
  const yVar = params.get("y") || "co";

  // --- Synchronisation des select avec URL (relations page) ---
  const selectX = document.getElementById("select-x");
  const selectY = document.getElementById("select-y");
  if(selectX) selectX.value = xVar;
  if(selectY) selectY.value = yVar;

  document.getElementById("scatterTitle").textContent =
    `Scatter : ${xVar.toUpperCase()} vs ${yVar.toUpperCase()}`;

  const history = await IndoorAPI.fetchHistory(1800);
  const data = history.series;
  if (!data || data.length === 0) return;

  const points = data.map(d => ({
    x: d.measures[xVar],
    y: d.measures[yVar]
  }));

  if (scatterChart) scatterChart.destroy();
  if (histXChart) histXChart.destroy();
  if (histYChart) histYChart.destroy();

  const backgroundColors = points.map((p,i) => {
    const t = i / points.length;
    const density = localDensity(points, i);
    const mixRatio = Math.min(0.9, Math.max(0.1, t + density*0.02));
    const baseColor = mixColors(GAS_COLORS[xVar], GAS_COLORS[yVar], mixRatio);
    const bright = Math.min(50, density*5);
    return lighten(baseColor, bright);
  });

  scatterChart = new Chart(document.getElementById("gasesScatter"), {
    type: "scatter",
    data: {
      datasets: [{
        label: `${xVar.toUpperCase()} / ${yVar.toUpperCase()}`,
        data: points,
        pointRadius: 4,
        backgroundColor: backgroundColors,
        borderColor: backgroundColors,
        borderWidth: 0.6,
        parsing: false
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      scales: {
        x: { title: { display:true, text:xVar.toUpperCase() } },
        y: { title: { display:true, text:yVar.toUpperCase() } }
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            generateLabels: chart => [
              {
                text: xVar.toUpperCase(),
                fillStyle: GAS_COLORS[xVar],
                strokeStyle: GAS_COLORS[xVar],
                lineWidth: 2,
                hidden: false,
                index: 0
              },
              {
                text: yVar.toUpperCase(),
                fillStyle: GAS_COLORS[yVar],
                strokeStyle: GAS_COLORS[yVar],
                lineWidth: 2,
                hidden: false,
                index: 1
              }
            ]
          }
        },
        tooltip: {
          mode:'nearest',
          intersect:false,
          callbacks: {
            label: item => `${xVar}: ${item.raw?.x}, ${yVar}: ${item.raw?.y}`
          }
        },
        hoverLines: {}
      },
      interaction: { mode:'nearest', intersect:false }
    },
    plugins: [hoverLinesPlugin]
  });

  // Histogrammes
  const bins = 20;
  const xValues = points.map(p=>p.x);
  const yValues = points.map(p=>p.y);
  const xMin = Math.min(...xValues), xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues), yMax = Math.max(...yValues);
  const histX = new Array(bins).fill(0);
  const histY = new Array(bins).fill(0);
  xValues.forEach(v => { const idx=Math.floor(((v-xMin)/(xMax-xMin))*(bins-1)); histX[idx]++; });
  yValues.forEach(v => { const idx=Math.floor(((v-yMin)/(yMax-yMin))*(bins-1)); histY[idx]++; });

  histXChart = new Chart(document.getElementById("histX"), {
    type:"bar",
    data:{
      labels:Array.from({length:bins},(_,i)=>(xMin + i*(xMax-xMin)/bins).toFixed(2)),
      datasets:[{data:histX, backgroundColor:GAS_COLORS[xVar]+"55", borderColor:GAS_COLORS[xVar]}]
    },
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}}
  });

  histYChart = new Chart(document.getElementById("histY"), {
    type:"bar",
    indexAxis:"y",
    data:{
      labels:Array.from({length:bins},(_,i)=>(yMin + i*(yMax-yMin)/bins).toFixed(2)),
      datasets:[{data:histY, backgroundColor:GAS_COLORS[yVar]+"55", borderColor:GAS_COLORS[yVar]}]
    },
    options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}}
  });

  updateScatterDetails(xVar, yVar, data);
}

/* -------------------------------------------------------
   STATISTIQUES DU SCATTER
---------------------------------------------------------*/
function updateScatterDetails(xvar,yvar,series){
  const valuesX = series.map(s=>s.measures[xvar]);
  const valuesY = series.map(s=>s.measures[yvar]);
  const minX = Math.min(...valuesX), maxX=Math.max(...valuesX);
  const minY = Math.min(...valuesY), maxY=Math.max(...valuesY);
  const r = computeCorrelation(valuesX,valuesY);
  document.getElementById("scatterDetails").innerHTML=`
    <strong>Statistiques :</strong><br>
    n = ${series.length} points<br>
    Corrélation r = <strong>${r.toFixed(3)}</strong><br>
    ${xvar}: min ${minX.toFixed(2)} / max ${maxX.toFixed(2)}<br>
    ${yvar}: min ${minY.toFixed(2)} / max ${maxY.toFixed(2)}
  `;
}

/* -------------------------------------------------------
   CORRÉLATION (Pearson)
---------------------------------------------------------*/
function computeCorrelation(a,b){
  const n=a.length;
  if(n<2) return 0;
  const ma=a.reduce((s,x)=>s+x,0)/n;
  const mb=b.reduce((s,x)=>s+x,0)/n;
  let num=0,da2=0,db2=0;
  for(let i=0;i<n;i++){
    const da=a[i]-ma, db=b[i]-mb;
    num+=da*db; da2+=da*da; db2+=db*db;
  }
  const den=Math.sqrt(da2*db2);
  return den===0?0:num/den;
}

/* -------------------------------------------------------
   MISE À JOUR AUTOMATIQUE SUR CHANGEMENT DE SELECT
---------------------------------------------------------*/
function attachAutoUpdate() {
  const selectX = document.getElementById("select-x");
  const selectY = document.getElementById("select-y");
  [selectX, selectY].forEach(sel => {
    sel.addEventListener("change", async () => {
      const params = new URLSearchParams(window.location.search);
      params.set("x", selectX.value);
      params.set("y", selectY.value);
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
      await loadScatterFromQuery();
    });
  });
}

/* -------------------------------------------------------
   START
---------------------------------------------------------*/
window.addEventListener("load", async ()=>{
  await loadCharts();
  await loadScatterFromQuery();
  attachAutoUpdate(); // activation du rafraîchissement automatique
});

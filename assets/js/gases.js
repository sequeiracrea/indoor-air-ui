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
   UTILITAIRES
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
   CHARTS LIGNES
---------------------------------------------------------*/
async function loadCharts() {
  const history = await IndoorAPI.fetchHistory(3600);
  const data = history.series;
  if (!data || data.length === 0) return;
  const labels = data.map(d => d.timestamp);

  ["co","co2","no2","nh3"].forEach(key => {
    makeLineChart(`${key}Chart`, labels, data.map(d => d.measures[key]), key);
  });
}

function makeLineChart(canvasId, labels, values, key){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  new Chart(canvas,{
    type:"line",
    data:{labels,datasets:[{
      label:key.toUpperCase(),
      data:values,
      borderWidth:2,
      fill:false,
      borderColor:GAS_COLORS[key],
      backgroundColor:GAS_COLORS[key]+"55",
      tension:0.15
    }]},
    options:{responsive:true,maintainAspectRatio:false}
  });
}

/* -------------------------------------------------------
   SCATTER AVANCE + LEGENDE + CROSSHAIRS + HISTO INSTANT
---------------------------------------------------------*/
let scatterChart = null;
let histXChart = null;
let histYChart = null;

async function loadScatterFromQuery(){
  const params = new URLSearchParams(window.location.search);
  const xVar = params.get("x") || "co2";
  const yVar = params.get("y") || "co";

  document.getElementById("scatterTitle").textContent = `Scatter : ${xVar.toUpperCase()} vs ${yVar.toUpperCase()}`;

  const history = await IndoorAPI.fetchHistory(1800);
  const data = history.series;
  if(!data || data.length === 0) return;

  const points = data.map((d,i)=>({
    x:d.measures[xVar],
    y:d.measures[yVar],
    t:d.timestamp,
    i
  }));

  if(scatterChart) scatterChart.destroy();
  if(histXChart) histXChart.destroy();
  if(histYChart) histYChart.destroy();

  // Couleur : fusion X/Y + timeline + densité
  const smartPoints = points.map(p=>{
    const t = p.i/points.length;
    const density = localDensity(points,p.i);
    const mixRatio = Math.min(0.9, Math.max(0.1, t + density*0.02));
    const baseColor = mixColors(GAS_COLORS[xVar], GAS_COLORS[yVar], mixRatio);
    const bright = Math.min(60,density*5);
    return {
      x:p.x,
      y:p.y,
      backgroundColor: lighten(baseColor,bright),
      borderColor: lighten(baseColor,bright),
      borderWidth:0.6,
      timestamp:p.t,
      density
    };
  });

  scatterChart = new Chart(document.getElementById("gasesScatter"),{
    type:"scatter",
    data:{datasets:[{label:`${xVar.toUpperCase()} vs ${yVar.toUpperCase()}`, data:smartPoints, pointRadius:5, parsing:false}]},
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{title:{display:true,text:xVar.toUpperCase()}},
        y:{title:{display:true,text:yVar.toUpperCase()}}
      },
      plugins:{
        tooltip:{
          callbacks:{
            label:ctx=>{
              const d = ctx.raw;
              return `${xVar}: ${d.x}, ${yVar}: ${d.y}, densité: ${d.density}, t: ${new Date(d.timestamp*1000).toLocaleTimeString()}`;
            }
          }
        }
      },
      interaction:{mode:'nearest', intersect:false},
      onHover:(event)=>{
        const pos = Chart.helpers.getRelativePosition(event, scatterChart);
        const xVal = scatterChart.scales.x.getValueForPixel(pos.x).toFixed(2);
        const yVal = scatterChart.scales.y.getValueForPixel(pos.y).toFixed(2);
        document.getElementById("scatterDetails").innerHTML = `${xVar}: ${xVal} | ${yVar}: ${yVal} | n points: ${data.length}`;
      }
    },
    plugins:[{
      afterDraw:chart=>{
        if(chart._active && chart._active.length){
          const ctx = chart.ctx;
          ctx.save();
          ctx.strokeStyle='rgba(0,0,0,0.2)';
          ctx.lineWidth=1;
          const {x,y} = chart._active[0].element;
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,chart.height); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(chart.width,y); ctx.stroke();
          ctx.restore();
        }
      }
    }]
  });

  updateScatterLegend(xVar,yVar);
  createHistograms(points,xVar,yVar);
  updateScatterStats(xVar,yVar,data);
}

/* -------------------------------------------------------
   LEGEND
---------------------------------------------------------*/
function updateScatterLegend(xVar,yVar){
  let legendEl = document.getElementById("scatterLegend");
  if(!legendEl){
    legendEl = document.createElement("div");
    legendEl.id="scatterLegend";
    legendEl.style.marginTop="8px";
    legendEl.style.fontSize="0.9em";
    document.getElementById("gasesScatter").parentElement.appendChild(legendEl);
  }
  legendEl.innerHTML = `
    <span style="display:inline-block;width:14px;height:14px;background:${GAS_COLORS[xVar]};margin-right:4px;"></span> ${xVar.toUpperCase()}
    <span style="display:inline-block;width:14px;height:14px;background:${GAS_COLORS[yVar]};margin:0 4px 0 12px;"></span> ${yVar.toUpperCase()}
  `;
}

/* -------------------------------------------------------
   HISTOGRAMMES
---------------------------------------------------------*/
function createHistograms(points,xVar,yVar){
  const bins=20;
  const xValues = points.map(p=>p.x);
  const yValues = points.map(p=>p.y);
  const xMin=Math.min(...xValues), xMax=Math.max(...xValues);
  const yMin=Math.min(...yValues), yMax=Math.max(...yValues);
  const histX=new Array(bins).fill(0);
  const histY=new Array(bins).fill(0);

  xValues.forEach(v=>{ const idx=Math.floor(((v-xMin)/(xMax-xMin))*(bins-1)); histX[idx]++; });
  yValues.forEach(v=>{ const idx=Math.floor(((v-yMin)/(yMax-yMin))*(bins-1)); histY[idx]++; });

  histXChart = new Chart(document.getElementById("histX"),{
    type:"bar",
    data:{
      labels:Array.from({length:bins},(_,i)=>(xMin + i*(xMax-xMin)/bins).toFixed(2)),
      datasets:[{data:histX,backgroundColor:GAS_COLORS[xVar]+"55",borderColor:GAS_COLORS[xVar]}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });

  histYChart = new Chart(document.getElementById("histY"),{
    type:"bar",
    indexAxis:"y",
    data:{
      labels:Array.from({length:bins},(_,i)=>(yMin + i*(yMax-yMin)/bins).toFixed(2)),
      datasets:[{data:histY,backgroundColor:GAS_COLORS[yVar]+"55",borderColor:GAS_COLORS[yVar]}]
    },
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}
  });
}

/* -------------------------------------------------------
   STATS
---------------------------------------------------------*/
function updateScatterStats(xvar,yvar,series){
  const valuesX = series.map(s=>s.measures[xvar]);
  const valuesY = series.map(s=>s.measures[yvar]);
  const minX=Math.min(...valuesX), maxX=Math.max(...valuesX);
  const minY=Math.min(...valuesY), maxY=Math.max(...valuesY);
  const r = computeCorrelation(valuesX,valuesY);
  document.getElementById("scatterDetails").innerHTML=`<strong>Stats :</strong><br>
    n = ${series.length}<br>
    Corr r = <strong>${r.toFixed(3)}</strong><br>
    ${xvar}: min ${minX.toFixed(2)} / max ${maxX.toFixed(2)}<br>
    ${yvar}: min ${minY.toFixed(2)} / max ${maxY.toFixed(2)}
  `;
}

/* -------------------------------------------------------
   CORRELATION (Pearson)
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
   REFRESH
---------------------------------------------------------*/
async function refreshScatterFromSelectors(){
  const x=document.getElementById("select-x").value;
  const y=document.getElementById("select-y").value;
  const params=new URLSearchParams(window.location.search);
  params.set("x",x); params.set("y",y);
  window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  await loadScatterFromQuery();
}

/* -------------------------------------------------------
   START
---------------------------------------------------------*/
window.addEventListener("load",async()=>{
  await loadCharts();
  await loadScatterFromQuery();
  document.getElementById("btn-update-scatter").addEventListener("click",refreshScatterFromSelectors);
});

/* assets/js/events.js */

const STABILITY_COLORS = { stable:"rgba(0,200,0,0.15)", alert:"rgba(255,165,0,0.15)", unstable:"rgba(255,0,0,0.15)" };
const POINT_COLORS = { stable:"green", alert:"orange", unstable:"red" };

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// ------------------- Fonctions utilitaires -------------------

// Filtrer points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  if(!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// Dessin fond “nucléide” en 4 zones diagonales
function drawBackground(ctx, chart){
  const {left, right, top, bottom} = chart.chartArea;
  const width = right-left;
  const height = bottom-top;
  
  ctx.save();
  // zone stable
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left + width*0.5, top);
  ctx.lineTo(left, top + height*0.5);
  ctx.closePath();
  ctx.fill();

  // zone alert
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.beginPath();
  ctx.moveTo(left + width*0.5, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, top + height*0.5);
  ctx.closePath();
  ctx.fill();

  // zone alert bas gauche
  ctx.beginPath();
  ctx.moveTo(left, top + height*0.5);
  ctx.lineTo(left + width*0.5, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fill();

  // zone unstable
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.beginPath();
  ctx.moveTo(left + width*0.5, bottom);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right, top + height*0.5);
  ctx.closePath();
  ctx.fill();
  
  ctx.restore();
}

// ------------------- Chargement données -------------------

async function loadFramesFromHistory(sec=1800){
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if(!history || !history.series || !history.series.length) return [];

    return history.series.map(entry=>{
      const idx = entry.indices || {};
      const { GAQI=0, GEI=0, SRI=0, TCI=0 } = idx;
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI };
    });

  } catch(err){
    console.error("Erreur historique :", err);
    return [];
  }
}

// ------------------- Chart -------------------

function renderChart(points){
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(!ctx) return;

  if(stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type:'scatter',
    data:{
      datasets:[{
        label:'État environnemental',
        data:points.map(p=>({x:p.x, y:p.y, extra:p})),
        pointBackgroundColor:points.map(p=>{
          const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
          if(score>0.75) return POINT_COLORS.unstable;
          if(score>0.5) return POINT_COLORS.alert;
          return POINT_COLORS.stable;
        }),
        pointRadius: points.map((p,i)=> 3 + 3*(i/points.length)), // points récents plus gros
        pointHoverRadius:10
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{ min:0, max:100, title:{display:true,text:"GAQI"} },
        y:{ min:0, max:100, title:{display:true,text:"GEI"} }
      },
      plugins:{
        tooltip:{
          callbacks:{
            label:ctx=>{
              const p = ctx.raw.extra;
              return `GAQI:${p.x.toFixed(1)}, GEI:${p.y.toFixed(1)}, SRI:${p.sri.toFixed(1)}, TCI:${p.tci.toFixed(1)}`;
            }
          }
        },
        legend:{ display:false }
      }
    },
    plugins:[{
      id:'backgroundPlugin',
      beforeDraw:chart=>drawBackground(chart.ctx, chart)
    }]
  });
}

// ------------------- Animation -------------------

function nextFrame(){
  if(!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const framePoints = filterPoints([allFrames[currentFrame]], tciMin, tciMax, sriMin, sriMax);
  renderChart(framePoints);

  currentFrame = (currentFrame+1) % allFrames.length;
  if(animating) animationId = requestAnimationFrame(nextFrame);
}

// ------------------- Play / Pause -------------------

function toggleAnimation(){
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// ------------------- Filtrage manuel -------------------

function applyFilters(){
  currentFrame = 0;
  nextFrame();
}

// ------------------- Légende -------------------

function renderLegend(){
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="color:green">●</span> Stable<br>
    <span style="color:orange">●</span> Alerte<br>
    <span style="color:red">●</span> Instable<br>
    Fond : couleur = état attendu<br>
    Points : dernières mesures récentes plus grosses
  `;
}

// ------------------- Init -------------------

async function init(){
  allFrames = await loadFramesFromHistory(1800);
  if(!allFrames.length) return;

  // boutons / slider
  document.getElementById("applyFilters").addEventListener("click", applyFilters);
  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);

  renderLegend();

  nextFrame(); // affichage premier frame
}

window.addEventListener("load", init);

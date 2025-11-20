const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.2)",
  alert: "rgba(255,165,0,0.2)",
  unstable: "rgba(255,0,0,0.2)",
  critical: "rgba(255,255,0,0.2)"
};
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red", critical: "yellow" };

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

const TRAIL_LENGTH = 60; // nombre de points dans la traînée
const MICRO_POINTS = 30; // points statiques pour densité

// Charger les frames depuis l'historique
async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series || !history.series.length) return [];

    // Convertir l'historique en frames GAQI/GEI/SRI/TCI
    const frames = history.series.map(entry => {
      const idx = entry.indices || {};
      const { GAQI = 0, GEI = 0, SRI = 0, TCI = 0 } = idx;
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI };
    });

    return frames;
  } catch (err) {
    console.error("Erreur historique :", err);
    return [];
  }
}

// Dessiner les zones diagonales “nucléides”
function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const w = right - left;
  const h = bottom - top;

  ctx.save();
  // diagonale 1 : vert
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top);
  ctx.lineTo(right, top);
  ctx.fill();

  // diagonale 2 : orange
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right, top);
  ctx.fill();

  // diagonale 3 : rouge
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(left, top);
  ctx.lineTo(right, bottom);
  ctx.fill();

  ctx.restore();
}

// Calculer la couleur selon score
function computePointColor(p) {
  const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
  if(score>0.75) return POINT_COLORS.unstable;
  else if(score>0.5) return POINT_COLORS.alert;
  else return POINT_COLORS.stable;
}

// Rendu Chart.js avec effet thermique
function renderChart(frames) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(!ctx) return;

  if(stabilityChart) {
    // Mettre à jour les données existantes au lieu de destroy/recreate
    stabilityChart.data.datasets[0].data = frames.map(p=>({x:p.x,y:p.y,extra:p}));
    stabilityChart.update('none');
    return;
  }

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Points",
        data: frames.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: frames.map(computePointColor),
        pointRadius: frames.map((_,i) => 2 + (i / frames.length)*8),
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      scales: {
        x: { min:0, max:100, title:{display:true,text:"GAQI"} },
        y: { min:0, max:100, title:{display:true,text:"GEI"} }
      },
      plugins:{
        legend:{display:false},
        tooltip:{
          callbacks:{
            label:ctx=>{
              const p=ctx.raw.extra;
              return `GAQI:${p.x.toFixed(1)}, GEI:${p.y.toFixed(1)}, SRI:${p.sri.toFixed(1)}, TCI:${p.tci.toFixed(1)}`;
            }
          }
        }
      }
    },
    plugins:[{
      id:"backgroundPlugin",
      beforeDraw:chart=>drawBackground(chart.ctx, chart)
    }]
  });
}

// Générer le trail des derniers points
function getTrailPoints() {
  if(currentFrame<TRAIL_LENGTH) return allFrames.slice(0,currentFrame+1);
  return allFrames.slice(currentFrame-TRAIL_LENGTH+1,currentFrame+1);
}

// Animation frame
function nextFrame() {
  if(!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const trail = filterPoints(getTrailPoints(), tciMin,tciMax,sriMin,sriMax);
  renderChart(trail);

  currentFrame = (currentFrame+1)%allFrames.length;
  if(animating) animationId=requestAnimationFrame(nextFrame);
}

// Play/Pause
function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating?"Pause":"Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// Filtre manuel
function applyFilters() {
  currentFrame=0;
  nextFrame();
}

// Initialisation
async function init() {
  allFrames = await loadFramesFromHistory(1800);
  if(!allFrames.length) return;

  document.getElementById("applyFilters").addEventListener("click",applyFilters);
  document.getElementById("playPauseBtn").addEventListener("click",toggleAnimation);

  const timeline = document.getElementById("timeline");
  timeline.max = allFrames.length-1;
  timeline.addEventListener("input",e=>{
    currentFrame=parseInt(e.target.value,10);
    const trail = filterPoints(getTrailPoints(),0,100,0,100);
    renderChart(trail);
  });

  nextFrame();
  document.getElementById("stabilityLegend").innerHTML=`
    <strong>Légende :</strong><br>
    Fond vert : stable<br>
    Fond orange : alerte<br>
    Fond rouge : instable<br>
    Points récents : plus gros et saturés<br>
    Points anciens : plus petits et transparents<br>
    Tooltip : GAQI / GEI / SRI / TCI
  `;
}

window.addEventListener("load",init);

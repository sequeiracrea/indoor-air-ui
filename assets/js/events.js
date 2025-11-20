/* assets/js/events.js */
const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Paramètres
const MICRO_POINTS = 30;  // Option micro-points (statique)
const TRAIL = 60;         // Nombre de points dans le trail

// --- Chargement des frames depuis l'historique ---
async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series || !history.series.length) return [];

    // Générer les frames sécurisées
    return history.series.map(entry => {
      const idx = entry.indices || {};
      const { GAQI = 0, GEI = 0, SRI = 0, TCI = 0 } = idx;
      let score = Math.sqrt((GAQI/100)**2 + (GEI/100)**2 + (SRI/100)**2 + (TCI/100)**2);
      let status = "stable";
      if(score > 0.75) status = "unstable";
      else if(score > 0.5) status = "alert";
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI, score, status };
    });
  } catch(err) {
    console.error("Erreur historique :", err);
    return [];
  }
}

// --- Filtrage points selon TCI/SRI ---
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// --- Fond type nucléide ---
function drawBackground(ctx, chart){
  const { left, right, top, bottom } = chart.chartArea;
  const width = right-left;
  const height = bottom-top;

  ctx.save();
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, width*0.5, height*0.5);
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left+width*0.5, top, width*0.5, height*0.5);
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top+height*0.5, width, height*0.5);
  ctx.restore();
}

// --- Rendu chart ---
function renderChart(points, trailPoints=[], microPoints=[]){
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if(stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets:[
        // Trail
        {
          label:"Trail",
          data: trailPoints.map((p,i)=>({x:p.x, y:p.y, extra:p})),
          pointBackgroundColor: trailPoints.map(p=>POINT_COLORS[p.status]),
          pointRadius: trailPoints.map((p,i)=>6 + i/trailPoints.length*6),
          pointHoverRadius: 12
        },
        // MicroPoints (optionnels)
        {
          label:"MicroPoints",
          data: microPoints.map(p=>({x:p.x, y:p.y, extra:p})),
          pointBackgroundColor: microPoints.map(p=>POINT_COLORS[p.status]),
          pointRadius: 3,
          pointHoverRadius: 8
        }
      ]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{min:0,max:100,title:{display:true,text:"GAQI"}},
        y:{min:0,max:100,title:{display:true,text:"GEI"}}
      },
      plugins:{
        tooltip:{
          callbacks:{
            label:ctx=>{
              const p = ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, État: ${p.status}`;
            }
          }
        },
        legend:{display:false}
      }
    },
    plugins:[{
      id:"backgroundPlugin",
      beforeDraw: chart=>drawBackground(chart.ctx, chart)
    }]
  });
}

// --- Animation ---
function nextFrame(){
  if(!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  // Construction du trail
  let trailPoints = [];
  for(let i=TRAIL-1;i>=0;i--){
    let idx = (currentFrame - i + allFrames.length) % allFrames.length;
    trailPoints.push(allFrames[idx]);
  }

  // MicroPoints statiques (les N plus anciens)
  let microPoints = [];
  if(MICRO_POINTS>0){
    for(let i=MICRO_POINTS;i>=0;i--){
      let idx = (currentFrame - TRAIL - i + allFrames.length) % allFrames.length;
      if(idx>=0 && idx<allFrames.length) microPoints.push(allFrames[idx]);
    }
  }

  const filteredTrail = filterPoints(trailPoints,tciMin,tciMax,sriMin,sriMax);
  const filteredMicro = filterPoints(microPoints,tciMin,tciMax,sriMin,sriMax);

  renderChart([],filteredTrail,filteredMicro);

  currentFrame = (currentFrame+1)%allFrames.length;
  if(animating) animationId = requestAnimationFrame(nextFrame);
}

// --- Play / Pause ---
function toggleAnimation(){
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// --- Application filtres manuels ---
function applyFilters(){
  currentFrame=0;
  nextFrame();
}

// --- Légende dynamique ---
function updateLegend(){
  const legendDiv = document.getElementById("stabilityLegend");
  legendDiv.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="display:inline-block;width:15px;height:15px;background-color:rgba(0,200,0,0.15);margin-right:5px;"></span> Zone stable<br>
    <span style="display:inline-block;width:15px;height:15px;background-color:rgba(255,165,0,0.15);margin-right:5px;"></span> Zone alerte<br>
    <span style="display:inline-block;width:15px;height:15px;background-color:rgba(255,0,0,0.15);margin-right:5px;"></span> Zone instable<br>
    <span style="display:inline-block;width:12px;height:12px;background-color:green;border-radius:50%;margin-right:5px;"></span> Point récent stable<br>
    <span style="display:inline-block;width:8px;height:8px;background-color:green;border-radius:50%;margin-right:5px;"></span> Point ancien stable<br>
    <span style="display:inline-block;width:12px;height:12px;background-color:orange;border-radius:50%;margin-right:5px;"></span> Point récent alerte<br>
    <span style="display:inline-block;width:8px;height:8px;background-color:orange;border-radius:50%;margin-right:5px;"></span> Point ancien alerte<br>
    <span style="display:inline-block;width:12px;height:12px;background-color:red;border-radius:50%;margin-right:5px;"></span> Point récent instable<br>
    <span style="display:inline-block;width:8px;height:8px;background-color:red;border-radius:50%;margin-right:5px;"></span> Point ancien instable<br>
  `;
}

// --- Initialisation ---
async function init(){
  allFrames = await loadFramesFromHistory(1800);
  if(!allFrames.length) return;

  // Ajouter boutons play/pause
  const btn = document.createElement("button");
  btn.id = "playPauseBtn";
  btn.textContent = "Play";
  btn.addEventListener("click",toggleAnimation);
  document.getElementById("filters").appendChild(btn);

  document.getElementById("applyFilters").addEventListener("click",applyFilters);

  updateLegend();
  nextFrame();
}

window.addEventListener("load",init);

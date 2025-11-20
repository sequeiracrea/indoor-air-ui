/* assets/js/events.js */
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };
const MICRO_POINTS = 30;  // points statiques mini
const TRAIL_LENGTH = 60;  // longueur du trail
const THERMAL_RADIUS = 50;
const THERMAL_DECAY = 0.95;

let canvas, ctx;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let displayedPoints = [];
let thermalMap;

async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series || !history.series.length) return [];
    // Sécuriser les indices
    return history.series.map(entry => {
      const idx = entry.indices || {};
      const { GAQI = 0, GEI = 0, SRI = 0, TCI = 0 } = idx;
      return { x: GAQI, y: GEI, sri: SRI, tci: TCI };
    });
  } catch (err) {
    console.error("Erreur historique :", err);
    return [];
  }
}

// Filtrer points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// Initialisation de la carte thermique
function initThermalMap(){
  thermalMap = ctx.createImageData(canvas.width, canvas.height);
  for(let i=0;i<thermalMap.data.length;i+=4){
    thermalMap.data[i+0] = 0; // R
    thermalMap.data[i+1] = 0; // G
    thermalMap.data[i+2] = 0; // B
    thermalMap.data[i+3] = 255; // alpha
  }
}

// Mise à jour de la carte thermique
function updateThermalMap(){
  const w = canvas.width;
  const h = canvas.height;

  // Décroissance
  for(let i=0;i<thermalMap.data.length;i+=4){
    thermalMap.data[i+0] *= THERMAL_DECAY;
    thermalMap.data[i+1] *= THERMAL_DECAY;
    thermalMap.data[i+2] *= THERMAL_DECAY;
  }

  displayedPoints.forEach(p=>{
    const px = Math.floor((p.x/100)*w);
    const py = Math.floor(h - (p.y/100)*h);

    for(let dx=-THERMAL_RADIUS;dx<=THERMAL_RADIUS;dx++){
      for(let dy=-THERMAL_RADIUS;dy<=THERMAL_RADIUS;dy++){
        const x = px+dx;
        const y = py+dy;
        if(x<0||x>=w||y<0||y>=h) continue;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist>THERMAL_RADIUS) continue;
        const idx = (y*w + x)*4;
        const intensity = (1 - dist/THERMAL_RADIUS)*0.5;
        thermalMap.data[idx+0] = Math.min(255, thermalMap.data[idx+0] + intensity*255);
        thermalMap.data[idx+1] = Math.min(255, thermalMap.data[idx+1] + intensity*100);
        thermalMap.data[idx+2] = Math.min(255, thermalMap.data[idx+2] + intensity*50);
      }
    }
  });
}

function drawThermalBackground(){
  ctx.putImageData(thermalMap,0,0);
}

// Dessiner les points et trail
function drawPoints(){
  const w = canvas.width;
  const h = canvas.height;

  // trail
  for(let i=0;i<displayedPoints.length;i++){
    const p = displayedPoints[i];
    const size = 2 + 4*((i+1)/displayedPoints.length); // récent = plus gros
    ctx.beginPath();
    ctx.arc((p.x/100)*w, h-(p.y/100)*h, size,0,2*Math.PI);
    const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
    if(score>0.75) ctx.fillStyle = POINT_COLORS.unstable;
    else if(score>0.5) ctx.fillStyle = POINT_COLORS.alert;
    else ctx.fillStyle = POINT_COLORS.stable;
    ctx.fill();
  }
}

// Mettre à jour le frame courant
function nextFrame(){
  if(!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const framePoints = filterPoints([allFrames[currentFrame]], tciMin, tciMax, sriMin, sriMax);
  
  displayedPoints.push(...framePoints);
  if(displayedPoints.length>TRAIL_LENGTH) displayedPoints = displayedPoints.slice(-TRAIL_LENGTH);

  ctx.clearRect(0,0,canvas.width,canvas.height);
  updateThermalMap();
  drawThermalBackground();
  drawPoints();

  document.getElementById("timeline").value = currentFrame;
  currentFrame = (currentFrame+1)%allFrames.length;
  if(animating) animationId = requestAnimationFrame(nextFrame);
}

// Play/Pause
function toggleAnimation(){
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// Application filtre manuel
function applyFilters(){
  displayedPoints = [];
  nextFrame();
}

// Initialisation
async function init(){
  canvas = document.getElementById("stabilityChart");
  if(!canvas) return console.error("Canvas introuvable");
  ctx = canvas.getContext("2d");
  initThermalMap();

  allFrames = await loadFramesFromHistory(1800);
  if(!allFrames.length) return console.warn("Aucune frame chargée");

  // timeline
  const slider = document.getElementById("timeline");
  slider.max = allFrames.length-1;
  slider.addEventListener("input", e=>{
    currentFrame = parseInt(e.target.value,10);
    displayedPoints = allFrames.slice(Math.max(0,currentFrame-TRAIL_LENGTH), currentFrame+1);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    updateThermalMap();
    drawThermalBackground();
    drawPoints();
  });

  // play/pause
  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Légende
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    - Fond thermique : zones actives en rouge, zones calmes en bleu/vert<br>
    - Points : micro-points récents plus gros, couleurs selon stabilité<br>
    - Stable : vert, Alerte : orange, Instable : rouge
  `;

  // premier affichage
  nextFrame();
}

window.addEventListener("load", init);

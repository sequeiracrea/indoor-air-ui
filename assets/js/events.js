/* assets/js/events.js */

// Couleurs des quadrants
const QUADRANT_COLORS = {
  Q1: [0, 255, 0],
  Q2: [0, 200, 255],
  Q3: [150, 0, 200],
  Q4: [255, 50, 50]
};

const MICRO_POINT_COUNT = 30;
const TRAIL_LENGTH = 60;
const HEAT_INTENSITY = 0.08; // intensité du halo thermique

let canvas, ctx;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let microPoints = [];

// Couleur dégradée selon quadrant et distance du centre
function getPointColor(x, y) {
  const cx = 50, cy = 50;
  let base;
  if (x >= cx && y >= cy) base = QUADRANT_COLORS.Q1;
  else if (x < cx && y >= cy) base = QUADRANT_COLORS.Q2;
  else if (x < cx && y < cy) base = QUADRANT_COLORS.Q3;
  else base = QUADRANT_COLORS.Q4;

  const dx = Math.abs(x - cx)/50;
  const dy = Math.abs(y - cy)/50;
  const intensity = Math.min(1, Math.sqrt(dx*dx + dy*dy));
  return `rgba(${Math.floor(base[0]*intensity)},${Math.floor(base[1]*intensity)},${Math.floor(base[2]*intensity)},0.6)`;
}

function generateMicroPoints() {
  microPoints = [];
  for(let i=0;i<MICRO_POINT_COUNT;i++){
    microPoints.push({x: Math.random()*100, y: Math.random()*100});
  }
}

// Charger historique
async function loadFrames(sec=1800){
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if(!history || !history.series) return [];
    return history.series.map(entry=>{
      const idx = entry.indices || {};
      const { GAQI=0, GEI=0, SRI=0, TCI=0 } = idx;
      return { x: GAQI, y: GEI, sri:SRI, tci:TCI };
    });
  } catch(err){
    console.error("Erreur historique :", err);
    return [];
  }
}

// Dessiner grille fine + axes
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle="#ccc";
  ctx.lineWidth=0.5;
  for(let i=0;i<=100;i+=10){
    ctx.beginPath();
    ctx.moveTo(i/100*canvas.width,0);
    ctx.lineTo(i/100*canvas.width,canvas.height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0,i/100*canvas.height);
    ctx.lineTo(canvas.width,i/100*canvas.height);
    ctx.stroke();
  }

  // axes centraux
  ctx.strokeStyle="#999";
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(canvas.width/2,0);
  ctx.lineTo(canvas.width/2,canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0,canvas.height/2);
  ctx.lineTo(canvas.width,canvas.height/2);
  ctx.stroke();
}

// Dessiner le fond thermique
function drawHeat(){
  const trailStart = Math.max(0, currentFrame-TRAIL_LENGTH);
  for(let f=trailStart; f<=currentFrame; f++){
    const pt = allFrames[f];
    if(!pt) continue;
    const px = pt.x/100*canvas.width;
    const py = canvas.height - pt.y/100*canvas.height;

    const alpha = HEAT_INTENSITY*(1 - (currentFrame-f)/TRAIL_LENGTH);
    const gradient = ctx.createRadialGradient(px, py, 0, px, py, 40);
    const color = getPointColor(pt.x, pt.y).replace("0.6", alpha.toFixed(2));
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(px-40, py-40, 80, 80);
  }
}

// Dessiner points + micro points
function drawPoints(){
  drawHeat();

  // Points récents
  const trailStart = Math.max(0, currentFrame-TRAIL_LENGTH);
  for(let f=trailStart; f<=currentFrame; f++){
    const pt = allFrames[f];
    if(!pt) continue;
    const px = pt.x/100*canvas.width;
    const py = canvas.height - pt.y/100*canvas.height;
    const radius = 2 + 4*((f-trailStart+1)/TRAIL_LENGTH);

    ctx.beginPath();
    ctx.fillStyle = getPointColor(pt.x, pt.y);
    ctx.arc(px, py, radius, 0, Math.PI*2);
    ctx.fill();
  }

  // Micro points
  microPoints.forEach(mp=>{
    const px = mp.x/100*canvas.width;
    const py = canvas.height - mp.y/100*canvas.height;
    ctx.beginPath();
    ctx.fillStyle="rgba(100,100,100,0.3)";
    ctx.arc(px, py, 2, 0, Math.PI*2);
    ctx.fill();
  });
}

// Frame suivante
function nextFrame(){
  if(!allFrames.length) return;
  drawGrid();
  drawPoints();
  currentFrame = (currentFrame+1)%allFrames.length;
  if(animating) animationId=requestAnimationFrame(nextFrame);
}

// Play / pause
function toggleAnimation(){
  animating=!animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause":"Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// Slider
function updateSlider(){
  const slider = document.getElementById("timeline");
  currentFrame = parseInt(slider.value) || 0;
  drawGrid();
  drawPoints();
}

// Init
async function init(){
  canvas = document.getElementById("stabilityChart");
  if(!canvas) return console.error("Canvas introuvable !");
  ctx = canvas.getContext("2d");

  generateMicroPoints();

  allFrames = await loadFrames(1800);
  if(!allFrames.length) return;

  const slider = document.getElementById("timeline");
  slider.max = allFrames.length-1;
  slider.addEventListener("input", updateSlider);

  const btn = document.getElementById("playPauseBtn");
  btn.addEventListener("click", toggleAnimation);

  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML=`
    <strong>Légende :</strong><br>
    - Points récents : gros et colorés selon quadrant<br>
    - Halo thermique : couleur selon quadrant, intensité du trail<br>
    - Micro points gris : statiques<br>
    - Grille et axes centraux pour repère des 4 zones
  `;

  drawGrid();
  drawPoints();
}

window.addEventListener("load", init);

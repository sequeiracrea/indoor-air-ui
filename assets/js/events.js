/* assets/js/events.js - Heatmap améliorée avec grille fine */

// Couleurs des quadrants
const QUADRANT_COLORS = {
  Q1: [0, 255, 0],
  Q2: [0, 200, 255],
  Q3: [150, 0, 200],
  Q4: [255, 50, 50]
};

const TRAIL_LENGTH = 60;       // Nombre de frames pour le halo
const HEAT_RADIUS = 40;        // Rayon du halo
const HEAT_INTENSITY = 0.08;   // Intensité du halo

let canvas, ctx;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Retourne couleur RGBA selon quadrant
function getPointColor(x, y, alpha=0.6) {
  const cx = 50, cy = 50;
  let base;
  if (x >= cx && y >= cy) base = QUADRANT_COLORS.Q1;
  else if (x < cx && y >= cy) base = QUADRANT_COLORS.Q2;
  else if (x < cx && y < cy) base = QUADRANT_COLORS.Q3;
  else base = QUADRANT_COLORS.Q4;

  const dx = Math.abs(x - cx)/50;
  const dy = Math.abs(y - cy)/50;
  const intensity = Math.min(1, Math.sqrt(dx*dx + dy*dy));
  return `rgba(${Math.floor(base[0]*intensity)},${Math.floor(base[1]*intensity)},${Math.floor(base[2]*intensity)},${alpha})`;
}

// Charger l’historique
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

// Grille fine + axes centraux
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  ctx.strokeStyle="#ddd";
  ctx.lineWidth=0.2;

  for(let i=0;i<=100;i+=2){  // grille très fine
    ctx.beginPath();
    ctx.moveTo(i/100*canvas.width,0);
    ctx.lineTo(i/100*canvas.width,canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0,i/100*canvas.height);
    ctx.lineTo(canvas.width,i/100*canvas.height);
    ctx.stroke();
  }

  // axes centraux plus visibles
  ctx.strokeStyle="#999";
  ctx.lineWidth=1;
  ctx.beginPath();
  ctx.moveTo(canvas.width/2,0);
  ctx.lineTo(canvas.width/2,canvas.height);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0,canvas.height/2);
  ctx.lineTo(canvas.width,canvas.height/2);
  ctx.stroke();
}

// Dessiner heatmap continue
function drawHeatmap(){
  const trailStart = Math.max(0, currentFrame-TRAIL_LENGTH);
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for(let f=trailStart; f<=currentFrame; f++){
    const pt = allFrames[f];
    if(!pt) continue;
    const px = Math.floor(pt.x/100*canvas.width);
    const py = Math.floor(canvas.height - pt.y/100*canvas.height);
    const color = QUADRANT_COLORS[
      (pt.x>=50 && pt.y>=50) ? "Q1" :
      (pt.x<50 && pt.y>=50) ? "Q2" :
      (pt.x<50 && pt.y<50) ? "Q3" :
      "Q4"
    ];

    for(let dx=-HEAT_RADIUS; dx<=HEAT_RADIUS; dx++){
      for(let dy=-HEAT_RADIUS; dy<=HEAT_RADIUS; dy++){
        const x = px+dx, y=py+dy;
        if(x<0||y<0||x>=canvas.width||y>=canvas.height) continue;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist>HEAT_RADIUS) continue;
        const idx = (y*canvas.width + x)*4;
        const alpha = HEAT_INTENSITY*(1-dist/HEAT_RADIUS)*(1 - (currentFrame-f)/TRAIL_LENGTH);
        data[idx] += color[0]*alpha;
        data[idx+1] += color[1]*alpha;
        data[idx+2] += color[2]*alpha;
        data[idx+3] = 255;
      }
    }
  }

  ctx.putImageData(imageData,0,0);
}

// Dessiner points récents plus gros
function drawPoints(){
  const trailStart = Math.max(0, currentFrame-TRAIL_LENGTH);
  for(let f=trailStart; f<=currentFrame; f++){
    const pt = allFrames[f];
    if(!pt) continue;
    const px = pt.x/100*canvas.width;
    const py = canvas.height - pt.y/100*canvas.height;
    const radius = 2 + 4*((f-trailStart+1)/TRAIL_LENGTH); // plus récent = plus gros

    ctx.beginPath();
    ctx.fillStyle = getPointColor(pt.x, pt.y);
    ctx.arc(px, py, radius, 0, Math.PI*2);
    ctx.fill();
  }
}

// Frame suivante
function nextFrame(){
  if(!allFrames.length) return;
  drawGrid();
  drawHeatmap();
  drawPoints();
  currentFrame = (currentFrame+1)%allFrames.length;
  if(animating) animationId=requestAnimationFrame(nextFrame);
}

// Play / Pause
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
  drawHeatmap();
  drawPoints();
}

// Initialisation
async function init(){
  canvas = document.getElementById("stabilityChart");
  if(!canvas) return console.error("Canvas introuvable !");
  ctx = canvas.getContext("2d");

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
    - Halo thermique : couleur et intensité selon zone<br>
    - Points récents : plus gros = plus récent<br>
    - Grille très fine + axes centraux pour repérer les 4 zones
  `;

  drawGrid();
  drawHeatmap();
  drawPoints();
}

window.addEventListener("load", init);

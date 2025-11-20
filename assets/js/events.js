/* assets/js/events.js */

// Couleurs des quadrants pour halo et trail
const QUADRANT_COLORS = {
  Q1: [0, 255, 0],   // Vert
  Q2: [0, 200, 255], // Bleu
  Q3: [150, 0, 200], // Violet
  Q4: [255, 50, 50]  // Rouge
};

const MICRO_POINT_COUNT = 30; // Points statiques
const TRAIL_LENGTH = 60;      // Nombre de frames de trail

let canvas, ctx;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let microPoints = [];

// Calcul couleur dégradée selon quadrant
function getPointColor(x, y) {
  const cx = 50, cy = 50; // centre
  let base;
  if (x >= cx && y >= cy) base = QUADRANT_COLORS.Q1;
  else if (x < cx && y >= cy) base = QUADRANT_COLORS.Q2;
  else if (x < cx && y < cy) base = QUADRANT_COLORS.Q3;
  else base = QUADRANT_COLORS.Q4;

  // Intensité selon distance du centre
  const dx = Math.abs(x - cx) / 50; // 0..1
  const dy = Math.abs(y - cy) / 50; // 0..1
  const intensity = Math.min(1, Math.sqrt(dx*dx + dy*dy));

  return `rgba(${Math.floor(base[0]*intensity)},${Math.floor(base[1]*intensity)},${Math.floor(base[2]*intensity)},0.6)`;
}

// Générer points micro statiques
function generateMicroPoints() {
  microPoints = [];
  for(let i=0;i<MICRO_POINT_COUNT;i++){
    microPoints.push({
      x: Math.random()*100,
      y: Math.random()*100
    });
  }
}

// Charger historique depuis l’API
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

// Dessiner grille et axes
function drawGrid(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 0.5;

  // lignes verticales
  for(let i=0;i<=100;i+=10){
    ctx.beginPath();
    ctx.moveTo(i/100*canvas.width,0);
    ctx.lineTo(i/100*canvas.width,canvas.height);
    ctx.stroke();
  }

  // lignes horizontales
  for(let i=0;i<=100;i+=10){
    ctx.beginPath();
    ctx.moveTo(0,i/100*canvas.height);
    ctx.lineTo(canvas.width,i/100*canvas.height);
    ctx.stroke();
  }

  // axes centraux
  ctx.strokeStyle = "#999";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(canvas.width/2,0);
  ctx.lineTo(canvas.width/2,canvas.height);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0,canvas.height/2);
  ctx.lineTo(canvas.width,canvas.height/2);
  ctx.stroke();
}

// Dessiner points et trails
function drawPoints(){
  const trailStart = Math.max(0, currentFrame-TRAIL_LENGTH);
  for(let f=trailStart; f<=currentFrame; f++){
    const pt = allFrames[f];
    if(!pt) continue;
    const alpha = 0.3*(1 - (currentFrame-f)/TRAIL_LENGTH); // plus ancien = plus transparent
    const color = getPointColor(pt.x, pt.y).replace("0.6",alpha.toFixed(2));

    const px = pt.x/100*canvas.width;
    const py = canvas.height - pt.y/100*canvas.height;

    // Trail cercle
    ctx.beginPath();
    ctx.fillStyle = color;
    const radius = 4 + 2*((f - trailStart +1)/TRAIL_LENGTH); // récent = plus gros
    ctx.arc(px, py, radius, 0, Math.PI*2);
    ctx.fill();
  }

  // micro points statiques
  microPoints.forEach(mp=>{
    const px = mp.x/100*canvas.width;
    const py = canvas.height - mp.y/100*canvas.height;
    ctx.beginPath();
    ctx.fillStyle = "rgba(100,100,100,0.3)";
    ctx.arc(px,py,2,0,Math.PI*2);
    ctx.fill();
  });
}

// Prochaine frame
function nextFrame(){
  if(!allFrames.length) return;
  drawGrid();
  drawPoints();
  currentFrame = (currentFrame + 1) % allFrames.length;
  if(animating) animationId = requestAnimationFrame(nextFrame);
}

// Play / Pause
function toggleAnimation(){
  animating = !animating;
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

  // micro points
  generateMicroPoints();

  // charger historique
  allFrames = await loadFrames(1800);
  if(!allFrames.length) return;

  // slider max
  const slider = document.getElementById("timeline");
  slider.max = allFrames.length-1;
  slider.addEventListener("input",updateSlider);

  // bouton play/pause
  const btn = document.getElementById("playPauseBtn");
  btn.addEventListener("click",toggleAnimation);

  // légende
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    - Quadrants verts / bleus / violets / rouges selon zone<br>
    - Halo : couleur évolutive selon zone et position<br>
    - Points récents plus gros, plus intenses<br>
    - Micro points gris : statiques<br>
    - Axe central pour repère des quadrants
  `;

  // affichage initial
  drawGrid();
  drawPoints();
}

window.addEventListener("load",init);

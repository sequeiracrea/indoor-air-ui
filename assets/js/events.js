/* assets/js/events.js - Heatmap améliorée style “Rainbow / Thermique” */

const TRAIL_LENGTH = 60;       
const HEAT_RADIUS = 40;        
const HEAT_INTENSITY = 0.08;   

let canvas, ctx;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Retourne couleur dégradée arc-en-ciel selon x,y (0-100)
function getRainbowColor(x, y, alpha=0.7) {
  // On combine x et y pour créer un angle
  const hue = (x + y) % 100 * 3.6; // 0-360°
  return `hsla(${hue}, 80%, 50%, ${alpha})`;
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

  for(let i=0;i<=100;i+=2){  
    ctx.beginPath();
    ctx.moveTo(i/100*canvas.width,0);
    ctx.lineTo(i/100*canvas.width,canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0,i/100*canvas.height);
    ctx.lineTo(canvas.width,i/100*canvas.height);
    ctx.stroke();
  }

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

    // Couleur selon position
    const color = getRainbowColor(pt.x, pt.y, 1.0);
    const [h,s,l,a] = color.match(/\d+\.?\d*/g).map(Number); // hsla -> array
    const rgb = hslToRgb(h,s/100,l/100);

    for(let dx=-HEAT_RADIUS; dx<=HEAT_RADIUS; dx++){
      for(let dy=-HEAT_RADIUS; dy<=HEAT_RADIUS; dy++){
        const x = px+dx, y = py+dy;
        if(x<0||y<0||x>=canvas.width||y>=canvas.height) continue;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if(dist>HEAT_RADIUS) continue;
        const idx = (y*canvas.width + x)*4;
        const alpha = HEAT_INTENSITY*(1-dist/HEAT_RADIUS)*(1 - (currentFrame-f)/TRAIL_LENGTH);
        data[idx] += rgb[0]*alpha;
        data[idx+1] += rgb[1]*alpha;
        data[idx+2] += rgb[2]*alpha;
        data[idx+3] = 255;
      }
    }
  }

  ctx.putImageData(imageData,0,0);
}

// Convert HSLA en RGB [0-255]
function hslToRgb(h, s, l){
  const c = (1 - Math.abs(2*l-1))*s;
  const x = c*(1-Math.abs((h/60)%2-1));
  const m = l-c/2;
  let r=0,g=0,b=0;
  if(h<60){ r=c; g=x; b=0; }
  else if(h<120){ r=x; g=c; b=0; }
  else if(h<180){ r=0; g=c; b=x; }
  else if(h<240){ r=0; g=x; b=c; }
  else if(h<300){ r=x; g=0; b=c; }
  else{ r=c; g=0; b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

// Dessiner points récents plus gros
function drawPoints(){
  const trailStart = Math.max(0, currentFrame-TRAIL_LENGTH);
  for(let f=trailStart; f<=currentFrame; f++){
    const pt = allFrames[f];
    if(!pt) continue;
    const px = pt.x/100*canvas.width;
    const py = canvas.height - pt.y/100*canvas.height;
    const radius = 2 + 4*((f-trailStart+1)/TRAIL_LENGTH);

    ctx.beginPath();
    ctx.fillStyle = getRainbowColor(pt.x, pt.y, 0.8);
    ctx.arc(px, py, radius, 0, Math.PI*2);
    ctx.fill();
  }
}

function nextFrame(){
  if(!allFrames.length) return;
  drawGrid();
  drawHeatmap();
  drawPoints();
  currentFrame = (currentFrame+1)%allFrames.length;
  if(animating) animationId=requestAnimationFrame(nextFrame);
}

function toggleAnimation(){
  animating=!animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause":"Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

function updateSlider(){
  const slider = document.getElementById("timeline");
  currentFrame = parseInt(slider.value) || 0;
  drawGrid();
  drawHeatmap();
  drawPoints();
}

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
    - Halo + points : couleur selon position (rainbow)<br>
    - Plus récent = plus gros<br>
    - Grille très fine + axes centraux pour repérer 4 zones
  `;

  drawGrid();
  drawHeatmap();
  drawPoints();
}

window.addEventListener("load", init);

let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let displayedPoints = [];
const TRAIL_LENGTH = 60;
const MICRO_POINTS = 30;

const canvas = document.getElementById("stabilityChart");
const ctx = canvas.getContext("2d");

// ------------------- Dégradé dynamique selon score -------------------
function computeAverageScore(points){
  if(!points.length) return 0;
  return points.reduce((acc,p)=>{
    return acc + Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
  },0)/points.length;
}

function colorFromScore(score){
  const r = Math.min(255, Math.floor(255*score));
  const g = Math.min(255, Math.floor(255*(1-score)));
  const b = Math.floor(255*(1-score));
  return `rgba(${r},${g},${b},0.8)`;
}

// ------------------- Chargement frames -------------------
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

// ------------------- Filtrage -------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  if(!points || !points.length) return [];
  return points.filter(p=>p.tci>=tciMin && p.tci<=tciMax && p.sri>=sriMin && p.sri<=sriMax);
}

// ------------------- Dessin -------------------
function drawBackground(){
  const w = canvas.width;
  const h = canvas.height;

  const avgScore = computeAverageScore(displayedPoints);
  const grad = ctx.createLinearGradient(0,h,w,0);
  grad.addColorStop(0, `rgba(0,${150*(1-avgScore)},255,0.2)`);
  grad.addColorStop(0.5, `rgba(255,${150*(1-avgScore)},0,0.15)`);
  grad.addColorStop(1, `rgba(255,0,0,0.15)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  for(let i=0;i<=10;i++){
    ctx.beginPath();
    ctx.moveTo(i*w/10,0); ctx.lineTo(i*w/10,h); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0,i*h/10); ctx.lineTo(w,i*h/10); ctx.stroke();
  }
}

function drawPoints(){
  const w = canvas.width;
  const h = canvas.height;

  displayedPoints.forEach((p,i)=>{
    const radius = 2 + 6*(i/displayedPoints.length);
    const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
    ctx.fillStyle = colorFromScore(score);

    const x = (p.x/100)*w;
    const y = h - (p.y/100)*h;

    // point principal
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();

    // halo lumineux
    ctx.beginPath();
    ctx.arc(x,y,radius*1.5,0,Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.2*(i/displayedPoints.length)})`;
    ctx.fill();

    // micro-points aléatoires autour du point
    for(let m=0;m<MICRO_POINTS;m++){
      const angle = Math.random()*Math.PI*2;
      const dist = Math.random()*radius*3;
      const mx = x + Math.cos(angle)*dist;
      const my = y + Math.sin(angle)*dist;
      const mr = Math.random()*1.5;
      ctx.beginPath();
      ctx.arc(mx,my,mr,0,Math.PI*2);
      ctx.fillStyle = `rgba(${Math.floor(255*score)},${Math.floor(255*(1-score))},${Math.floor(255*(1-score))},0.2)`;
      ctx.fill();
    }
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
  displayedPoints.push(...framePoints);
  if(displayedPoints.length>TRAIL_LENGTH) displayedPoints.splice(0,displayedPoints.length-TRAIL_LENGTH);

  drawBackground();
  drawPoints();

  const timeline = document.getElementById("timeline");
  if(timeline){ timeline.max = allFrames.length-1; timeline.value = currentFrame; }

  currentFrame = (currentFrame+1)%allFrames.length;
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

// ------------------- Curseur -------------------
function timelineChange(){
  currentFrame = parseInt(this.value)||0;
  displayedPoints = allFrames.slice(Math.max(0,currentFrame-TRAIL_LENGTH),currentFrame+1);
  drawBackground();
  drawPoints();
}

// ------------------- Filtrage manuel -------------------
function applyFilters(){
  currentFrame = 0;
  displayedPoints = [];
  nextFrame();
}

// ------------------- Légende -------------------
function renderLegend(){
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="color:blue">●</span> Très stable<br>
    <span style="color:green">●</span> Stable<br>
    <span style="color:orange">●</span> Alerte<br>
    <span style="color:red">●</span> Instable<br>
    Fond : gradient animé selon moyenne du trail<br>
    Points : récents plus gros et lumineux<br>
    Micro-points : effets artistiques autour
  `;
}

// ------------------- Init -------------------
async function init(){
  allFrames = await loadFramesFromHistory(1800);
  if(!allFrames.length) return;

  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  const timeline = document.getElementById("timeline");
  if(timeline) timeline.addEventListener("input", timelineChange);

  renderLegend();
  drawBackground();
  nextFrame();
}

window.addEventListener("load", init);

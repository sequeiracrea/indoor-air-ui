/* assets/js/events.js - Optimisée avec trail continu */

const STABILITY_COLORS = { stable:"rgba(0,200,0,0.15)", alert:"rgba(255,165,0,0.15)", unstable:"rgba(255,0,0,0.15)" };
const POINT_COLORS = { stable:"green", alert:"orange", unstable:"red" };

let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;
let displayedPoints = []; // Points déjà affichés pour le trail
const TRAIL_LENGTH = 60;  // Nombre de points à garder dans le trail

const canvas = document.getElementById("stabilityChart");
const ctx = canvas.getContext("2d");

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

// ------------------- Fonctions utilitaires -------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  if(!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

function getPointColor(p){
  const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
  if(score>0.75) return POINT_COLORS.unstable;
  if(score>0.5) return POINT_COLORS.alert;
  return POINT_COLORS.stable;
}

// ------------------- Dessin -------------------
function drawBackground(){
  const w = canvas.width;
  const h = canvas.height;
  
  ctx.clearRect(0,0,w,h);
  
  // 4 zones diagonales
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0,0); ctx.lineTo(w*0.5,0); ctx.lineTo(0,h*0.5); ctx.closePath();
  ctx.fillStyle = STABILITY_COLORS.stable; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w*0.5,0); ctx.lineTo(w,0); ctx.lineTo(w,w*0.5); ctx.closePath();
  ctx.fillStyle = STABILITY_COLORS.alert; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0,h*0.5); ctx.lineTo(w*0.5,h); ctx.lineTo(0,h); ctx.closePath();
  ctx.fillStyle = STABILITY_COLORS.alert; ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w*0.5,h); ctx.lineTo(w,h); ctx.lineTo(w,h*0.5); ctx.closePath();
  ctx.fillStyle = STABILITY_COLORS.unstable; ctx.fill();
  
  ctx.restore();
}

function drawPoints(){
  const w = canvas.width;
  const h = canvas.height;

  displayedPoints.forEach((p,i)=>{
    const radius = 2 + 4*(i/displayedPoints.length); // points récents plus gros
    ctx.fillStyle = getPointColor(p);
    const x = (p.x/100)*w;
    const y = h - (p.y/100)*h;
    ctx.beginPath();
    ctx.arc(x,y,radius,0,Math.PI*2);
    ctx.fill();
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
  
  // ajouter au trail
  displayedPoints.push(...framePoints);
  if(displayedPoints.length>TRAIL_LENGTH) displayedPoints.splice(0, displayedPoints.length-TRAIL_LENGTH);

  drawBackground();
  drawPoints();

  // mettre à jour curseur
  const timeline = document.getElementById("timeline");
  if(timeline){
    timeline.max = allFrames.length-1;
    timeline.value = currentFrame;
  }

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
  displayedPoints = [];
  nextFrame();
}

// ------------------- Curseur -------------------
function timelineChange(){
  currentFrame = parseInt(this.value) || 0;
  displayedPoints = allFrames.slice(Math.max(0,currentFrame-TRAIL_LENGTH),currentFrame+1);
  drawBackground();
  drawPoints();
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
    Points : derniers points plus gros
  `;
}

// ------------------- Init -------------------
async function init(){
  allFrames = await loadFramesFromHistory(1800);
  if(!allFrames.length) return;

  const playBtn = document.getElementById("playPauseBtn");
  playBtn.addEventListener("click", toggleAnimation);

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  const timeline = document.getElementById("timeline");
  if(timeline) timeline.addEventListener("input", timelineChange);

  renderLegend();
  drawBackground();
  nextFrame();
}

window.addEventListener("load", init);

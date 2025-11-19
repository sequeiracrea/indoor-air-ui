/* assets/js/events.js */
const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let frames = [];
let currentFrame = 0;
let playing = false;
let animationInterval = null;

// --- UTILITAIRES ---

// Statut selon score
function computeStatus(score){
  if(score > 0.75) return "unstable";
  if(score > 0.5) return "alert";
  return "stable";
}

// Filtrer points selon TCI/SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  return points.filter(p => p.TCI >= tciMin && p.TCI <= tciMax && p.SRI >= sriMin && p.SRI <= sriMax);
}

// Dessiner le fond "nucléide"
function drawBackground(ctx, chart){
  const {left, right, top, bottom} = chart.chartArea;
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

// Render Chart pour un frame
function renderChart(points){
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(stabilityChart) stabilityChart.destroy();
  stabilityChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: "État environnemental",
        data: points.map(p=>({x: p.GAQI, y: p.GEI, extra: p})),
        pointBackgroundColor: points.map(p=>POINT_COLORS[p.status]),
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive:true,
      maintainAspectRatio:false,
      scales:{
        x:{ title:{display:true,text:"GAQI"}, min:0, max:100 },
        y:{ title:{display:true,text:"GEI"}, min:0, max:100 }
      },
      plugins:{
        tooltip:{
          callbacks:{
            label(ctx){
              const p = ctx.raw.extra;
              return `GAQI: ${p.GAQI.toFixed(1)}, GEI: ${p.GEI.toFixed(1)}, SRI: ${p.SRI.toFixed(1)}, TCI: ${p.TCI.toFixed(1)}, Score: ${p.score.toFixed(2)}, État: ${p.status}`;
            }
          }
        },
        legend:{ display:false }
      }
    },
    plugins:[{
      id:'backgroundPlugin',
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// --- ANIMATION ---
function nextFrame(){
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  if(frames.length === 0) return;

  currentFrame = (currentFrame + 1) % frames.length;
  const points = filterPoints(frames[currentFrame], tciMin, tciMax, sriMin, sriMax);
  renderChart(points);

  // Mettre à jour le slider
  const slider = document.getElementById("timeSlider");
  if(slider){
    slider.value = currentFrame;
  }
}

function playAnimation(){
  if(!playing){
    playing = true;
    animationInterval = setInterval(nextFrame, 400);
  }
}

function pauseAnimation(){
  playing = false;
  clearInterval(animationInterval);
}

// --- CHARGEMENT DES DONNÉES ---
async function loadFrames(){
  try{
    const json = await window.IndoorAPI.fetchHistory(1800); // 30 min
    const series = json.series || [];
    if(!series.length) return;

    frames = series.map(entry=>{
      const indices = entry.indices || {};
      const GAQI = indices.GAQI ?? 0;
      const GEI = indices.GEI ?? 0;
      const SRI = indices.SRI ?? 0;
      const TCI = indices.TCI ?? 0;
      const score = Math.sqrt((GAQI/100)**2 + (GEI/100)**2 + (SRI/100)**2 + (TCI/100)**2);
      const status = computeStatus(score);
      return {GAQI, GEI, SRI, TCI, score, status};
    });

    // initial render
    nextFrame();

    // slider
    const sliderContainer = document.getElementById("timeSliderContainer");
    if(sliderContainer){
      sliderContainer.innerHTML = `<input type="range" min="0" max="${frames.length-1}" value="0" id="timeSlider" style="width:100%">`;
      const slider = document.getElementById("timeSlider");
      slider.addEventListener("input", ()=>{
        pauseAnimation();
        currentFrame = parseInt(slider.value);
        nextFrame();
      });
    }

  }catch(e){
    console.error("Erreur historique :", e);
  }
}

// --- FILTRE MANUEL ---
function applyFilters(){
  nextFrame();
}

// --- INITIALISATION ---
window.addEventListener("load", ()=>{
  loadFrames();
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Play/Pause buttons
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  if(playBtn) playBtn.addEventListener("click", playAnimation);
  if(pauseBtn) pauseBtn.addEventListener("click", pauseAnimation);

  // Légende
  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    - Fond vert : stable<br>
    - Fond orange : alerte<br>
    - Fond rouge : instable<br>
    - Points : état réel par instant<br>
    - Tooltip : tous les indices et score global
  `;
});

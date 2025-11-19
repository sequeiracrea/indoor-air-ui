/* assets/js/events.js */

const STABILITY_COLORS = { stable:"rgba(0,200,0,0.2)", alert:"rgba(255,165,0,0.2)", unstable:"rgba(255,0,0,0.2)" };
const POINT_COLORS = { stable:"green", alert:"orange", unstable:"red" };

let stabilityChart;
let frames = [];
let timeIndex = 0;

// ----------------------
// Chargement historique
// ----------------------
async function loadFramesFromHistory(sec=1800){
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    const list = history.series || [];

    frames = list
      .filter(entry => entry.indices) // protection indices manquants
      .map(entry => {
        const { GAQI, GEI, SRI, TCI } = entry.indices;
        const score = Math.sqrt(
          (GAQI/100)**2 +
          (GEI/100)**2 +
          (SRI/100)**2 +
          (TCI/100)**2
        );

        let status = "stable";
        if(score>0.5 && score<=0.75) status="alert";
        else if(score>0.75) status="unstable";

        return {
          x: GAQI,
          y: GEI,
          sri: SRI,
          tci: TCI,
          ts: entry.timestamp,
          status,
          score
        };
      });

    // Timeline
    const timeline = document.getElementById("timeline");
    if(timeline && frames.length>0){
      timeline.max = frames.length-1;
      timeline.value = 0;
    }

  } catch(e){
    console.error("Erreur historique :", e);
  }
}

// ----------------------
// Filtrage
// ----------------------
function filterPoints(points){
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  return points.filter(p => 
    p.tci>=tciMin && p.tci<=tciMax &&
    p.sri>=sriMin && p.sri<=sriMax
  );
}

// ----------------------
// Fond type nucléide
// ----------------------
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

// ----------------------
// Affichage graphique
// ----------------------
function renderChart(points){
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type:'scatter',
    data:{
      datasets:[{
        label:'État environnemental',
        data:points.map(p=>({x:p.x, y:p.y, extra:p})),
        pointBackgroundColor: points.map(p=>POINT_COLORS[p.status]),
        pointRadius:6,
        pointHoverRadius:10
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        tooltip:{
          callbacks:{
            label:ctx=>{
              const p=ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, Score: ${p.score.toFixed(2)}, État: ${p.status}`;
            }
          }
        },
        legend:{ display:false }
      },
      scales:{
        x:{ title:{display:true,text:"GAQI"}, min:0, max:100 },
        y:{ title:{display:true,text:"GEI"}, min:0, max:100 }
      }
    },
    plugins:[{
      id:'backgroundPlugin',
      beforeDraw:chart=>drawBackground(chart.ctx, chart)
    }]
  });
}

// ----------------------
// Animation
// ----------------------
let animationRunning = true;

function animateStep(){
  if(frames.length===0) return;

  const stepPoints = filterPoints(frames[timeIndex]);
  renderChart(stepPoints);

  // Timeline
  const timeline = document.getElementById("timeline");
  if(timeline) timeline.value = timeIndex;

  if(animationRunning){
    timeIndex = (timeIndex+1) % frames.length;
    requestAnimationFrame(()=>setTimeout(animateStep, 400));
  }
}

// ----------------------
// Bouton Play/Pause
// ----------------------
function toggleAnimation(){
  animationRunning = !animationRunning;
  if(animationRunning) animateStep();
}

// ----------------------
// Application filtre manuel
// ----------------------
function applyFilters(){
  if(frames.length===0) return;
  const stepPoints = filterPoints(frames[timeIndex]);
  renderChart(stepPoints);
}

// ----------------------
// Initialisation
// ----------------------
async function init(){
  await loadFramesFromHistory(1800);
  if(frames.length>0) animateStep();

  // Filtres
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Play/Pause
  const playBtn = document.getElementById("playPause");
  if(playBtn) playBtn.addEventListener("click", toggleAnimation);

  // Timeline slider
  const timeline = document.getElementById("timeline");
  if(timeline){
    timeline.addEventListener("input", ()=>{
      timeIndex = parseInt(timeline.value);
      const stepPoints = filterPoints(frames[timeIndex]);
      renderChart(stepPoints);
    });
  }

  // Légende
  const legend = document.getElementById("stabilityLegend");
  if(legend){
    legend.innerHTML = `
      <strong>Légende :</strong><br>
      - Fond vert : stable<br>
      - Fond orange : alerte<br>
      - Fond rouge : instable<br>
      - Points : états simulés animés<br>
      - Tooltip : tous les indices et score global
    `;
  }
}

window.addEventListener("load", init);

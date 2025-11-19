/* assets/js/events.js */
let allFrames = []; // tableau de frames, chaque frame = tableau de points
let timeIndex = 0;
let playing = true;
let stabilityChart = null;
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };
const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};
const POINTS_PER_FRAME = 50;

// --- Génération de points autour d'un indice ---
function generatePoints(entry) {
  const points = [];
  for (let i = 0; i < POINTS_PER_FRAME; i++) {
    const GAQI = entry.GAQI + (Math.random() - 0.5) * 5;
    const GEI = entry.GEI + (Math.random() - 0.5) * 5;
    const TCI = entry.TCI;
    const SRI = entry.SRI;
    const score = Math.sqrt((GAQI/100)**2 + (GEI/100)**2 + (TCI/100)**2 + (SRI/100)**2);
    let status = "stable";
    if(score > 0.5 && score <= 0.75) status="alert";
    else if(score > 0.75) status="unstable";
    points.push({ x: GAQI, y: GEI, tci: TCI, sri: SRI, score, status });
  }
  return points;
}

// --- Zones fond ---
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

// --- Render Chart ---
function renderChart(points){
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(stabilityChart) stabilityChart.destroy();
  stabilityChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: "État environnemental",
        data: points.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: points.map(p => POINT_COLORS[p.status]),
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "GAQI" }, min: 0, max: 100 },
        y: { title: { display: true, text: "GEI" }, min: 0, max: 100 }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI:${p.x.toFixed(1)}, GEI:${p.y.toFixed(1)}, SRI:${p.sri.toFixed(1)}, TCI:${p.tci.toFixed(1)}, Score:${p.score.toFixed(2)}, Etat:${p.status}`;
            }
          }
        },
        legend: { display: false }
      }
    },
    plugins: [{
      id: 'backgroundPlugin',
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// --- Animation ---
function nextFrame(){
  if(!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  let framePoints = allFrames[timeIndex].filter(p => 
    p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax
  );

  renderChart(framePoints);

  const slider = document.getElementById("timeSlider");
  if(slider) slider.value = timeIndex;

  timeIndex = (timeIndex + 1) % allFrames.length;
  if(playing) requestAnimationFrame(() => setTimeout(nextFrame, 400));
}

// --- Play / Pause ---
function togglePlay() {
  playing = !playing;
  document.getElementById("playPause").textContent = playing ? "Pause" : "Play";
  if(playing) nextFrame();
}

// --- Initialisation ---
async function init(){
  try {
    const res = await fetch(`${window.IndoorAPI.API_BASE}/history?sec=1800`);
    const json = await res.json();
    const series = json.series || [];
    if(!series.length) return;

    // Génération des frames
    allFrames = series.map(entry => generatePoints(entry.indices));

    // Slider setup
    const slider = document.getElementById("timeSlider");
    if(slider){
      slider.min = 0;
      slider.max = allFrames.length - 1;
      slider.value = 0;
      slider.addEventListener("input", e => {
        timeIndex = parseInt(e.target.value,10);
        nextFrame();
      });
    }

    // Play/Pause button
    const btn = document.getElementById("playPause");
    if(btn) btn.addEventListener("click", togglePlay);

    nextFrame();
  } catch(err){
    console.error("Erreur historique :", err);
  }
}

// --- Start ---
window.addEventListener("load", init);

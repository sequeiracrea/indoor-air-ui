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
let animating = false;
let animationId = null;

const TRAIL_LENGTH = 60;   // frames
const MICRO_POINTS = 30;   // optionnel pour micro points statiques

// --- Charger l'historique depuis l'API ---
async function loadFrames(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history || !history.series) return [];

    // Génération des frames
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

// --- Filtrer les points selon TCI/SRI ---
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points || !points.length) return [];
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// --- Fond type nucléide ---
function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const width = right - left;
  const height = bottom - top;

  ctx.save();
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, width * 0.5, height * 0.5);
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + width * 0.5, top, width * 0.5, height * 0.5);
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + height * 0.5, width, height * 0.5);
  ctx.restore();
}

// --- Rendu Chart ---
function renderChart(frameIndex) {
  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  // Création du trail
  const trailFrames = [];
  for (let i = TRAIL_LENGTH - 1; i >= 0; i--) {
    const idx = (frameIndex - i + frames.length) % frames.length;
    trailFrames.push(frames[idx]);
  }

  const filteredTrail = trailFrames.map(f => filterPoints([f], tciMin, tciMax, sriMin, sriMax)[0]).filter(Boolean);

  // Création du chart si non existant
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Trail",
        data: filteredTrail.map(p => ({ x: p.x, y: p.y })),
        pointBackgroundColor: filteredTrail.map(p => {
          const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
          if(score>0.75) return POINT_COLORS.unstable;
          if(score>0.5) return POINT_COLORS.alert;
          return POINT_COLORS.stable;
        }),
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min:0, max:100, title:{display:true,text:"GAQI"} },
        y: { min:0, max:100, title:{display:true,text:"GEI"} }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}`;
            }
          }
        },
        legend: { display: false }
      }
    },
    plugins:[{
      id:"backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// --- Animation ---
function nextFrame() {
  if(!frames.length) return;
  renderChart(currentFrame);
  currentFrame = (currentFrame + 1) % frames.length;
  if(animating) animationId = requestAnimationFrame(nextFrame);
}

// --- Play/Pause ---
function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if(animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// --- Application filtre manuel ---
function applyFilters() {
  currentFrame = 0;
  renderChart(currentFrame);
}

// --- Init ---
async function init() {
  frames = await loadFrames(1800);
  if(!frames.length) return;

  // Bouton Play/Pause
  const btn = document.createElement("button");
  btn.id = "playPauseBtn";
  btn.textContent = "Play";
  btn.addEventListener("click", toggleAnimation);
  document.getElementById("animationControls").appendChild(btn);

  // Slider temporel
  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = "timeSlider";
  slider.min = 0;
  slider.max = frames.length - 1;
  slider.value = 0;
  slider.addEventListener("input", e => {
    currentFrame = parseInt(e.target.value);
    renderChart(currentFrame);
  });
  document.getElementById("animationControls").appendChild(slider);

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  // Légende
  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    - Fond vert : stable<br>
    - Fond orange : alerte<br>
    - Fond rouge : instable<br>
    - Points : indices filtrés (GAQI, GEI)<br>
    - Tooltip : valeurs GAQI/GEI<br>
    - Trail : suivi des dernières ${TRAIL_LENGTH} frames
  `;

  // Premier rendu
  renderChart(currentFrame);
}

window.addEventListener("load", init);

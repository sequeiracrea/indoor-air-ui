/* assets/js/events.js */
const STABILITY_COLORS = { stable: "rgba(0,200,0,0.15)", alert: "rgba(255,165,0,0.15)", unstable: "rgba(255,0,0,0.15)" };
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let allFrames = [];
let timeIndex = 0;
let animating = true;

// --- Play/Pause / Slider ---
function toggleAnimation() {
  animating = !animating;
  document.getElementById("playPause").textContent = animating ? "Pause" : "Play";
}

function setSliderMax(max) {
  const slider = document.getElementById("timeSlider");
  if(slider) {
    slider.max = max - 1;
    slider.value = timeIndex;
  }
}

function updateFromSlider() {
  const slider = document.getElementById("timeSlider");
  if(slider) {
    timeIndex = parseInt(slider.value);
    renderCurrentFrame();
  }
}

// --- Calcul des indices pour chaque mesure si absent ---
function computeIndicesForEntry(entry) {
  if(entry.indices) return entry.indices; // déjà présent
  if(window.computeIndices) return computeIndices(entry.measures, []); // utilise utils/indices.js exposé global
  // fallback rapide
  const GAQI = Math.random()*100;
  const GEI = Math.random()*100;
  const TCI = Math.random()*100;
  const SRI = Math.random()*100;
  return { GAQI, GEI, TCI, SRI };
}

// --- Filtrage ---
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
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

// --- Render Chart ---
function renderChart(points) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'État environnemental',
        data: points.map(p => ({ x: p.GAQI, y: p.GEI, extra: p })),
        pointBackgroundColor: points.map(p => POINT_COLORS[p.status]),
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI: ${p.GAQI.toFixed(1)}, GEI: ${p.GEI.toFixed(1)}, SRI: ${p.SRI.toFixed(1)}, TCI: ${p.TCI.toFixed(1)}, Score: ${p.score.toFixed(2)}, État: ${p.status}`;
            }
          }
        },
        legend: { display: false }
      },
      scales: {
        x: { title: { display: true, text: "GAQI" }, min: 0, max: 100 },
        y: { title: { display: true, text: "GEI" }, min: 0, max: 100 }
      }
    },
    plugins: [{
      id: 'backgroundPlugin',
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

// --- Render frame actuelle selon timeIndex ---
function renderCurrentFrame() {
  if(!allFrames.length) return;
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  const stepPoints = filterPoints(allFrames[timeIndex], tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);

  const slider = document.getElementById("timeSlider");
  if(slider) slider.value = timeIndex;
}

// --- Animation ---
function animate() {
  if(animating) {
    timeIndex = (timeIndex + 1) % allFrames.length;
    renderCurrentFrame();
  }
  requestAnimationFrame(animate);
}

// --- Application filtre manuel ---
function applyFilters() {
  renderCurrentFrame();
}

// --- Initialisation ---
async function init() {
  try {
    const json = await window.IndoorAPI.fetchHistory(3600);
    const series = json.series || [];
    if(!series.length) return;

    // Construire frames avec indices et status
    allFrames = series.map(entry => {
      const indices = computeIndicesForEntry(entry);
      const score = Math.sqrt((indices.GAQI/100)**2 + (indices.GEI/100)**2 + (indices.TCI/100)**2 + (indices.SRI/100)**2);
      let status = "stable";
      if(score > 0.5 && score <= 0.75) status = "alert";
      else if(score > 0.75) status = "unstable";
      return { ...indices, score, status };
    });

    // Setup slider
    setSliderMax(allFrames.length);

    // Events UI
    document.getElementById("applyFilters").addEventListener("click", applyFilters);
    const slider = document.getElementById("timeSlider");
    if(slider) slider.addEventListener("input", updateFromSlider);
    const btnPlay = document.getElementById("playPause");
    if(btnPlay) btnPlay.addEventListener("click", toggleAnimation);

    // Initial render
    renderCurrentFrame();
    animate();

    document.getElementById("stabilityLegend").innerHTML = `
      <strong>Légende :</strong><br>
      - Fond vert : stable<br>
      - Fond orange : alerte<br>
      - Fond rouge : instable<br>
      - Points : états simulés par frame<br>
      - Tooltip : tous les indices et score global
    `;

  } catch(err) {
    console.error("Erreur historique :", err);
  }
}

// --- Start ---
window.addEventListener("load", init);

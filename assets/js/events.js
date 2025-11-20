const STABILITY_COLORS = { stable: "rgba(0,200,0,0.15)", alert: "rgba(255,165,0,0.15)", unstable: "rgba(255,0,0,0.15)" };
const POINT_COLORS = { stable: "green", alert: "orange", unstable: "red" };

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// Chargement historique depuis API
async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);
    if (!history?.series?.length) return [];

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

// Filtrer points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
}

// Zones de fond type nucléide
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

// Render Chart avec trail dégradé et tailles
function renderChart(points, trailLength = 60) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if (stabilityChart) stabilityChart.destroy();

  const start = Math.max(0, points.length - trailLength);
  const trailPoints = points.slice(start);

  // Calcul des couleurs et tailles
  const colors = [];
  const sizes = [];
  trailPoints.forEach((p, i) => {
    const alpha = (i + 1) / trailPoints.length;
    const score = Math.sqrt((p.x / 100) ** 2 + (p.y / 100) ** 2 + (p.tci / 100) ** 2 + (p.sri / 100) ** 2);
    let baseColor = POINT_COLORS.stable;
    if (score > 0.75) baseColor = POINT_COLORS.unstable;
    else if (score > 0.5) baseColor = POINT_COLORS.alert;

    // RGBA
    if (baseColor === "green") colors.push(`rgba(0,200,0,${alpha})`);
    else if (baseColor === "orange") colors.push(`rgba(255,165,0,${alpha})`);
    else colors.push(`rgba(255,0,0,${alpha})`);

    // Taille: plus récent = plus gros
    sizes.push(4 + 6 * alpha); // min 4, max 10
  });

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "État environnemental",
        data: trailPoints.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: colors,
        pointRadius: sizes,
        pointHoverRadius: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: "GAQI" } },
        y: { min: 0, max: 100, title: { display: true, text: "GEI" } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}`;
            }
          }
        },
        legend: { display: false } // On ajoute la légende dynamique via DOM
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });

  // Mettre à jour légende dynamique
  const legend = document.getElementById("stabilityLegend");
  legend.innerHTML = `
    <strong>Légende :</strong><br>
    <span style="color:green">● Stable</span> &nbsp;
    <span style="color:orange">● Alerte</span> &nbsp;
    <span style="color:red">● Instable</span><br>
    <span>Dégradé de taille / opacité → plus récent = plus visible</span>
  `;
}

// Animation
function nextFrame() {
  if (!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const framesToShow = allFrames.slice(0, currentFrame + 1);
  const filtered = filterPoints(framesToShow, tciMin, tciMax, sriMin, sriMax);

  renderChart(filtered, 60);

  const slider = document.getElementById("timeSlider");
  slider.value = currentFrame;
  document.getElementById("timeLabel").textContent = `${currentFrame + 1} / ${allFrames.length}`;

  currentFrame = (currentFrame + 1) % allFrames.length;
  if (animating) animationId = requestAnimationFrame(nextFrame);
}

// Play / Pause
function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";
  if (animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// Slider manuel
function onSliderChange(e) {
  animating = false;
  cancelAnimationFrame(animationId);
  currentFrame = parseInt(e.target.value);
  nextFrame();
}

// Appliquer filtre manuel
function applyFilters() {
  currentFrame = 0;
  nextFrame();
}

// Init
async function init() {
  allFrames = await loadFramesFromHistory(1800);
  if (!allFrames.length) return;

  // Boutons Play / Pause
  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
  const slider = document.getElementById("timeSlider");
  slider.max = allFrames.length - 1;
  slider.addEventListener("input", onSliderChange);

  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  nextFrame();
}

window.addEventListener("load", init);

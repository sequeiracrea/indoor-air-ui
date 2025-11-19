/* assets/js/events.js */

const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};

const POINT_COLORS = {
  stable: "green",
  alert: "orange",
  unstable: "red"
};

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// ---------------------------------------
// 🔥 Lecture correcte des indices GAQI/GEI/SRI/TCI
// ---------------------------------------
async function loadFramesFromHistory(sec = 1800) {
  try {
    const history = await window.IndoorAPI.fetchHistory(sec);

    if (!history || !history.series || !history.series.length) {
      console.warn("⚠️ Aucune donnée dans /history");
      return [];
    }

    const frames = history.series.map(entry => {
      const idx = entry.indices || {};

      return {
        x: Number(idx.GAQI || 0),
        y: Number(idx.GEI || 0),
        sri: Number(idx.SRI || 0),
        tci: Number(idx.TCI || 0)
      };
    });

    return frames;
  } catch (err) {
    console.error("Erreur loadFrames:", err);
    return [];
  }
}

// ---------------------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  if (!points) return [];
  return points.filter(p =>
    p.tci >= tciMin &&
    p.tci <= tciMax &&
    p.sri >= sriMin &&
    p.sri <= sriMax
  );
}

// ---------------------------------------
function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const w = right - left;
  const h = bottom - top;

  ctx.save();
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, w * 0.5, h * 0.5);

  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + w * 0.5, top, w * 0.5, h * 0.5);

  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + h * 0.5, w, h * 0.5);
  ctx.restore();
}

// ---------------------------------------
function renderChart(points) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: "Indice stabilité",
        data: points.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: points.map(p => {
          const score = Math.sqrt(
            (p.x / 100) ** 2 +
            (p.y / 100) ** 2 +
            (p.tci / 100) ** 2 +
            (p.sri / 100) ** 2
          );
          if (score > 0.75) return POINT_COLORS.unstable;
          if (score > 0.5) return POINT_COLORS.alert;
          return POINT_COLORS.stable;
        }),
        pointRadius: 6,
        pointHoverRadius: 9
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
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI ${p.x}, GEI ${p.y}, SRI ${p.sri}, TCI ${p.tci}`;
            }
          }
        }
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: c => drawBackground(c.ctx, c)
    }]
  });
}

// ---------------------------------------
function nextFrame() {
  if (!allFrames.length) return;

  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const frame = allFrames[currentFrame];
  const filtered = filterPoints([frame], tciMin, tciMax, sriMin, sriMax);

  renderChart(filtered);

  currentFrame = (currentFrame + 1) % allFrames.length;

  if (animating) animationId = requestAnimationFrame(nextFrame);
}

// ---------------------------------------
function toggleAnimation() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  btn.textContent = animating ? "Pause" : "Play";

  if (animating) nextFrame();
  else cancelAnimationFrame(animationId);
}

// ---------------------------------------
function applyFilters() {
  currentFrame = 0;
  nextFrame();
}

// ---------------------------------------
async function init() {
  allFrames = await loadFramesFromHistory(1800);

  console.log("Frames chargées :", allFrames.length);

  if (!allFrames.length) {
    console.warn("⚠️ Pas de frames utilisables.");
    return;
  }

  document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
  document.getElementById("applyFilters").addEventListener("click", applyFilters);

  nextFrame();
}

window.addEventListener("load", init);

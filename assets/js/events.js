/* assets/js/events.js — Version finale stable */

const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.15)",
  alert: "rgba(255,165,0,0.15)",
  unstable: "rgba(255,0,0,0.15)"
};

let stabilityChart = null;
let allFrames = [];        // tableau des frames GAQI/GEI/SRI/TCI
let currentFrame = 0;
let isPlaying = false;
let rafId = null;

/* --------------------------------------------
   1) Charger l’historique depuis API /history
---------------------------------------------*/
async function fetchFrames(sec = 1800) {
  try {
    const h = await window.IndoorAPI.fetchHistory(sec);
    if (!h || !h.series) return [];

    // Construit une frame avec GAQI/GEI/SRI/TCI
    return h.series
      .filter(e => e.indices && typeof e.indices.GAQI === "number")
      .map(e => ({
        x: e.indices.GAQI,
        y: e.indices.GEI,
        sri: e.indices.SRI,
        tci: e.indices.TCI,
        timestamp: e.timestamp
      }));
  } catch (err) {
    console.error("Erreur fetchFrames():", err);
    return [];
  }
}

/* --------------------------------------------
   2) Filtrage SRI / TCI
---------------------------------------------*/
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
  return points.filter(p =>
    p.tci >= tciMin &&
    p.tci <= tciMax &&
    p.sri >= sriMin &&
    p.sri <= sriMax
  );
}

/* --------------------------------------------
   3) Render Chart.js
---------------------------------------------*/
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

function plotFrame(points) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if (stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        data: points.map(p => ({ x: p.x, y: p.y, extra: p })),
        pointBackgroundColor: "rgba(0,120,255,0.9)",
        pointRadius: 6
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, title: { text: "GAQI", display: true }},
        y: { min: 0, max: 100, title: { text: "GEI", display: true }}
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI ${p.x}, GEI ${p.y}, SRI ${p.sri}, TCI ${p.tci}`;
            }
          }
        },
        legend: { display: false }
      }
    },
    plugins: [{
      id: "bgPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

/* --------------------------------------------
   4) Animation
---------------------------------------------*/
function nextFrame() {
  const frame = allFrames[currentFrame];
  if (!frame) return;

  const tciMin = +document.getElementById("tciMin").value;
  const tciMax = +document.getElementById("tciMax").value;
  const sriMin = +document.getElementById("sriMin").value;
  const sriMax = +document.getElementById("sriMax").value;

  // frame = UN seul point → mais Chart.js veut un array
  const filtered = filterPoints([frame], tciMin, tciMax, sriMin, sriMax);

  plotFrame(filtered);

  // timeline
  document.getElementById("timeSlider").value = currentFrame;

  // frame suivante
  currentFrame = (currentFrame + 1) % allFrames.length;

  if (isPlaying) rafId = requestAnimationFrame(nextFrame);
}

function togglePlay() {
  isPlaying = !isPlaying;
  document.getElementById("playPauseBtn").textContent =
    isPlaying ? "Pause" : "Play";
  if (isPlaying) nextFrame();
  else cancelAnimationFrame(rafId);
}

/* --------------------------------------------
   5) INIT
---------------------------------------------*/
async function init() {
  allFrames = await fetchFrames(1800);

  if (!allFrames.length) {
    console.error("Aucune frame chargée !");
    return;
  }

  document.getElementById("timeSlider").max = allFrames.length - 1;

  // bouton play/pause
  document.getElementById("playPauseBtn").addEventListener("click", togglePlay);

  // slider timeline
  document.getElementById("timeSlider").addEventListener("input", e => {
    currentFrame = +e.target.value;
    plotFrame([allFrames[currentFrame]]);
  });

  // filtres
  ["tciMin","tciMax","sriMin","sriMax"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
      plotFrame([allFrames[currentFrame]]);
    });
  });

  // affiche première frame
  plotFrame([allFrames[0]]);
}

window.addEventListener("load", init);

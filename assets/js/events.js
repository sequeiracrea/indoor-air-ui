/* -------------------------------------------------------
   STABILITÉ – DIAGRAMME DE TYPE NUCLÉIDE
   Source réelle : https://indoor-sim-server.onrender.com/data
--------------------------------------------------------- */

const STABILITY_COLORS = {
  stable:  "rgba(0,200,0,0.18)",
  alert:   "rgba(255,165,0,0.18)",
  unstable:"rgba(255,0,0,0.18)"
};

const POINT_COLORS = {
  stable:"green",
  alert:"orange",
  unstable:"red"
};

let stabilityChart;
let frames = [];     // Contiendra 300 frames → ~5 min d’animation
let timeIndex = 0;
let animationActive = true;

const maxFrames = 200;  // Animation courte mais fluide

/* -------------------------------------------------------
   1) Fetch de données réelles
--------------------------------------------------------- */

async function fetchRealData() {
  try {
    const res = await fetch("https://indoor-sim-server.onrender.com/data");
    return await res.json();
  } catch (err) {
    console.error("❌ API fetch error:", err);
    return null;
  }
}

/* -------------------------------------------------------
   2) Création d’une frame à partir des vraies données
--------------------------------------------------------- */

function buildFrameFromReal(json) {
  if (!json || !json.indices) return null;

  const { GAQI, GEI, SRI, TCI } = json.indices;

  const score = Math.sqrt(
    (GAQI/100)**2 +
    (GEI/100)**2 +
    (SRI/100)**2 +
    (TCI/100)**2
  );

  let status = "stable";
  if (score > 0.5 && score <= 0.75) status = "alert";
  else if (score > 0.75) status = "unstable";

  return {
    x: GAQI,
    y: GEI,
    sri: SRI,
    tci: TCI,
    status,
    score
  };
}

/* -------------------------------------------------------
   3) Ajout continu de frames → animation réelle
--------------------------------------------------------- */

async function accumulateFrames() {
  const data = await fetchRealData();
  const frame = buildFrameFromReal(data);
  if (frame) {
    frames.push(frame);
    if (frames.length > maxFrames) frames.shift();
  }
}

/* -------------------------------------------------------
   4) Filtre TCI / SRI
--------------------------------------------------------- */

function filterFrame(p, tciMin, tciMax, sriMin, sriMax) {
  return (
    p.tci >= tciMin &&
    p.tci <= tciMax &&
    p.sri >= sriMin &&
    p.sri <= sriMax
  );
}

/* -------------------------------------------------------
   5) Fond “Nucléide”
--------------------------------------------------------- */

function drawBackground(ctx, chart) {
  const { left, right, top, bottom } = chart.chartArea;
  const w = right - left;
  const h = bottom - top;

  ctx.save();

  // Quadrants
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, w * 0.5, h * 0.5);

  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + w * 0.5, top, w * 0.5, h * 0.5);

  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + h * 0.5, w, h * 0.5);

  ctx.restore();
}

/* -------------------------------------------------------
   6) Render chart propre (ne clignote pas)
--------------------------------------------------------- */

function renderChart(point) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if (!point) return;

  const dataset = [{
    label: "Stabilité",
    data: [{ x: point.x, y: point.y, extra: point }],
    pointBackgroundColor: POINT_COLORS[point.status],
    pointRadius: 7,
    pointHoverRadius: 12
  }];

  if (stabilityChart) {
    stabilityChart.data.datasets = dataset;
    stabilityChart.update();
    return;
  }

  // Création du chart une seule fois
  stabilityChart = new Chart(ctx, {
    type: "scatter",
    data: { datasets: dataset },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: "GAQI" }},
        y: { min: 0, max: 100, title: { display: true, text: "GEI" }}
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return [
                `GAQI : ${p.x.toFixed(1)}`,
                `GEI : ${p.y.toFixed(1)}`,
                `SRI : ${p.sri.toFixed(1)}`,
                `TCI : ${p.tci.toFixed(1)}`,
                `Score : ${p.score.toFixed(2)}`,
                `État : ${p.status}`
              ];
            }
          }
        }
      }
    },
    plugins: [{
      id: "backgroundPlugin",
      beforeDraw: chart => drawBackground(chart.ctx, chart)
    }]
  });
}

/* -------------------------------------------------------
   7) Animation fluide sans “reboot visuel”
--------------------------------------------------------- */

async function animate() {
  if (animationActive) {
    await accumulateFrames();

    const point = frames[timeIndex];
    if (point) renderChart(point);

    timeIndex = (timeIndex + 1) % frames.length;
    document.getElementById("timeline").value = timeIndex;
  }

  requestAnimationFrame(animate);
}

/* -------------------------------------------------------
   8) Gestion timeline
--------------------------------------------------------- */

function setupTimeline() {
  const slider = document.getElementById("timeline");
  slider.max = maxFrames;

  slider.addEventListener("input", () => {
    timeIndex = parseInt(slider.value);
    animationActive = false;
    renderChart(frames[timeIndex]);
  });
}

/* -------------------------------------------------------
   9) Bouton play/pause
--------------------------------------------------------- */

function setupPlayPause() {
  const btn = document.getElementById("playPause");

  btn.addEventListener("click", () => {
    animationActive = !animationActive;
    btn.textContent = animationActive ? "Pause" : "Play";
  });
}

/* -------------------------------------------------------
   10) Initialisation
--------------------------------------------------------- */

window.addEventListener("load", () => {
  setupTimeline();
  setupPlayPause();
  animate();

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    • Vert = stable<br>
    • Orange = alerte<br>
    • Rouge = instable<br>
    • Tooltip = tous les indices + score<br>
    • Timeline = navigation temporelle<br>
    • Animation = données API rafraîchies en continu
  `;
});

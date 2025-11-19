/* -------------------------------------------------------
   STABILITÉ – DIAGRAMME DE TYPE NUCLÉIDE
   Source réelle via IndoorAPI (api.js)
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
let frames = [];
let timeIndex = 0;
let animationActive = true;

/* -------------------------------------------------------
   1) Charger l’historique réel depuis l’API Indoor
--------------------------------------------------------- */

async function loadFramesFromHistory() {
  try {
    const history = await IndoorAPI.fetchHistory(3600); // 1h d’historique
    const list = history.series || [];
    frames = list.map(entry => {
      const { GAQI, GEI, SRI, TCI } = entry.indices;

      const score = Math.sqrt(
        (GAQI/100)**2 +
        (GEI /100)**2 +
        (SRI /100)**2 +
        (TCI /100)**2
      );

      let status = "stable";
      if (score > 0.5 && score <= 0.75) status = "alert";
      else if (score > 0.75) status = "unstable";

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
  } catch(err) {
    console.error("Erreur historique :", err);
  }
}

/* -------------------------------------------------------
   2) Fond type “nucléide”
--------------------------------------------------------- */

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

/* -------------------------------------------------------
   3) Affichage d’une frame
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
                `GEI :  ${p.y.toFixed(1)}`,
                `SRI :  ${p.sri.toFixed(1)}`,
                `TCI :  ${p.tci.toFixed(1)}`,
                `Score : ${p.score.toFixed(2)}`,
                `État : ${p.status}`,
                `Time : ${p.ts}`
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
   4) Animation fluide
--------------------------------------------------------- */

function animate() {
  if (animationActive && frames.length) {
    const point = frames[timeIndex];
    renderChart(point);

    timeIndex = (timeIndex + 1) % frames.length;
    document.getElementById("timeline").value = timeIndex;
  }

  requestAnimationFrame(animate);
}

/* -------------------------------------------------------
   5) Timeline + Play / Pause
--------------------------------------------------------- */

function setupControls() {
  const timeline = document.getElementById("timeline");
  const btn = document.getElementById("playPause");

  timeline.max = 1; // sera mis à jour après loadFrames

  timeline.addEventListener("input", () => {
    animationActive = false;
    timeIndex = parseInt(timeline.value);
    renderChart(frames[timeIndex]);
  });

  btn.addEventListener("click", () => {
    animationActive = !animationActive;
    btn.textContent = animationActive ? "Pause" : "Play";
  });
}

/* -------------------------------------------------------
   6) Initialisation
--------------------------------------------------------- */

async function init() {
  await loadFramesFromHistory();

  const timeline = document.getElementById("timeline");
  timeline.max = frames.length - 1;

  setupControls();
  animate();

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Légende :</strong><br>
    • GAQI vs GEI animés depuis l’historique réel<br>
    • Fond : zones de stabilité<br>
    • Points colorés selon le score<br>
    • Timeline : navigation temporelle<br>
    • Pause/play : contrôler l’évolution<br>
  `;
}

window.addEventListener("load", init);

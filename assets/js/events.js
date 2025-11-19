

/* —————————————————––
CONFIG
———————————————————*/
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

let stabilityChart = null;
let allFrames = [];      // tableau des frames
let currentIndex = 0;    // index utilisé par animation et slider
let playing = true;      // état play/pause
let animationLoop = null;

/* —————————————————––
UTIL : Calcul stabilité
———————————————————*/
function computeStatus(p) {
const score = Math.sqrt(
(p.SRI / 100) ** 2 +
(p.GAQI / 100) ** 2 +
(p.GEI / 100) ** 2 +
(p.TCI / 100) ** 2
);

if (score <= 0.50) return "stable";
if (score <= 0.75) return "alert";
return "unstable";
}

/* —————————————————––
	1.	Construction des frames depuis API
———————————————————*/
async function loadFramesFromHistory() {
try {
const hist = await IndoorAPI.fetchHistory(3600);
const series = hist.series || [];
if (!series.length) return [];

const frames = series.map(entry => {

  if (!entry.indices) return null;

  const GAQI = entry.indices.GAQI;
  const GEI = entry.indices.GEI;
  const SRI = entry.indices.SRI;
  const TCI = entry.indices.TCI;

  if ([GAQI, GEI, SRI, TCI].some(v => typeof v !== "number")) return null;

  const point = {
    x: GAQI,
    y: GEI,
    SRI,
    TCI,
    GAQI,
    GEI
  };

  return {
    points: [point],
    timestamp: entry.timestamp
  };
});

return frames.filter(Boolean);

} catch (err) {
console.error("Erreur historique :", err);
return [];
}
}

/* —————————————————––
2. Filtrage
———————————————————*/
function filterPoints(points, tMin, tMax, sMin, sMax) {
if (!Array.isArray(points)) return [];
return points.filter(p =>
p.TCI >= tMin &&
p.TCI <= tMax &&
p.SRI >= sMin &&
p.SRI <= sMax
);
}

/* —————————————————––
3. Background Nucléide
———————————————————*/
function drawBackground(ctx, chart) {
const { left, top, right, bottom } = chart.chartArea;
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

/* —————————————————––
4. Rendu du chart
———————————————————*/
function renderChart(points) {

const ctx = document.getElementById("stabilityChart");

if (stabilityChart) stabilityChart.destroy();

stabilityChart = new Chart(ctx, {
type: "scatter",
data: {
datasets: [{
label: "",
data: points.map(p => ({
x: p.GAQI,
y: p.GEI,
extra: p
})),
pointRadius: 6,
pointBackgroundColor: points.map(p => {
const st = computeStatus(p);
return POINT_COLORS[st];
})
}]
},
options: {
responsive: true,
maintainAspectRatio: false,
scales: {
x: { min: 0, max: 100, title: { display: true, text: "GAQI" }},
y: { min: 0, max: 100, title: { display: true, text: "GEI" }}
},
plugins: {
tooltip: {
callbacks: {
label: ctx => {
const p = ctx.raw.extra;
const st = computeStatus(p);
return GAQI ${p.GAQI.toFixed(1)}, GEI ${p.GEI.toFixed(1)}, SRI ${p.SRI.toFixed(1)}, TCI ${p.TCI.toFixed(1)} → ${st};
}
}
},
legend: { display: false }
}
},
plugins: [{
id: "bg",
beforeDraw: drawBackground
}]
});
}

/* —————————————————––
5. Animation
———————————————————*/
function animate() {
if (!playing) return;

currentIndex = (currentIndex + 1) % allFrames.length;
updateSliderUI();

const rawPoints = allFrames[currentIndex].points;
const filtered = applyFilterToPoints(rawPoints);

renderChart(filtered);

animationLoop = setTimeout(() => requestAnimationFrame(animate), 450);
}

/* —————————————————––
Filtres
———————————————————*/
function applyFilterToPoints(points) {
const tMin = parseFloat(document.getElementById("tciMin").value);
const tMax = parseFloat(document.getElementById("tciMax").value);
const sMin = parseFloat(document.getElementById("sriMin").value);
const sMax = parseFloat(document.getElementById("sriMax").value);

return filterPoints(points, tMin, tMax, sMin, sMax);
}

/* —————————————————––
6. Slider
———————————————————*/
function updateSliderUI() {
const slider = document.getElementById("timeSlider");
slider.value = currentIndex;
}

function onSliderMove(e) {
const idx = parseInt(e.target.value);
if (!allFrames[idx]) return;

currentIndex = idx;

const rawPoints = allFrames[idx].points;
const filtered = applyFilterToPoints(rawPoints);

renderChart(filtered);
}

/* —————————————————––
7. Play / Pause
———————————————————*/
function togglePlay() {
const btn = document.getElementById("playBtn");

playing = !playing;

if (playing) {
btn.textContent = "Pause";
animate();
} else {
btn.textContent = "Play";
clearTimeout(animationLoop);
}
}

/* —————————————————––
INITIALISATION
———————————————————*/
async function init() {

allFrames = await loadFramesFromHistory();

if (!allFrames.length) {
console.warn("Aucune donnée, canvas vide.");
return;
}

const slider = document.getElementById("timeSlider");
slider.max = allFrames.length - 1;

// Première image :
renderChart(allFrames[0].points);

// Lancer animation
animate();

// Events
document.getElementById("playBtn").addEventListener("click", togglePlay);
document.getElementById("timeSlider").addEventListener("input", onSliderMove);
document.getElementById("applyFilters").addEventListener("click", () => {
const pts = allFrames[currentIndex].points;
renderChart(applyFilterToPoints(pts));
});
}

window.addEventListener("load", init);

/* assets/js/events.js
   Stabilité — diagramme "nucléide" Variante B
   - charge /history depuis IndoorAPI.fetchHistory
   - construit des frames : chaque frame = fenêtre glissante de MICRO_POINTS
   - animation play/pause, timeline, filtres TCI/SRI
   - plugin Chart.js pour fond "nucléide" (Variante B)
   - ne détruit pas le chart à chaque frame (update efficace)
*/

const MICRO_POINTS = 30;    // nombre de points par frame (micro-points)
const FRAME_STEP = 1;       // pas entre frames (1 => lissage complet)
const FRAME_DELAY_MS = 120; // délai par frame en mode lecture (ms)
const TRAIL_OPACITY_MIN = 0.15;
const TRAIL_OPACITY_MAX = 1.0;

const STABILITY_COLORS = {
  stable: "rgba(0,200,0,0.12)",
  alert:  "rgba(255,165,0,0.12)",
  unstable:"rgba(255,0,0,0.12)"
};
const POINT_COLORS = { stable: "#0b9b34", alert: "#f59e0b", unstable: "#ef4444" };

let chart = null;
let frames = [];        // chaque frame = array de points {x,y,sri,tci,timestamp}
let currentFrame = 0;
let playing = false;
let playTimer = null;

// --- UTIL ---
function safeNum(v, fallback=0){
  return (v === undefined || v === null || Number.isNaN(Number(v))) ? fallback : Number(v);
}
function classifyPoint(p){
  // Score combiné : normalisé sur 0..1
  const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
  if(score > 0.75) return "unstable";
  if(score > 0.5) return "alert";
  return "stable";
}
function lerp(a,b,t){ return a + (b-a)*t; }

// --- CONSTRUCTION DES FRAMES À PARTIR DE L'HISTORIQUE ---
async function buildFramesFromHistory(sec=1800, micro=MICRO_POINTS){
  try{
    const resp = await window.IndoorAPI.fetchHistory(sec);
    const series = resp?.series || [];
    if(!series.length) return [];

    // Extraire only entries that have indices (sûreté)
    const entries = series.map(e => {
      const idx = e.indices || {};
      return {
        timestamp: e.timestamp,
        GAQI: safeNum(idx.GAQI, null),
        GEI:  safeNum(idx.GEI, null),
        SRI:  safeNum(idx.SRI, null),
        TCI:  safeNum(idx.TCI, null)
      };
    }).filter(e => e.GAQI !== null && e.GEI !== null);

    if(entries.length < 1) return [];

    // Construire frames : pour chaque position i, prendre la fenêtre [i-micro+1..i]
    const out = [];
    for(let i = micro - 1; i < entries.length; i += FRAME_STEP){
      const slice = entries.slice(i - micro + 1, i + 1);
      // map to points with age (0 = newest)
      const pts = slice.map((s, j) => {
        const age = (slice.length - 1 - j); // 0 newest, larger older
        return {
          x: s.GAQI,
          y: s.GEI,
          sri: s.SRI,
          tci: s.TCI,
          ts: s.timestamp,
          age
        };
      });
      out.push(pts);
    }
    return out;
  } catch(err){
    console.error("loadFramesFromHistory error:", err);
    return [];
  }
}

// --- PLUGIN : fond Variante B (courbe + zones) ---
const nucleusBackgroundPlugin = {
  id: 'nucleusBackground',
  beforeDraw: chart => {
    const ctx = chart.ctx;
    const {left, right, top, bottom, width, height} = chart.chartArea ? {...chart.chartArea, width: chart.chartArea.right - chart.chartArea.left, height: chart.chartArea.bottom - chart.chartArea.top} : {};
    if(!chart.chartArea) return;
    // Clear is already done by Chart.js; draw background pattern
    ctx.save();

    // Render a smooth diagonal "nucléide" style:
    // We'll draw three bands using bezier curves for a "B" style:
    const midX = left + (right - left) * 0.5;
    const midY = top + (bottom - top) * 0.5;

    // Stable zone (top-left curved)
    ctx.fillStyle = STABILITY_COLORS.stable;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.quadraticCurveTo(left + (right-left)*0.12, top + (bottom-top)*0.35, midX, midY*0.75);
    ctx.lineTo(left, midY*0.75);
    ctx.closePath();
    ctx.fill();

    // Alert band (central curved diagonal)
    ctx.fillStyle = STABILITY_COLORS.alert;
    ctx.beginPath();
    ctx.moveTo(midX, top);
    ctx.quadraticCurveTo(left + (right-left)*0.68, top + (bottom-top)*0.38, right, midY*0.9);
    ctx.lineTo(right, midY*0.9 + (bottom-top)*0.15);
    ctx.quadraticCurveTo(left + (right-left)*0.55, bottom - (bottom-top)*0.08, left + (right-left)*0.02, bottom - (bottom-top)*0.02);
    ctx.closePath();
    ctx.fill();

    // Unstable lower area (bottom)
    ctx.fillStyle = STABILITY_COLORS.unstable;
    ctx.beginPath();
    ctx.moveTo(left, midY);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();

    // subtle grid lines
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.lineWidth = 1;
    const stepX = (right-left)/10;
    const stepY = (bottom-top)/10;
    for(let i=1;i<10;i++){
      ctx.beginPath();
      ctx.moveTo(left + i*stepX, top);
      ctx.lineTo(left + i*stepX, bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(left, top + i*stepY);
      ctx.lineTo(right, top + i*stepY);
      ctx.stroke();
    }

    ctx.restore();
  }
};

// --- INITIALISER LE CHART (création une fois) ---
function initChart(initialPoints = []){
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  // Data placeholders
  const ds = {
    label: "État environnemental",
    data: initialPoints.map(p => ({x: p.x, y: p.y, extra: p})),
    pointBackgroundColor: initialPoints.map(p => POINT_COLORS[classifyPoint(p)]),
    pointRadius: initialPoints.map(p => radiusForAge(p.age)),
    pointHoverRadius: 10,
    showLine: false
  };

  // Chart config
  chart = new Chart(ctx, {
    type: "scatter",
    data: { datasets: [ ds ] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // we'll control updates manually for perf
      scales: {
        x: { min: 0, max: 100, title: { display: true, text: "GAQI" } },
        y: { min: 0, max: 100, title: { display: true, text: "GEI" } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: () => "",
            label: ctxItem => {
              const p = ctxItem.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri?.toFixed?.(1)||'NA'}, TCI: ${p.tci?.toFixed?.(1)||'NA'}`;
            }
          }
        }
      },
      interaction: { mode: 'nearest', intersect: false }
    },
    plugins: [nucleusBackgroundPlugin]
  });
}

// calc radius: newer points bigger
function radiusForAge(age, maxAge = MICRO_POINTS - 1){
  // age = 0 newest => largest
  const t = age / Math.max(1, maxAge);
  // size between 10 (newest) and 4 (oldest)
  return Math.round( lerp(10, 4, t) );
}

// Update chart dataset in-place (fast)
function renderFrame(index){
  if(!chart) return;
  currentFrame = Math.max(0, Math.min(index, frames.length - 1));
  const pts = frames[currentFrame] || [];

  // Apply filters currently set in UI
  const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
  const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
  const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
  const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

  const filtered = pts.filter(p => {
    return p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax;
  });

  // Build arrays for chart
  const data = filtered.map(p => ({ x: p.x, y: p.y, extra: p }));
  const bg = filtered.map(p => POINT_COLORS[classifyPoint(p)]);
  const sizes = filtered.map(p => radiusForAge(p.age));

  // Update dataset in-place (no destroy)
  const ds = chart.data.datasets[0];
  ds.data = data;
  ds.pointBackgroundColor = bg;
  ds.pointRadius = sizes; // Chart.js accepts array
  // apply direct update without animation
  chart.update("none");

  // update timeline slider & details
  const slider = document.getElementById("timeline");
  if(slider){
    slider.max = Math.max(0, frames.length - 1);
    slider.value = currentFrame;
  }

  document.getElementById("stabilityLegend").innerHTML = legendHtml();
}

// legend html
function legendHtml(){
  return `
    <strong>Légende</strong><br>
    <span style="display:inline-block;width:12px;height:12px;background:${POINT_COLORS.stable};border-radius:3px;margin-right:6px;"></span> Stable
    &nbsp;&nbsp;
    <span style="display:inline-block;width:12px;height:12px;background:${POINT_COLORS.alert};border-radius:3px;margin-right:6px;"></span> Alerte
    &nbsp;&nbsp;
    <span style="display:inline-block;width:12px;height:12px;background:${POINT_COLORS.unstable};border-radius:3px;margin-right:6px;"></span> Instable
    <br><small>MicroPoints par frame: ${MICRO_POINTS}, Trail visuel par taille (récents = plus gros)</small>
  `;
}

// --- Animation loop control ---
function startPlaying(){
  if(playing) return;
  playing = true;
  document.getElementById("playPauseBtn").textContent = "Pause";
  let last = performance.now();
  function step(now){
    if(!playing) return;
    const elapsed = now - last;
    if(elapsed >= FRAME_DELAY_MS){
      last = now;
      // advance frame
      currentFrame = (currentFrame + 1) % frames.length;
      renderFrame(currentFrame);
    }
    playTimer = requestAnimationFrame(step);
  }
  playTimer = requestAnimationFrame(step);
}

function stopPlaying(){
  playing = false;
  document.getElementById("playPauseBtn").textContent = "Play";
  if(playTimer) cancelAnimationFrame(playTimer);
  playTimer = null;
}

function togglePlay(){
  if(playing) stopPlaying();
  else startPlaying();
}

// --- UI bindings ---
function attachUI(){
  const btn = document.getElementById("playPauseBtn");
  if(btn) btn.addEventListener("click", togglePlay);

  const slider = document.getElementById("timeline");
  if(slider){
    slider.min = 0;
    slider.max = Math.max(0, frames.length - 1);
    slider.addEventListener("input", e => {
      const v = parseInt(e.target.value, 10) || 0;
      stopPlaying();
      renderFrame(v);
    });
  }

  const applyBtn = document.getElementById("applyFilters");
  if(applyBtn) applyBtn.addEventListener("click", () => {
    stopPlaying();
    renderFrame(currentFrame);
  });
}

// --- Entrée principale ---
async function init(){
  try{
    // Build frames
    frames = await buildFramesFromHistory(1800, MICRO_POINTS);
    if(!frames.length){
      console.warn("Aucune frame chargée !");
    }

    // create chart with empty dataset (first frame or empty)
    const initialPoints = frames.length ? frames[0] : [];
    initChart(initialPoints);

    // attach UI
    attachUI();

    // set timeline range
    const slider = document.getElementById("timeline");
    if(slider){
      slider.max = Math.max(0, frames.length - 1);
      slider.value = 0;
    }

    // initial render
    renderFrame(0);

    // draw legend
    document.getElementById("stabilityLegend").innerHTML = legendHtml();

  } catch(err){
    console.error("init stability error:", err);
  }
}

// Start après load
window.addEventListener("load", init);

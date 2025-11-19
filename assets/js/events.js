/* assets/js/events.js
   Stabilité — Diagramme type "nucléide"
   - MicroPoints: 30
   - Trail length : 60
   - Play/Pause + timeline + filters
   - Uses window.IndoorAPI.fetchHistory(sec)
*/

const MICRO_POINTS = 30;
const TRAIL_LENGTH = 60;
const FPS = 6; // frames per second (animation rate)
const FRAME_INTERVAL_MS = Math.round(1000 / FPS);

const STABILITY_COLORS = {
  stable: "rgba(34,197,94,0.12)",    // vert doux
  alert:  "rgba(250,204,21,0.12)",   // orange doux
  unstable:"rgba(239,68,68,0.12)"    // rouge doux
};
const POINT_COLORS = { stable: "#16a34a", alert: "#f59e0b", unstable: "#ef4444" };
const TRAIL_BASE_COLOR = "rgba(59,130,246,0.25)";

let stabilityChart = null;
let frames = [];            // array of frames { ts, GAQI, GEI, SRI, TCI }
let currentFrameIndex = 0;
let animating = false;
let animationTimeout = null;

// ---------- Utilitaires ----------
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// Seeded PRNG to keep micro-points deterministic per frame
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Generate micropoints around a center (gaqi, gei) deterministic per frame
function generateMicroPoints(center, n, seedVal) {
  const rnd = mulberry32(seedVal);
  const arr = [];
  for (let i=0;i<n;i++){
    // small relative jitter
    const jitterGAQI = (rnd() - 0.5) * 2 * 1.5; // ±1.5 GAQI units
    const jitterGEI  = (rnd() - 0.5) * 2 * 1.5; // ±1.5 GEI units
    arr.push({
      x: clamp(center.x + jitterGAQI, 0, 100),
      y: clamp(center.y + jitterGEI, 0, 100),
      sri: center.sri,
      tci: center.tci,
      ts: center.ts
    });
  }
  return arr;
}

// Simple classification by combined score (for point color)
function classifyPoint(frame) {
  // combine normalized indices (0..1)
  const g = clamp(frame.GAQI != null ? frame.GAQI/100 : 1, 0, 1);
  const e = clamp(frame.GEI  != null ? frame.GEI/100  : 1, 0, 1);
  const s = clamp(frame.SRI  != null ? frame.SRI/100  : 1, 0, 1);
  const t = clamp(frame.TCI  != null ? frame.TCI/100  : 1, 0, 1);
  // lower overall => worse; we invert to get "instability score"
  const global = (g + e + s + t) / 4; // 0..1 (1 best)
  const instability = 1 - global;
  if (instability > 0.55) return "unstable";
  if (instability > 0.25) return "alert";
  return "stable";
}

// Compute overlay color according to combined index
function overlayColorForFrame(frame) {
  const g = clamp(frame.GAQI != null ? frame.GAQI : 100, 0, 100);
  const e = clamp(frame.GEI  != null ? frame.GEI  : 100, 0, 100);
  const s = clamp(frame.SRI  != null ? frame.SRI : 100, 0, 100);
  const t = clamp(frame.TCI  != null ? frame.TCI : 100, 0, 100);
  const global = (g + e + s + t) / 4; // 0..100
  if (global >= 85) return STABILITY_COLORS.stable;
  if (global >= 60) return STABILITY_COLORS.alert;
  return STABILITY_COLORS.unstable;
}

// ---------- Data loading ----------
async function loadFramesFromHistory(sec = 1800) {
  try {
    const resp = await window.IndoorAPI.fetchHistory(sec);
    if (!resp || !Array.isArray(resp.series) || resp.series.length === 0) {
      console.warn("events.js: aucune frame dans l'historique");
      return [];
    }

    // we expect each entry to optionally include entry.indices
    const out = resp.series.map((entry, idx) => {
      const ts = entry.timestamp || (new Date()).toISOString();
      // Prefer server-computed indices if they exist; otherwise skip this entry
      const idxs = entry.indices;
      if (!idxs) {
        // If indices missing, skip to avoid misleading points.
        // (Alternative: compute approximate indices here — avoided for now)
        return null;
      }
      return {
        ts,
        GAQI: Number.isFinite(idxs.GAQI) ? idxs.GAQI : null,
        GEI:  Number.isFinite(idxs.GEI)  ? idxs.GEI  : null,
        SRI:  Number.isFinite(idxs.SRI)  ? idxs.SRI  : null,
        TCI:  Number.isFinite(idxs.TCI)  ? idxs.TCI  : null
      };
    }).filter(Boolean);

    if (out.length === 0) {
      console.warn("events.js: frames exist but none had indices -> empty frames");
    } else {
      console.info(`events.js: loaded ${out.length} frames (with indices)`);
    }
    return out;
  } catch (err) {
    console.error("events.js: Erreur historique :", err);
    return [];
  }
}

// ---------- Chart background (zones + overlay) ----------
function drawBackground(ctx, chart, overlayColor) {
  const { left, right, top, bottom } = chart.chartArea;
  const width = right - left;
  const height = bottom - top;
  ctx.save();

  // Nucleide zones: top-left stable (GAQI high / GEI low), top-right alert, bottom full unstable
  // We'll draw three rectangles like your previous design:
  // stable: left-top quadrant
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, width * 0.5, height * 0.5);

  // alert: right-top quadrant
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left + width * 0.5, top, width * 0.5, height * 0.5);

  // unstable: bottom half
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top + height * 0.5, width, height * 0.5);

  // overlay dynamic (semi-transparent) - full rect
  if (overlayColor) {
    ctx.fillStyle = overlayColor;
    ctx.fillRect(left, top, width, height);
  }

  ctx.restore();
}

// ---------- Render / datasets ----------
function buildDatasetsForFrame(index, tciMin, tciMax, sriMin, sriMax) {
  // Accept index in frames[] and produce three datasets:
  // - trail dataset (points from last TRAIL_LENGTH frames)
  // - micro dataset (MICRO_POINTS near current)
  // - main dataset (single central point)
  const nFrames = frames.length;
  if (nFrames === 0) return { datasets: [], overlayColor: null };

  const frame = frames[index];
  // center point for this frame:
  const center = { x: frame.GAQI ?? 0, y: frame.GEI ?? 0, sri: frame.SRI ?? 0, tci: frame.TCI ?? 0, ts: frame.ts };

  // Build trail frames (previous frames including current)
  const trail = [];
  for (let i = Math.max(0, index - TRAIL_LENGTH + 1); i <= index; i++) {
    const f = frames[i];
    if (!f) continue;
    trail.push({ x: f.GAQI, y: f.GEI, sri: f.SRI, tci: f.TCI, ts: f.ts });
  }

  // Build micropoints (deterministic seeded by timestamp)
  // seed: convert timestamp string to integer
  const seedVal = center.ts ? center.ts.split("").reduce((s,c)=> s*31 + c.charCodeAt(0), 0) : index;
  const micro = generateMicroPoints(center, MICRO_POINTS, seedVal);

  // Apply filters (TCI/SRI) to all point collections
  function keep(p){
    return p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax;
  }
  const trailFiltered = trail.filter(keep);
  const microFiltered = micro.filter(keep);
  const mainFiltered = keep(center) ? [center] : [];

  // Trail dataset: we'll produce arrays of point objects & visual arrays (alpha decreasing)
  const trailData = trailFiltered.map((p, idx) => ({ x: p.x, y: p.y, extra: p }));
  // Per-point radii & colors for trail (older = smaller & more transparent)
  const trailCount = trailFiltered.length;
  const trailBackgrounds = trailFiltered.map((p, i) => {
    // t: 0 (oldest) -> 1 (latest)
    const t = (i + 1) / trailCount;
    const alpha = 0.08 + 0.25 * t;
    return `rgba(59,130,246,${alpha.toFixed(3)})`;
  });
  const trailRadii = trailFiltered.map((p, i) => {
    const t = (i + 1) / trailCount;
    return 2 + Math.round(4 * t); // 2..6
  });

  // Micro dataset
  const microData = microFiltered.map(p => ({ x: p.x, y: p.y, extra: p }));
  const microBackgrounds = microFiltered.map(p => {
    // classify by combined score relative to point center
    const score = Math.sqrt((p.x/100)**2 + (p.y/100)**2 + (p.tci/100)**2 + (p.sri/100)**2);
    if (score > 0.75) return POINT_COLORS.unstable + "77";
    if (score > 0.5) return POINT_COLORS.alert + "77";
    return POINT_COLORS.stable + "77";
  });
  const microRadii = microFiltered.map(()=> 2);

  // Main dataset (single)
  const mainData = mainFiltered.map(p => ({ x: p.x, y: p.y, extra: p }));
  const mainBG = mainFiltered.map(p => {
    const cls = classifyPoint({ GAQI: p.x, GEI: p.y, SRI: p.sri, TCI: p.tci });
    return POINT_COLORS[cls];
  });
  const mainRadii = mainFiltered.map(()=> 7);

  const overlayColor = overlayColorForFrame(center);

  // Compose Chart.js dataset objects; Chart.js accepts arrays for pointBackgroundColor and pointRadius
  const datasets = [];

  // Trail dataset (draw first, behind)
  if (trailData.length) {
    datasets.push({
      label: 'Trail',
      data: trailData,
      pointBackgroundColor: trailBackgrounds,
      pointBorderColor: trailBackgrounds,
      pointRadius: trailRadii,
      showLine: false
    });
  }

  // Micro cloud
  if (microData.length) {
    datasets.push({
      label: 'Micro cloud',
      data: microData,
      pointBackgroundColor: microBackgrounds,
      pointBorderColor: microBackgrounds,
      pointRadius: microRadii,
      showLine: false
    });
  }

  // Main point
  if (mainData.length) {
    datasets.push({
      label: 'Current',
      data: mainData,
      pointBackgroundColor: mainBG,
      pointBorderColor: mainBG,
      pointRadius: mainRadii,
      showLine: false
    });
  }

  return { datasets, overlayColor };
}

// ---------- Render chart (create / update) ----------
function renderChartForIndex(index, tciMin = 0, tciMax = 100, sriMin = 0, sriMax = 100) {
  if (!frames.length) return;

  // Build datasets
  const { datasets, overlayColor } = buildDatasetsForFrame(index, tciMin, tciMax, sriMin, sriMax);

  // Ensure canvas container has fixed height to avoid Chart.js resizing loop
  const canvas = document.getElementById("stabilityChart");
  if (!canvas) {
    console.error("events.js: canvas #stabilityChart introuvable");
    return;
  }
  if (canvas.parentElement && canvas.parentElement.classList) {
    canvas.parentElement.style.position = "relative";
    canvas.parentElement.style.height = canvas.parentElement.style.height || "500px";
  }

  // Destroy previous chart, build new
  if (stabilityChart) {
    try { stabilityChart.destroy(); } catch(e){ /* ignore */ }
  }

  const ctx = canvas.getContext("2d");

  stabilityChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { type: 'linear', min: 0, max: 100, title: { display: true, text: 'GAQI' } },
        y: { type: 'linear', min: 0, max: 100, title: { display: true, text: 'GEI' } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra || {};
              return `GAQI: ${Number(p.x||0).toFixed(1)}, GEI: ${Number(p.y||0).toFixed(1)}, SRI: ${Number(p.sri||0).toFixed(1)}, TCI: ${Number(p.tci||0).toFixed(1)}`;
            }
          }
        }
      }
    },
    plugins: [{
      id: 'nucleideBackground',
      beforeDraw(chart) {
        drawBackground(chart.ctx, chart, overlayColor);
      }
    }]
  });

  // update legend info
  updateLegendInfo(index);
}

// Legend HTML update
function updateLegendInfo(index) {
  const box = document.getElementById("stabilityLegend");
  if (!box) return;
  const f = frames[index];
  if (!f) return;
  const global = Math.round(((f.GAQI||0) + (f.GEI||0) + (f.SRI||0) + (f.TCI||0)) / 4);
  box.innerHTML = `
    <strong>Légende :</strong><br>
    - Fond : zones stable / alerte / instable (nucléide).<br>
    - Surcouche : état global = <strong>${global}</strong> (vert/orange/rouge).<br>
    - Points : <span style="color:${POINT_COLORS.stable}">stable</span>,
               <span style="color:${POINT_COLORS.alert}">alerte</span>,
               <span style="color:${POINT_COLORS.unstable}">instable</span>.<br>
    - MicroPoints = ${MICRO_POINTS}, Trail = ${TRAIL_LENGTH} (frames).
  `;
}

// ---------- Animation controls ----------
function scheduleNextFrame() {
  // clear old timeout
  if (animationTimeout) clearTimeout(animationTimeout);
  animationTimeout = setTimeout(() => {
    // advance
    currentFrameIndex = (currentFrameIndex + 1) % frames.length;
    // update slider & UI
    const slider = document.getElementById("timeSlider");
    if (slider) slider.value = currentFrameIndex;
    // render
    const tciMin = parseFloat(document.getElementById("tciMin")?.value || "0");
    const tciMax = parseFloat(document.getElementById("tciMax")?.value || "100");
    const sriMin = parseFloat(document.getElementById("sriMin")?.value || "0");
    const sriMax = parseFloat(document.getElementById("sriMax")?.value || "100");
    renderChartForIndex(currentFrameIndex, tciMin, tciMax, sriMin, sriMax);

    if (animating) scheduleNextFrame();
  }, FRAME_INTERVAL_MS);
}

function togglePlayPause() {
  animating = !animating;
  const btn = document.getElementById("playPauseBtn");
  if (btn) btn.textContent = animating ? "Pause" : "Play";
  if (animating) scheduleNextFrame();
  else if (animationTimeout) clearTimeout(animationTimeout);
}

// ---------- Hook up UI (create controls if missing) ----------
function ensureControlsExist() {
  const filters = document.getElementById("filters");
  if (!filters) {
    console.warn("events.js: #filters introuvable, création dynamique dans body");
    const f = document.createElement("div");
    f.id = "filters";
    document.querySelector("main")?.prepend(f);
  }

  // create play/pause + slider + legend area
  const container = document.getElementById("filters");

  // If play button doesn't exist, create controls
  if (!document.getElementById("playPauseBtn")) {
    const playBtn = document.createElement("button");
    playBtn.id = "playPauseBtn";
    playBtn.type = "button";
    playBtn.textContent = "Play";
    playBtn.style.marginRight = "8px";
    playBtn.addEventListener("click", togglePlayPause);
    container.appendChild(playBtn);
  }

  if (!document.getElementById("timeSlider")) {
    const slider = document.createElement("input");
    slider.id = "timeSlider";
    slider.type = "range";
    slider.min = "0";
    slider.max = Math.max(0, frames.length - 1);
    slider.value = "0";
    slider.style.width = "320px";
    slider.addEventListener("input", (e) => {
      // pause on manual move
      if (animating) {
        animating = false;
        document.getElementById("playPauseBtn").textContent = "Play";
        if (animationTimeout) clearTimeout(animationTimeout);
      }
      currentFrameIndex = parseInt(e.target.value, 10) || 0;
      const tciMin = parseFloat(document.getElementById("tciMin")?.value || "0");
      const tciMax = parseFloat(document.getElementById("tciMax")?.value || "100");
      const sriMin = parseFloat(document.getElementById("sriMin")?.value || "0");
      const sriMax = parseFloat(document.getElementById("sriMax")?.value || "100");
      renderChartForIndex(currentFrameIndex, tciMin, tciMax, sriMin, sriMax);
    });
    container.appendChild(slider);
  } else {
    // update slider range
    const s = document.getElementById("timeSlider");
    s.max = Math.max(0, frames.length - 1);
  }

  // ensure applyFilters button exists (some pages already have it); if not create one
  if (!document.getElementById("applyFilters")) {
    const btn = document.createElement("button");
    btn.id = "applyFilters";
    btn.textContent = "Appliquer filtres";
    btn.style.marginLeft = "8px";
    btn.addEventListener("click", () => {
      currentFrameIndex = 0;
      renderChartForIndex(currentFrameIndex,
        parseFloat(document.getElementById("tciMin")?.value || "0"),
        parseFloat(document.getElementById("tciMax")?.value || "100"),
        parseFloat(document.getElementById("sriMin")?.value || "0"),
        parseFloat(document.getElementById("sriMax")?.value || "100")
      );
    });
    container.appendChild(btn);
  }
}

// ---------- Init ----------
async function init() {
  try {
    // Load frames
    frames = await loadFramesFromHistory(1800);

    if (!frames.length) {
      console.warn("events.js: aucune frame chargée (frames.length === 0)");
      // still setup controls to avoid UI break
      ensureControlsExist();
      updateLegendInfo(0);
      return;
    }

    // Fix slider max
    ensureControlsExist();
    const slider = document.getElementById("timeSlider");
    if (slider) {
      slider.max = Math.max(0, frames.length - 1);
      slider.value = 0;
    }

    // If filters fields are missing, ensure they exist
    if (!document.getElementById("tciMin")) {
      // create defaults in filters container
      const container = document.getElementById("filters");
      const mk = (id, label, def) => {
        const lbl = document.createElement("label");
        lbl.style.marginLeft = "8px";
        lbl.innerHTML = `${label}: <input id="${id}" type="number" value="${def}" min="0" max="100" step="1" style="width:64px; margin-left:4px;">`;
        return lbl;
      };
      container.appendChild(mk("tciMin", "TCI min", 0));
      container.appendChild(mk("tciMax", "TCI max", 100));
      container.appendChild(mk("sriMin", "SRI min", 0));
      container.appendChild(mk("sriMax", "SRI max", 100));
    }

    // Setup play button state & legend
    document.getElementById("playPauseBtn").textContent = "Play";
    updateLegendInfo(0);

    // Render first frame and attach handlers
    renderChartForIndex(0,
      parseFloat(document.getElementById("tciMin")?.value || "0"),
      parseFloat(document.getElementById("tciMax")?.value || "100"),
      parseFloat(document.getElementById("sriMin")?.value || "0"),
      parseFloat(document.getElementById("sriMax")?.value || "100")
    );

    // attach applyFilters if present (redundant safe)
    const applyBtn = document.getElementById("applyFilters");
    if (applyBtn) applyBtn.addEventListener("click", () => {
      currentFrameIndex = 0;
      renderChartForIndex(0,
        parseFloat(document.getElementById("tciMin")?.value || "0"),
        parseFloat(document.getElementById("tciMax")?.value || "100"),
        parseFloat(document.getElementById("sriMin")?.value || "0"),
        parseFloat(document.getElementById("sriMax")?.value || "100")
      );
    });

  } catch (err) {
    console.error("events.js init error:", err);
  }
}

// Kick off on load
window.addEventListener("load", init);

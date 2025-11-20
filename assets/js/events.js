/* assets/js/events.js
   Stabilité — rendu Canvas composite (halo + organique + anneau)
   - Utilise window.IndoorAPI.fetchHistory(sec)
   - Requiert dans le DOM :
     #stabilityChart (canvas), #playPauseBtn, #timeline, #tciMin, #tciMax, #sriMin, #sriMax, #applyFilters, #stabilityLegend
*/

(() => {
  // ---------------------------
  // Config
  // ---------------------------
  const MICRO_POINTS = 30;     // micro-points par frame (petits marqueurs statiques autour du main point)
  const TRAIL_LENGTH = 60;     // nombre de frames à garder dans la traînée
  const FRAME_MS = 400;        // délai visible entre frames si play (ms)
  const FPS_TARGET = 60;       // pour calculations (nous utiliserons requestAnimationFrame)
  const HALO_BASE_RADIUS = 22; // halo principal (px)
  const NUCLEUS_RADIUS = 6;    // noyau intérieur (px)
  const TRAIL_STEP = 6;        // taille décroissante par pas de trail
  const STATUS_COLORS = {
    stable: "#16a34a",
    alert: "#f59e0b",
    unstable: "#ef4444"
  };

  // ---------------------------
  // State
  // ---------------------------
  let frames = [];         // tableau de "frames" — chaque frame est un objet {x:GAQI,y:GEI,tci,sri,ts}
  let currentFrame = 0;
  let animating = false;
  let lastTick = 0;
  let rafId = null;

  // Canvas & sizing
  const canvas = document.getElementById("stabilityChart");
  if (!canvas) {
    console.error("stabilityChart canvas introuvable");
    return;
  }
  const ctx = canvas.getContext("2d");

  // Controls
  const playBtn = document.getElementById("playPauseBtn");
  const timeline = document.getElementById("timeline");
  const tciMinInput = document.getElementById("tciMin");
  const tciMaxInput = document.getElementById("tciMax");
  const sriMinInput = document.getElementById("sriMin");
  const sriMaxInput = document.getElementById("sriMax");
  const applyFiltersBtn = document.getElementById("applyFilters");
  const legendBox = document.getElementById("stabilityLegend");

  // Drawing helpers
  function resizeCanvas() {
    // Use devicePixelRatio for crispness
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, Math.floor(rect.width * dpr));
    canvas.height = Math.max(200, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", () => {
    resizeCanvas();
    drawFrame(); // redraw immediately
  });

  // ---------------------------
  // Data ingestion: build frames from history
  // ---------------------------
  async function loadFramesFromHistory(sec = 1800) {
    try {
      const res = await window.IndoorAPI.fetchHistory(sec);
      if (!res || !Array.isArray(res.series) || res.series.length === 0) return [];

      // Each series entry is a single timestamp with measures + maybe indices
      // We create a frame per entry. For micro-points, we jitter a bit around the frame main point.
      return res.series.map(entry => {
        const indices = entry.indices || {};
        const GAQI = Number(indices.GAQI ?? 0);
        const GEI = Number(indices.GEI ?? 0);
        const SRI = Number(indices.SRI ?? 0);
        const TCI = Number(indices.TCI ?? 0);

        // timestamp fallback
        const ts = entry.timestamp || new Date().toISOString();

        return { x: GAQI, y: GEI, sri: SRI, tci: TCI, ts };
      });
    } catch (err) {
      console.error("Erreur historique :", err);
      return [];
    }
  }

  // ---------------------------
  // Utility: status + color + mixed color helpers
  // ---------------------------
  function computeScore(frame) {
    // normalized sqrt of (SRI, GAQI, GEI, TCI) ; all in [0,100]
    const a = (frame.sri || 0) / 100;
    const b = (frame.x || 0) / 100; // GAQI
    const c = (frame.y || 0) / 100; // GEI
    const d = (frame.tci || 0) / 100;
    return Math.sqrt(a*a + b*b + c*c + d*d) / 2; // normalized roughly 0..1
  }

  function statusFromScore(score) {
    if (score > 0.75) return "unstable";
    if (score > 0.5) return "alert";
    return "stable";
  }

  // color interpolation rgb
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const bigint = parseInt(h, 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  }
  function mixRgb(rgbA, rgbB, t) {
    return [
      Math.round(rgbA[0] * (1 - t) + rgbB[0] * t),
      Math.round(rgbA[1] * (1 - t) + rgbB[1] * t),
      Math.round(rgbA[2] * (1 - t) + rgbB[2] * t)
    ];
  }
  function rgbToCss(rgb, a=1) { return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`; }

  // build color for a frame: blend GAQI (x) color + TCI color + stability
  function colorForFrame(frame, recencyFactor=1) {
    // recencyFactor in [0,1] (1 = most recent)
    const status = statusFromScore(computeScore(frame));
    const statusColor = STATUS_COLORS[status];
    const gaqiColor = "#3498db"; // blue base for GAQI (you can change)
    const tciColor = "#e67e22";  // orange base for TCI

    const ga = hexToRgb(gaqiColor);
    const tc = hexToRgb(tciColor);
    const st = hexToRgb(statusColor);

    // mix GAQI & TCI by weights (GAQI heavier)
    const mix = mixRgb(ga, tc, 0.45);
    // then tint towards status color a bit
    const final = mixRgb(mix, st, 0.25);

    // alpha influenced by recency
    const alpha = 0.35 + 0.65 * Math.min(1, Math.max(0, recencyFactor));
    return rgbToCss(final, alpha);
  }

  // ---------------------------
  // Rendering core
  // ---------------------------
  function clearCanvas() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
  }

  function drawBackgroundGrid() {
    // simple subtle grid and diagonal nuclear zones variant A (4 diagonals)
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);

    // subtle grid
    ctx.strokeStyle = "rgba(0,0,0,0.04)";
    ctx.lineWidth = 1;
    const step = 50;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // 4 zones diagonales (nucléide-like) — draw translucent quadrants
    // Map GAQI (x axis) 0..100 to canvas width; GEI (y axis) 0..100 to canvas height (inverted)
    function zoneRect(x0Pct, y0Pct, x1Pct, y1Pct, color) {
      ctx.fillStyle = color;
      const left = x0Pct * w, top = (1 - y1Pct) * h;
      const width = (x1Pct - x0Pct) * w;
      const height = (y1Pct - y0Pct) * h;
      ctx.fillRect(left, top, width, height);
    }

    // Zones: top-left stable (green), top-right alert (orange), bottom-left alert, bottom-right unstable (red)
    zoneRect(0, 0.5, 0.5, 1, "rgba(16,163,74,0.06)");  // top-left (GAQI low, GEI high) - stable (soft)
    zoneRect(0.5, 0.5, 1, 1, "rgba(245,158,11,0.06)"); // top-right
    zoneRect(0, 0, 0.5, 0.5, "rgba(245,158,11,0.04)"); // bottom-left
    zoneRect(0.5, 0, 1, 0.5, "rgba(239,68,68,0.06)");  // bottom-right (unstable)
    ctx.restore();
  }

  // Transform domain GAQI/GEI (0..100) to canvas coords
  function toCanvasXY(gx, gy) {
    const pad = 28; // margin
    const w = canvas.clientWidth - pad * 2;
    const h = canvas.clientHeight - pad * 2;
    const x = pad + (gx / 100) * w;
    const y = pad + (1 - gy / 100) * h; // invert y (GEI high -> top)
    return { x, y };
  }

  // Draw a single composite point (1 + 3 + 5 combined):
  // - halo (soft radial)
  // - outer ring colored by GAQI
  // - nucleus organique inside with subtle pulsation
  // - micro-points around (optional) (static for readability)
  function drawCompositePoint(frame, recencyFactor = 1, trailIndex = -1) {
    const pos = toCanvasXY(frame.x || 0, frame.y || 0);
    const score = computeScore(frame);
    const status = statusFromScore(score);
    const statusColor = STATUS_COLORS[status];

    // sizes influenced by recencyFactor and trailIndex
    const baseRadius = HALO_BASE_RADIUS * (0.6 + 0.8 * recencyFactor);
    const nucleus = NUCLEUS_RADIUS * (0.6 + 1.4 * recencyFactor);
    const ringWidth = 3 + 3 * recencyFactor;

    // halo (soft radial)
    const haloGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, baseRadius);
    const haloRgb = hexToRgb(statusColor);
    haloGrad.addColorStop(0, `rgba(${haloRgb[0]},${haloRgb[1]},${haloRgb[2]},${0.22 * recencyFactor})`);
    haloGrad.addColorStop(1, `rgba(${haloRgb[0]},${haloRgb[1]},${haloRgb[2]},0)`);
    ctx.beginPath();
    ctx.fillStyle = haloGrad;
    ctx.arc(pos.x, pos.y, baseRadius, 0, Math.PI * 2);
    ctx.fill();

    // outer ring: color blend GAQI|TCI
    const ringColor = colorForFrame(frame, recencyFactor);
    ctx.beginPath();
    ctx.lineWidth = ringWidth;
    ctx.strokeStyle = ringColor;
    ctx.arc(pos.x, pos.y, nucleus + ringWidth + 2, 0, Math.PI * 2);
    ctx.stroke();

    // nucleus organique: radial glossy + pulsation (based on fractional second)
    const t = (Date.now() % 1000) / 1000;
    const pulse = 1 + 0.08 * Math.sin(2 * Math.PI * t * (0.6 + recencyFactor));
    const innerR = nucleus * pulse;

    // draw nucleus gradient
    const innerGrad = ctx.createRadialGradient(pos.x - innerR*0.3, pos.y - innerR*0.3, innerR*0.1, pos.x, pos.y, innerR);
    const innerRgb = hexToRgb(statusColor);
    innerGrad.addColorStop(0, `rgba(${innerRgb[0]},${innerRgb[1]},${innerRgb[2]},${0.95})`);
    innerGrad.addColorStop(1, `rgba(${innerRgb[0]},${innerRgb[1]},${innerRgb[2]},${0.35})`);
    ctx.beginPath();
    ctx.fillStyle = innerGrad;
    ctx.arc(pos.x, pos.y, innerR, 0, Math.PI*2);
    ctx.fill();

    // micro-points: slight static scatter around main point
    const microCount = Math.max(0, Math.floor(MICRO_POINTS * 0.25)); // fewer to keep clarity
    for (let i = 0; i < microCount; i++) {
      const ang = (i / microCount) * Math.PI * 2;
      const radius = (nucleus + 6) + (i % 4) * 1.5;
      const mx = pos.x + Math.cos(ang + i) * radius * (0.7 + Math.sin(i) * 0.03);
      const my = pos.y + Math.sin(ang + i) * radius * (0.7 + Math.cos(i) * 0.03);
      ctx.beginPath();
      ctx.fillStyle = `rgba(${haloRgb[0]},${haloRgb[1]},${haloRgb[2]},${0.22 * recencyFactor})`;
      ctx.arc(mx, my, 1.2, 0, Math.PI*2);
      ctx.fill();
    }

    // optionally label recent point with small timestamp or score
    if (recencyFactor > 0.95) {
      ctx.font = "12px Inter, Arial";
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillText(`${Math.round(frame.x)}/${Math.round(frame.y)}`, pos.x + nucleus + 6, pos.y - nucleus - 6);
    }
  }

  // Draw trail: previous frames with decreasing size/opacity
  function drawTrail(centerFrameIndex) {
    // draw last TRAIL_LENGTH frames up to centerFrameIndex
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const idx = (centerFrameIndex - i + frames.length) % frames.length;
      if (idx < 0 || idx >= frames.length) continue;
      const frame = frames[idx];
      const recencyFactor = 1 - (i / TRAIL_LENGTH); // 1 = newest
      if (!frame) continue;
      // filter by tci/sri
      const tciMin = parseFloat(tciMinInput?.value || 0);
      const tciMax = parseFloat(tciMaxInput?.value || 100);
      const sriMin = parseFloat(sriMinInput?.value || 0);
      const sriMax = parseFloat(sriMaxInput?.value || 100);
      if (frame.tci < tciMin || frame.tci > tciMax || frame.sri < sriMin || frame.sri > sriMax) continue;

      // draw composite point but smaller for older items
      ctx.save();
      ctx.globalAlpha = 0.85 * (0.9 * recencyFactor);
      drawCompositePoint(frame, recencyFactor, i);
      ctx.restore();
    }
  }

  // Full render for currentFrame
  function drawFrame() {
    if (!frames.length) {
      clearCanvas();
      drawBackgroundGrid();
      // legend placeholder
      return;
    }
    resizeCanvas();
    clearCanvas();
    drawBackgroundGrid();

    // draw trail then main point
    drawTrail(currentFrame);

    // main current frame
    const mainFrame = frames[currentFrame];
    if (mainFrame) {
      drawCompositePoint(mainFrame, 1, -1);
    }

    // update legend and timeline
    updateLegend();
    updateTimelineUI();
  }

  // ---------------------------
  // UI helpers
  // ---------------------------
  function updateTimelineUI() {
    if (!timeline) return;
    timeline.max = Math.max(0, frames.length - 1);
    timeline.value = Math.min(Math.max(0, currentFrame), frames.length - 1);
  }

  function updateLegend() {
    if (!legendBox) return;
    // counts in visible (after current filters)
    const tciMin = parseFloat(tciMinInput?.value || 0);
    const tciMax = parseFloat(tciMaxInput?.value || 100);
    const sriMin = parseFloat(sriMinInput?.value || 0);
    const sriMax = parseFloat(sriMaxInput?.value || 100);

    let counts = { stable: 0, alert: 0, unstable: 0 };
    // count across a sample of frames (recent window)
    const sampleN = Math.min(frames.length, 300);
    const start = Math.max(0, frames.length - sampleN);
    for (let i = start; i < frames.length; i++) {
      const f = frames[i];
      if (!f) continue;
      if (f.tci < tciMin || f.tci > tciMax || f.sri < sriMin || f.sri > sriMax) continue;
      const s = statusFromScore(computeScore(f));
      counts[s]++;
    }

    legendBox.innerHTML = `
      <div><strong>Légende :</strong></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:12px;height:12px;background:${STATUS_COLORS.stable};border-radius:2px"></div>
          <div>Stable (${counts.stable})</div>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:12px;height:12px;background:${STATUS_COLORS.alert};border-radius:2px"></div>
          <div>Alerte (${counts.alert})</div>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <div style="width:12px;height:12px;background:${STATUS_COLORS.unstable};border-radius:2px"></div>
          <div>Instable (${counts.unstable})</div>
        </div>
      </div>
      <div style="margin-top:8px;font-size:0.9em;color:#444;">
        Points = GAQI/GEI ; Anneau = GAQI/TCI mix ; Noyau = état (pulsant). Halo = stabilité.
      </div>
    `;
  }

  // ---------------------------
  // Animation loop
  // ---------------------------
  function step(time) {
    if (!lastTick) lastTick = time;
    const dt = time - lastTick;
    if (animating) {
      // progress according to FRAME_MS
      if (dt >= FRAME_MS) {
        currentFrame = (currentFrame + 1) % frames.length;
        lastTick = time;
        drawFrame();
      }
    }
    rafId = requestAnimationFrame(step);
  }

  // ---------------------------
  // Controls handlers
  // ---------------------------
  function togglePlayPause() {
    animating = !animating;
    if (playBtn) playBtn.textContent = animating ? "Pause" : "Play";
    // reset lastTick to avoid big jump
    lastTick = performance.now();
    if (!rafId) rafId = requestAnimationFrame(step);
  }

  function setFrameFromSlider(val) {
    const v = Number(val);
    if (Number.isFinite(v) && frames.length) {
      currentFrame = Math.max(0, Math.min(frames.length - 1, v));
      drawFrame();
    }
  }

  // Apply filters: just redraw current frame with filter application in drawing functions
  function applyFilters() {
    drawFrame();
  }

  // ---------------------------
  // Bootstrap: load frames + wire UI
  // ---------------------------
  async function init() {
    try {
      resizeCanvas();
      // load frames
      frames = await loadFramesFromHistory(1800);

      // if frames have length small, consider expanding micropoints from measures
      if (!frames || frames.length === 0) {
        console.warn("Aucune frame chargée !");
        // still draw background
        drawBackgroundGrid();
        updateLegend();
        return;
      }

      // clamp timeline
      if (timeline) {
        timeline.max = Math.max(0, frames.length - 1);
        timeline.min = 0;
        timeline.value = 0;
        // slider events
        timeline.addEventListener("input", (e) => {
          // pause on manual input
          animating = false;
          if (playBtn) playBtn.textContent = "Play";
          setFrameFromSlider(e.target.value);
        });
      }

      // play button
      if (playBtn) playBtn.addEventListener("click", () => {
        togglePlayPause();
      });

      if (applyFiltersBtn) applyFiltersBtn.addEventListener("click", () => {
        animating = false;
        if (playBtn) playBtn.textContent = "Play";
        applyFilters();
      });

      // initial draw
      drawFrame();

      // kick raf
      if (!rafId) rafId = requestAnimationFrame(step);
    } catch (err) {
      console.error("init stability error:", err);
    }
  }

  // Start
  window.addEventListener("load", init);

  // expose some for debug
  window._stabilityFrames = frames;
})();

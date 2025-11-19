/* assets/js/events.js
   Stability / "nucléide" page - animation + heatmap + timeline + real API
   Expects window.IndoorAPI.fetchHistory(sec) -> { requested_sec, length, series: [ { timestamp, measures:{...}, indices? } ] }
*/

(function () {
  // --- constants / palette ---
  const STABILITY_COLORS = {
    stable: "rgba(34,197,94,0.15)",
    alert: "rgba(249,115,22,0.12)",
    unstable: "rgba(239,68,68,0.12)",
  };
  const POINT_COLORS = { stable: "#059669", alert: "#f97316", unstable: "#ef4444" };

  // animation / state
  let stabilityChart = null;
  let frames = []; // each frame: {ts, gaqi, gei, sri, tci, score, status}
  let frameIndex = 0;
  let playing = true;
  let rafId = null;
  let playInterval = 600; // ms between frames (adjustable)
  let lastTick = 0;
  let useHeatmap = false;

  // Chart.js plugin to draw background zones and (optionally) heatmap overlay
  const backgroundPlugin = {
    id: "backgroundPlugin",
    beforeDraw(chart, args, options) {
      const ctx = chart.ctx;
      const area = chart.chartArea;
      if (!area) return;

      // draw stability zones (nucléide style)
      ctx.save();
      // stable zone: top-left quadrant
      ctx.fillStyle = STABILITY_COLORS.stable;
      ctx.fillRect(area.left, area.top, (area.right - area.left) * 0.5, (area.bottom - area.top) * 0.5);
      // alert zone: top-right
      ctx.fillStyle = STABILITY_COLORS.alert;
      ctx.fillRect(area.left + (area.right - area.left) * 0.5, area.top, (area.right - area.left) * 0.5, (area.bottom - area.top) * 0.5);
      // unstable zone: bottom half
      ctx.fillStyle = STABILITY_COLORS.unstable;
      ctx.fillRect(area.left, area.top + (area.bottom - area.top) * 0.5, (area.right - area.left), (area.bottom - area.top) * 0.5);
      ctx.restore();

      // If heatmap mode is on and we have provided heatmap image in options.heatmapImage, draw it
      if (options && options.heatmapImage && useHeatmap) {
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.drawImage(options.heatmapImage, area.left, area.top, area.right - area.left, area.bottom - area.top);
        ctx.restore();
      }
    },
  };

  // --- utility math ---
  function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }
  function std(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) * (v - m), 0) / arr.length);
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function pearson(a, b) {
    if (!a.length || a.length !== b.length) return 0;
    const n = a.length;
    const ma = mean(a), mb = mean(b);
    let num = 0, da2 = 0, db2 = 0;
    for (let i = 0; i < n; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      num += da * db; da2 += da * da; db2 += db * db;
    }
    const den = Math.sqrt(da2 * db2);
    return den === 0 ? 0 : num / den;
  }

  // --- index calculations (client-side approximations) ---
  // TCI formula from your spec
  function computeTCI(temp, rh, pres) {
    // TCI = 100 - ( |Temp - 22| * 2.5 ) - ( |Humidity - 50| * 0.5 ) - ( |Pressure - 1013| * 0.02 )
    const t = 100 - Math.abs(temp - 22) * 2.5 - Math.abs(rh - 50) * 0.5 - Math.abs(pres - 1013) * 0.02;
    return clamp(t, 0, 100);
  }

  // AQ_penalty: aggregate simple penalties for CO2/NO2/NH3 relative to thresholds
  function computeAQPenalty(measures) {
    // thresholds (adjustable): below these are ideal
    const thresholds = {
      co2: { good: 600, bad: 1500 },
      no2: { good: 30, bad: 200 },
      nh3: { good: 0.005, bad: 0.08 }
    };
    let score = 0;
    // normalized each penalty 0..100
    const c02p = clamp((measures.co2 - thresholds.co2.good) / (thresholds.co2.bad - thresholds.co2.good), 0, 1) * 100;
    const no2p = clamp((measures.no2 - thresholds.no2.good) / (thresholds.no2.bad - thresholds.no2.good), 0, 1) * 100;
    const nh3p = clamp((measures.nh3 - thresholds.nh3.good) / (thresholds.nh3.bad - thresholds.nh3.good), 0, 1) * 100;
    // Weighted sum (CO2 more important)
    score = (c02p * 0.6 + no2p * 0.3 + nh3p * 0.1);
    return clamp(score, 0, 100); // 0 = perfect, 100 = very bad
  }

  // SRI: volatility penalty (stddev normalized)
  function computeSRI(historyWindow) {
    // we compute stddev of CO2, Temp, RH over the window and scale to 0..100 penalty
    if (!historyWindow || historyWindow.length < 2) return 100; // stable if no data
    const co2arr = historyWindow.map(s => s.measures.co2);
    const tarr = historyWindow.map(s => s.measures.temp);
    const harr = historyWindow.map(s => s.measures.rh);
    const sCo2 = std(co2arr);
    const sT = std(tarr);
    const sH = std(harr);
    // scale expected vol ranges (heuristic)
    const norm = (sCo2 / 50) * 0.5 + (sT / 1.5) * 0.3 + (sH / 7) * 0.2;
    // convert to stability index 0..100 (higher = more stable)
    const stability = clamp(100 - norm * 100, 0, 100);
    return stability;
  }

  // GEI: using correlation over a window for the two pairs (co2-no2, co-nh3)
  function computeGEI(historyWindow) {
    if (!historyWindow || historyWindow.length < 5) return 50; // unknown
    const co2 = historyWindow.map(s => s.measures.co2);
    const no2 = historyWindow.map(s => s.measures.no2);
    const co = historyWindow.map(s => s.measures.co);
    const nh3 = historyWindow.map(s => s.measures.nh3);
    const r1 = Math.abs(pearson(co2, no2)); // 0..1
    const r2 = Math.abs(pearson(co, nh3));
    // formula from your spec: GEI = 100 - |corr(CO2,NO2)|*40 - |corr(CO,NH3)|*40
    const gei = clamp(100 - r1 * 40 - r2 * 40, 0, 100);
    return gei;
  }

  // GAQI: combine AQ_penalty, Comfort_penalty (from TCI), Volatility_penalty (from volatility)
  function computeGAQI(aqPenalty, tci, sri) {
    // transform tci to comfort_penalty = 100 - TCI
    const comfortPenalty = 100 - tci;
    // volatility_penalty estimate = 100 - SRI
    const volPenalty = 100 - sri;
    const a1 = 0.4, a2 = 0.4, a3 = 0.2;
    const gaqi = clamp(100 - (a1 * (aqPenalty)) - (a2 * (comfortPenalty)) - (a3 * (volPenalty)), 0, 100);
    return gaqi;
  }

  // status based on combined score (we use GAQI, SRI)
  function computeStatus(gaqi, sri) {
    // mixing logic: stable = GAQI>70 and SRI>70, alert else if between, unstable if low
    if (gaqi > 70 && sri > 70) return "stable";
    if (gaqi > 50 || sri > 50) return "alert";
    return "unstable";
  }

  // --- heatmap rendering (simple canvas composite) ---
  function buildHeatmapImage(points, chart) {
    // points: array of {x: 0..100, y:0..100} in data coords
    // We'll render into an offscreen canvas and return an Image object
    const area = chart.chartArea;
    const w = Math.max(1, Math.floor(area.right - area.left));
    const h = Math.max(1, Math.floor(area.bottom - area.top));
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";

    // mapping data coords to canvas coords
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;

    // draw radial gradient circles
    const maxRadiusPx = Math.max(16, Math.min(w, h) * 0.06);
    for (let p of points) {
      const cx = xScale.getPixelForValue(p.x) - area.left;
      const cy = yScale.getPixelForValue(p.y) - area.top;
      // radial gradient
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadiusPx);
      // color based on status -> use stronger colors
      const col = POINT_COLORS[p.status] || "#999";
      g.addColorStop(0, hexToRgba(col, 0.6));
      g.addColorStop(0.4, hexToRgba(col, 0.25));
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadiusPx, 0, Math.PI * 2);
      ctx.fill();
    }

    const img = new Image();
    img.src = off.toDataURL("image/png");
    return img;
  }

  function hexToRgba(hex, alpha = 1) {
    // e.g. #rrggbb
    const m = hex.replace("#", "");
    const r = parseInt(m.substr(0, 2), 16);
    const g = parseInt(m.substr(2, 2), 16);
    const b = parseInt(m.substr(4, 2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // --- Build frames from history --- 
  // We map each index in history to a "frame" using a rolling window
  async function buildFramesFromHistory(secWindow = 1800, windowSizeSamples = 60) {
    // fetch a generous history (secWindow)
    const json = await window.IndoorAPI.fetchHistory(secWindow);
    const series = json.series || json || [];
    if (!series || !series.length) return [];

    // Ensure series sorted by time ascending
    series.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // build frames: for each index >= windowSizeSamples compute indices using last windowSizeSamples entries
    const framesLocal = [];
    for (let i = windowSizeSamples; i < series.length; i += 1) {
      const windowSlice = series.slice(Math.max(0, i - windowSizeSamples), i);
      const cur = series[i];
      const measures = cur.measures || cur;
      // compute indices (prefer server-supplied indices if present)
      const tci = cur.indices && cur.indices.TCI ? cur.indices.TCI : computeTCI(measures.temp, measures.rh, measures.pres);
      const sri = cur.indices && cur.indices.SRI ? cur.indices.SRI : computeSRI(windowSlice);
      const aqPenalty = cur.indices && cur.indices.AQ_penalty ? cur.indices.AQ_penalty : computeAQPenalty(measures);
      const gei = cur.indices && cur.indices.GEI ? cur.indices.GEI : computeGEI(windowSlice);
      const gaqi = cur.indices && cur.indices.GAQI ? cur.indices.GAQI : computeGAQI(aqPenalty, tci, sri);

      const stabilityScore = Math.sqrt(((sri / 100) ** 2 + (gaqi / 100) ** 2 + (gei / 100) ** 2 + (tci / 100) ** 2));
      const status = computeStatus(gaqi, sri);

      framesLocal.push({
        ts: cur.timestamp,
        measures,
        gaqi,
        aqPenalty,
        tci,
        sri,
        gei,
        score: stabilityScore,
        status
      });
    }

    return framesLocal;
  }

  // --- initialize Chart with empty dataset (we'll update) ---
  function initChart() {
    const ctx = document.getElementById("stabilityChart").getContext("2d");
    // fix canvas size to avoid responsive resizing glitches
    const canvas = ctx.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "500px";
    // Create initial chart
    stabilityChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "État environnemental",
            data: [], // {x:gaqi, y:gei, extra: frame}
            pointBackgroundColor: [],
            pointRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { title: { display: true, text: "GAQI" }, min: 0, max: 100 },
          y: { title: { display: true, text: "GEI" }, min: 0, max: 100 }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label(ctx) {
                const f = ctx.raw.extra;
                return `GAQI: ${f.gaqi.toFixed(1)}, GEI: ${f.gei.toFixed(1)}, SRI: ${f.sri.toFixed(1)}, TCI: ${f.tci.toFixed(1)}, Score: ${f.score.toFixed(2)}, État: ${f.status}`;
              }
            }
          },
          legend: { display: false },
          backgroundPlugin: {
            // reserved for heatmapImage - set dynamically
            heatmapImage: null
          }
        },
        interaction: { mode: "nearest", intersect: false }
      },
      plugins: [backgroundPlugin]
    });
  }

  // --- update chart with a set of points (array of frames) ---
  function updateChartWithPoints(pointFrames) {
    if (!stabilityChart) return;
    const ds = stabilityChart.data.datasets[0];
    ds.data = pointFrames.map(f => ({ x: f.gaqi, y: f.gei, extra: f }));
    ds.pointBackgroundColor = pointFrames.map(f => POINT_COLORS[f.status] || "#777");
    ds.pointRadius = 6;
    // update heatmap image option if heatmap mode on
    if (useHeatmap) {
      // build heatmap image (synchronous since small)
      const img = buildHeatmapImage(pointFrames, stabilityChart);
      stabilityChart.options.plugins.backgroundPlugin.heatmapImage = img;
    } else {
      stabilityChart.options.plugins.backgroundPlugin.heatmapImage = null;
    }
    stabilityChart.update("none"); // no animation for instant frame swap
  }

  // --- timeline / animation loop ---
  function scheduleLoop(now) {
    if (!playing) return;
    if (!lastTick) lastTick = now;
    if (now - lastTick >= playInterval) {
      // advance frame index
      frameIndex = (frameIndex + 1) % frames.length;
      applyFrame(frameIndex);
      lastTick = now;
    }
    rafId = requestAnimationFrame(scheduleLoop);
  }

  function startPlaying() {
    if (!frames.length) return;
    playing = true;
    lastTick = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(scheduleLoop);
  }
  function pausePlaying() {
    playing = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function applyFrame(idx) {
    frameIndex = idx % frames.length;
    const f = frames[frameIndex];
    if (!f) return;
    // filter per TCI/SRI inputs
    const tciMin = parseFloat(document.getElementById("tciMin").value || 0);
    const tciMax = parseFloat(document.getElementById("tciMax").value || 100);
    const sriMin = parseFloat(document.getElementById("sriMin").value || 0);
    const sriMax = parseFloat(document.getElementById("sriMax").value || 100);
    // We'll show all points for the current time step, but filtered by tci/sri
    let pts = [f]; // by default show only current frame point (as the "nucleus" instant)
    // Option: you may want to show several surrounding points -> here we choose only the frame
    const filtered = pts.filter(p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax);
    // Update chart with filtered (in our design we show the current frame only; you can expand to show neighborhood)
    updateChartWithPoints(filtered);
    // update UI slider and legend
    const slider = document.getElementById("timeSlider");
    if (slider) {
      slider.max = Math.max(0, frames.length - 1);
      slider.value = frameIndex;
    }
    document.getElementById("stabilityLegend").innerHTML = `
      <strong>Frame:</strong> ${frameIndex + 1} / ${frames.length} &nbsp;
      <strong>Timestamp:</strong> ${new Date(f.ts).toLocaleString()} &nbsp;
      <strong>State:</strong> ${f.status.toUpperCase()} &nbsp;
      <strong>Score:</strong> ${f.score.toFixed(2)}
    `;
  }

  // --- UI wiring ---
  function attachUI() {
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const slider = document.getElementById("timeSlider");
    const applyBtn = document.getElementById("applyFilters");
    const heatToggle = document.getElementById("toggleHeatmap");

    if (playBtn) playBtn.addEventListener("click", () => startPlaying());
    if (pauseBtn) pauseBtn.addEventListener("click", () => pausePlaying());
    if (applyBtn) applyBtn.addEventListener("click", () => applyFrame(frameIndex));
    if (heatToggle) {
      heatToggle.addEventListener("change", (e) => {
        useHeatmap = !!e.target.checked;
        // rebuild current frame to update heatmap overlay
        applyFrame(frameIndex);
      });
    }
    if (slider) {
      slider.addEventListener("input", (e) => {
        pausePlaying(); // pause when user scrubs
        const val = parseInt(e.target.value, 10);
        applyFrame(val);
      });
    }
  }

  // --- main init ---
  async function init() {
    try {
      // build chart first
      initChart();
      attachUI();

      // build frames using history; windowSizeSamples controls smoothing for correlations/volatility
      const secWindow = 3600; // ask for 1h history
      const windowSizeSamples = 60; // use last 60 samples for each frame's window
      const built = await buildFramesFromHistory(secWindow, windowSizeSamples);

      if (!built || !built.length) {
        document.getElementById("stabilityLegend").innerText = "Pas de données historiques disponibles.";
        return;
      }

      frames = built;
      // ensure slider range set
      const slider = document.getElementById("timeSlider");
      if (slider) {
        slider.max = Math.max(0, frames.length - 1);
        slider.value = 0;
      }

      // initialize frame 0
      applyFrame(0);
      // start animation
      startPlaying();

      // optional: low-frequency refresh of frames from server (every N seconds)
      setInterval(async () => {
        // refresh recent frames (append new ones if any)
        const more = await buildFramesFromHistory(secWindow, windowSizeSamples);
        if (more && more.length) {
          frames = more;
          // keep frameIndex bounded
          frameIndex = Math.min(frameIndex, frames.length - 1);
          if (slider) slider.max = Math.max(0, frames.length - 1);
        }
      }, 30_000); // refresh every 30s

    } catch (err) {
      console.error("init stability error:", err);
      document.getElementById("stabilityLegend").innerText = "Erreur: " + err.message;
    }
  }

  // start when window loads
  window.addEventListener("load", init);
})();

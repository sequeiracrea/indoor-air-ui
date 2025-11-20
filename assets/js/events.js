// ======================================================
// CONFIG
// ======================================================
const TRAIL_LENGTH = 60;
const MICRO_LENGTH = 30;

// Canvas & UI
let canvas, ctx, playBtn, slider;

// Data
let frames = [];
let frameIndex = 0;
let isPlaying = false;

// Chart.js instance
let stabilityChart;

// ======================================================
// COLOR FUNCTION (indices → couleur)
// ======================================================
function colorForPoint(p) {
    if (!p) return "grey";
    const v = p.GAQI ?? 0;
    if (v > 90) return "#00d46a";
    if (v > 70) return "#a4ff00";
    if (v > 50) return "#ffd900";
    if (v > 30) return "#ff8800";
    return "#ff2e2e";
}

// ======================================================
// BUILD TRAIL + MICRO ARRAYS
// ======================================================
function getTrailPoints() {
    const start = Math.max(0, frameIndex - TRAIL_LENGTH);
    const arr = [];

    for (let i = start; i <= frameIndex; i++) {
        const f = frames[i];
        if (!f) continue;

        const age = frameIndex - i;        // 0 = récent
        const size = 6 - age * (4 / TRAIL_LENGTH); // gros → petit

        arr.push({
            x: f.timestamp,
            y: f.indices.GAQI,
            ...f.indices,
            size: Math.max(2, size)
        });
    }
    return arr;
}

/// MICRO POINTS
function getMicroPoints() {
    const start = Math.max(0, frameIndex - MICRO_LENGTH);
    const arr = [];

    for (let i = start; i <= frameIndex; i++) {
        const f = frames[i];
        if (!f) continue;

        const age = frameIndex - i;
        const size = 3 - age * (2 / MICRO_LENGTH);

        arr.push({
            x: f.timestamp,
            y: f.indices.GAQI,
            ...f.indices,
            size: Math.max(1, size)
        });
    }
    return arr;
}

// ======================================================
// CHART INIT (1 seule fois, pas de destroy())
// ======================================================
function initChart() {
    const chartCanvas = document.getElementById("chartCanvas").getContext("2d");

    stabilityChart = new Chart(chartCanvas, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Trail",
                    data: [],
                    pointRadius: ctx => ctx.raw?.size ?? 4,
                    pointBackgroundColor: ctx => ctx.raw ? colorForPoint(ctx.raw) : "grey"
                },
                {
                    label: "Micro",
                    data: [],
                    pointRadius: ctx => ctx.raw?.size ?? 2,
                    pointBackgroundColor: ctx => ctx.raw ? colorForPoint(ctx.raw) : "grey"
                }
            ]
        },
        options: {
            responsive: true,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: "#fff",
                        font: { size: 13 }
                    }
                }
            },
            scales: {
                x: {
                    type: "time",
                    time: { unit: "second" },
                    ticks: { color: "#fff" }
                },
                y: {
                    min: 0,
                    max: 100,
                    ticks: { color: "#fff" }
                }
            },
        }
    });
}

// ======================================================
// UPDATE FRAME (no destroy, juste update datasets)
// ======================================================
function updateFrame() {
    if (!stabilityChart) return;

    const trail = getTrailPoints();
    const micro = getMicroPoints();

    stabilityChart.data.datasets[0].data = trail;
    stabilityChart.data.datasets[1].data = micro;

    stabilityChart.update("none");

    slider.value = frameIndex;
}

// ======================================================
// PLAY LOOP
// ======================================================
function playLoop() {
    if (!isPlaying) return;

    frameIndex++;
    if (frameIndex >= frames.length) {
        frameIndex = frames.length - 1;
        isPlaying = false;
        playBtn.textContent = "Play";
        return;
    }

    updateFrame();
    requestAnimationFrame(playLoop);
}

// ======================================================
// FETCH HISTORY DATA
// ======================================================
async function loadHistory() {
    const res = await fetch("/history");
    const json = await res.json();
    frames = json.series;

    console.log("Frames chargées :", frames.length);

    slider.max = frames.length - 1;
    frameIndex = 0;

    updateFrame();
}

// ======================================================
// INIT
// ======================================================
function init() {
    canvas = document.getElementById("mainCanvas");
    ctx = canvas.getContext("2d");

    playBtn = document.getElementById("playBtn");
    slider = document.getElementById("frameSlider");

    initChart();
    loadHistory();

    // PLAY / PAUSE
    playBtn.addEventListener("click", () => {
        isPlaying = !isPlaying;
        playBtn.textContent = isPlaying ? "Pause" : "Play";
        if (isPlaying) playLoop();
    });

    // SLIDER MANUAL
    slider.addEventListener("input", () => {
        frameIndex = parseInt(slider.value);
        updateFrame();
    });
}

window.addEventListener("DOMContentLoaded", init);

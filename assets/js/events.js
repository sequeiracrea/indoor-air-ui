/* assets/js/events.js — VERSION ULTRA STABLE (sans destroy) */

const TRAIL_LENGTH = 60;  // nombre d’anciennes positions
const MICRO_POINTS = 30;  // "micro jitter" autour du point principal

let stabilityChart = null;
let frames = [];       // Toutes les frames du /history
let current = 0;
let playing = false;
let rafId = null;

/* ----------------------------------------------------------
   1. RÉCUP HISTORIQUE
---------------------------------------------------------- */
async function loadHistory(sec = 1800) {
    try {
        const history = await IndoorAPI.fetchHistory(sec);
        if (!history || !history.series) return [];

        return history.series.map(e => {
            const i = e.indices || {};
            return {
                g: i.GAQI ?? 0,
                e: i.GEI ?? 0,
                s: i.SRI ?? 0,
                t: i.TCI ?? 0
            };
        });
    } catch (err) {
        console.error("Erreur history:", err);
        return [];
    }
}

/* ----------------------------------------------------------
   2. CALCUL TRAIL + MICRO-POINTS
---------------------------------------------------------- */
function buildTrail(index) {
    const trail = [];

    for (let i = 0; i < TRAIL_LENGTH; i++) {
        const f = frames[index - i];
        if (!f) break;

        trail.push({
            x: f.g,
            y: f.e,
            s: f.s,
            t: f.t,
            size: 6 + (TRAIL_LENGTH - i) * 0.3   // plus récent = plus gros
        });
    }
    return trail;
}

function makeMicroPoints(basePoint) {
    const pts = [];
    for (let i = 0; i < MICRO_POINTS; i++) {
        pts.push({
            x: basePoint.x + (Math.random() - 0.5) * 1.5,
            y: basePoint.y + (Math.random() - 0.5) * 1.5,
            size: 2,
            s: basePoint.s,
            t: basePoint.t
        });
    }
    return pts;
}

/* ----------------------------------------------------------
   3. COULEUR DYNAMIQUE
---------------------------------------------------------- */
function colorForPoint(p) {
    const score = Math.sqrt(
        (p.x / 100) ** 2 +
        (p.y / 100) ** 2 +
        (p.s / 100) ** 2 +
        (p.t / 100) ** 2
    );
    if (score > 0.75) return "red";
    if (score > 0.5) return "orange";
    return "green";
}

/* ----------------------------------------------------------
   4. INITIALISATION CHART (UNE SEULE FOIS)
---------------------------------------------------------- */
function initChart() {
    const ctx = document.getElementById("stabilityChart");

    stabilityChart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Trail",
                    data: [],
                    pointRadius: ctx => ctx.raw.size,
                    pointBackgroundColor: ctx => colorForPoint(ctx.raw),
                },
                {
                    label: "Micro",
                    data: [],
                    pointRadius: ctx => ctx.raw.size,
                    pointBackgroundColor: ctx => colorForPoint(ctx.raw),
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { min: 0, max: 100, title: { text: "GAQI", display: true } },
                y: { min: 0, max: 100, title: { text: "GEI", display: true } }
            },
            plugins: {
                legend: {
                    labels: {
                        generateLabels(chart) {
                            return [
                                { text: "Stable", fillStyle: "green" },
                                { text: "Alerte", fillStyle: "orange" },
                                { text: "Instable", fillStyle: "red" }
                            ];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const p = ctx.raw;
                            return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.s.toFixed(1)}, TCI: ${p.t.toFixed(1)}`;
                        }
                    }
                }
            }
        },
        plugins: [
            {
                id: "background",
                beforeDraw(chart, args, opts) {
                    const { ctx, chartArea: a } = chart;
                    ctx.save();

                    // vert clair
                    ctx.fillStyle = "rgba(0,200,0,0.15)";
                    ctx.fillRect(a.left, a.top, a.width * 0.5, a.height * 0.5);

                    // orange clair
                    ctx.fillStyle = "rgba(255,165,0,0.15)";
                    ctx.fillRect(a.left + a.width * 0.5, a.top, a.width * 0.5, a.height * 0.5);

                    // rouge clair
                    ctx.fillStyle = "rgba(255,0,0,0.15)";
                    ctx.fillRect(a.left, a.top + a.height * 0.5, a.width, a.height * 0.5);

                    ctx.restore();
                }
            }
        ]
    });
}

/* ----------------------------------------------------------
   5. MISE À JOUR (SANS DESTROY)
---------------------------------------------------------- */
function updateChart(index) {
    const f = frames[index];
    if (!f) return;

    const base = { x: f.g, y: f.e, s: f.s, t: f.t };

    const trail = buildTrail(index);
    const micros = makeMicroPoints(base);

    stabilityChart.data.datasets[0].data = trail;
    stabilityChart.data.datasets[1].data = micros;

    stabilityChart.update("none");
}

/* ----------------------------------------------------------
   6. ANIMATION
---------------------------------------------------------- */
function loop() {
    if (!playing) return;

    current = (current + 1) % frames.length;
    updateChart(current);

    rafId = requestAnimationFrame(loop);
}

function togglePlay() {
    playing = !playing;
    document.getElementById("playPauseBtn").textContent = playing ? "Pause" : "Play";

    if (playing) loop();
    else cancelAnimationFrame(rafId);
}

function onSlider(e) {
    playing = false;
    document.getElementById("playPauseBtn").textContent = "Play";

    current = Number(e.target.value);
    updateChart(current);
}

/* ----------------------------------------------------------
   7. INIT GÉNÉRAL
---------------------------------------------------------- */
async function init() {
    frames = await loadHistory(1800);
    if (!frames.length) {
        console.warn("Aucune frame reçue !");
        return;
    }

    initChart();

    document.getElementById("timeline").max = frames.length - 1;
    document.getElementById("playPauseBtn").onclick = togglePlay;
    document.getElementById("timeline").oninput = onSlider;

    updateChart(0);
}

window.addEventListener("load", init);

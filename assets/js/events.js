/* assets/js/events.js */

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

let stabilityChart;
let allFrames = [];
let currentFrame = 0;
let animating = false;
let animationId;

// -------------------------------
// Lecture de l’historique
// -------------------------------
async function loadFramesFromHistory(sec = 1800) {
    try {
        const history = await window.IndoorAPI.fetchHistory(sec);

        if (!history || !history.series) {
            console.warn("Pas de séries dans l’historique");
            return [];
        }

        console.log("Frames brutes reçues :", history.series.length);

        const frames = history.series
            .map(entry => {
                const idx = entry.indices;
                if (!idx) return null;

                const { GAQI, GEI, SRI, TCI } = idx;

                if (
                    GAQI === undefined ||
                    GEI === undefined ||
                    SRI === undefined ||
                    TCI === undefined
                ) {
                    return null;
                }

                return {
                    x: GAQI,
                    y: GEI,
                    sri: SRI,
                    tci: TCI
                };
            })
            .filter(Boolean);

        console.log("Frames valides :", frames.length);
        return frames;

    } catch (e) {
        console.error("Erreur récupération historique :", e);
        return [];
    }
}

// -------------------------------
// Filtrage
// -------------------------------
function filterPoints(points, tciMin, tciMax, sriMin, sriMax) {
    return points.filter(
        p => p.tci >= tciMin && p.tci <= tciMax && p.sri >= sriMin && p.sri <= sriMax
    );
}

// -------------------------------
// Fond du diagramme
// -------------------------------
function drawBackground(ctx, chart) {
    const { left, right, top, bottom } = chart.chartArea;

    ctx.save();

    const width = right - left;
    const height = bottom - top;

    // Stable
    ctx.fillStyle = STABILITY_COLORS.stable;
    ctx.fillRect(left, top, width * 0.5, height * 0.5);

    // Alerte
    ctx.fillStyle = STABILITY_COLORS.alert;
    ctx.fillRect(left + width * 0.5, top, width * 0.5, height * 0.5);

    // Instable
    ctx.fillStyle = STABILITY_COLORS.unstable;
    ctx.fillRect(left, top + height * 0.5, width, height * 0.5);

    ctx.restore();
}

// -------------------------------
// Affichage du graphique
// -------------------------------
function renderChart(points) {
    const ctx = document.getElementById("stabilityChart").getContext("2d");

    if (stabilityChart) stabilityChart.destroy();

    stabilityChart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: "Point environnemental",
                    data: points.map(p => ({ x: p.x, y: p.y, extra: p })),
                    pointBackgroundColor: points.map(p => {
                        const score = Math.sqrt(
                            (p.x / 100) ** 2 +
                            (p.y / 100) ** 2 +
                            (p.sri / 100) ** 2 +
                            (p.tci / 100) ** 2
                        );
                        if (score > 0.75) return POINT_COLORS.unstable;
                        if (score > 0.5) return POINT_COLORS.alert;
                        return POINT_COLORS.stable;
                    }),
                    pointRadius: 8
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                x: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: "GAQI" }
                },
                y: {
                    min: 0,
                    max: 100,
                    title: { display: true, text: "GEI" }
                }
            },

            plugins: {
                tooltip: {
                    callbacks: {
                        label: ctx => {
                            const p = ctx.raw.extra;
                            return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}`;
                        }
                    }
                },
                legend: { display: false }
            }
        },

        plugins: [
            {
                id: "bg",
                beforeDraw: chart => drawBackground(chart.ctx, chart)
            }
        ]
    });
}

// -------------------------------
// Animation
// -------------------------------
function nextFrame() {
    if (!allFrames.length) return;

    const tciMin = parseFloat(document.getElementById("tciMin").value) || 0;
    const tciMax = parseFloat(document.getElementById("tciMax").value) || 100;
    const sriMin = parseFloat(document.getElementById("sriMin").value) || 0;
    const sriMax = parseFloat(document.getElementById("sriMax").value) || 100;

    const frame = allFrames[currentFrame];
    const filtered = filterPoints([frame], tciMin, tciMax, sriMin, sriMax);

    renderChart(filtered);

    currentFrame = (currentFrame + 1) % allFrames.length;

    if (animating) animationId = requestAnimationFrame(nextFrame);
}

function toggleAnimation() {
    animating = !animating;

    document.getElementById("playPauseBtn").textContent =
        animating ? "Pause" : "Play";

    if (animating) nextFrame();
    else cancelAnimationFrame(animationId);
}

// -------------------------------
// Init
// -------------------------------
async function init() {
    console.log("Chargement historique…");
    allFrames = await loadFramesFromHistory(1800);

    if (!allFrames.length) {
        console.warn("Aucune frame utilisable !");
        return;
    }

    console.log("Frames prêtes :", allFrames.length);

    // Bind events
    document.getElementById("playPauseBtn").addEventListener("click", toggleAnimation);
    document.getElementById("applyFilters").addEventListener("click", () => {
        currentFrame = 0;
        nextFrame();
    });

    // Affiche la frame 0
    renderChart([allFrames[0]]);
}

window.addEventListener("load", init);

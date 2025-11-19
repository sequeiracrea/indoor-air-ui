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

let chart;
let allFrames = [];
let currentFrame = 0;
let animating = false;

// ----------------------------------
// Chargement historique
// ----------------------------------
async function loadFramesFromHistory(sec = 1800) {
    const hist = await window.IndoorAPI.fetchHistory(sec);
    if (!hist || !hist.series) return [];

    return hist.series
        .map(entry => {
            if (!entry.indices) return null;
            const { GAQI, GEI, SRI, TCI } = entry.indices;
            if (GAQI == null || GEI == null || SRI == null || TCI == null) return null;
            return { x: GAQI, y: GEI, sri: SRI, tci: TCI };
        })
        .filter(Boolean);
}

// ----------------------------------
// Fond du graphique
// ----------------------------------
function backgroundPlugin() {
    return {
        id: "bg",
        beforeDraw(chart) {
            const { left, top, right, bottom } = chart.chartArea;
            const ctx = chart.ctx;

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
    };
}

// ----------------------------------
// Création unique du graphique
// ----------------------------------
function createChart() {
    const ctx = document.getElementById("stabilityChart").getContext("2d");

    chart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [{
                data: [],
                pointRadius: 8,
                pointBackgroundColor: [],
            }]
        },

        options: {
            animation: false,   // ⚠️ Désactivation totale = PAS DE BUG
            responsive: true,
            maintainAspectRatio: false,

            scales: {
                x: { min: 0, max: 100, title: { display: true, text: "GAQI" }},
                y: { min: 0, max: 100, title: { display: true, text: "GEI" }}
            },

            plugins: {
                tooltip: {
                    callbacks: {
                        label(ctx) {
                            const p = ctx.raw.extra;
                            return `GAQI: ${p.x.toFixed(1)} / GEI: ${p.y.toFixed(1)}
SRI: ${p.sri.toFixed(1)} / TCI: ${p.tci.toFixed(1)}`;
                        }
                    }
                },
                legend: { display: false }
            }
        },

        plugins: [backgroundPlugin()]
    });
}

// ----------------------------------
// Mise à jour du point (SANS recréer le chart)
// ----------------------------------
function updateFrame() {
    if (!allFrames.length) return;

    const f = allFrames[currentFrame];

    const dataset = chart.data.datasets[0];

    dataset.data = [{
        x: f.x,
        y: f.y,
        extra: f
    }];

    // couleur dynamique
    const score = Math.sqrt(
        (f.x / 100) ** 2 +
        (f.y / 100) ** 2 +
        (f.sri / 100) ** 2 +
        (f.tci / 100) ** 2
    );

    let color = "green";
    if (score > 0.75) color = "red";
    else if (score > 0.5) color = "orange";

    dataset.pointBackgroundColor = [color];

    chart.update("none");

    currentFrame = (currentFrame + 1) % allFrames.length;

    if (animating) requestAnimationFrame(updateFrame);
}

// ----------------------------------
// Bouton Play/Pause
// ----------------------------------
function toggleAnimation() {
    animating = !animating;
    document.getElementById("playPauseBtn").textContent =
        animating ? "Pause" : "Play";

    if (animating) updateFrame();
}

// ----------------------------------
// Initialisation
// ----------------------------------
async function init() {
    allFrames = await loadFramesFromHistory(1800);

    if (!allFrames.length) {
        console.warn("Aucune frame trouvée.");
        return;
    }

    createChart();
    updateFrame();

    document.getElementById("playPauseBtn").onclick = toggleAnimation;
}

window.addEventListener("load", init);

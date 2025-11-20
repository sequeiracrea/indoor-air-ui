/* ===========================================================
   🎨 ART ENGINE : Flux thermique + Heatmap + Traînées + Zoom
   =========================================================== */

const art = {
    particles: [],
    maxParticles: 120,
    noiseOffset: 0,
    zoom: 1,
    zoomTarget: 1,
    heatmapIntensity: 0.25,
};


// -----------------------------
// 🔥 Generate thermal flow particles
// -----------------------------
function spawnParticles() {
    while (art.particles.length < art.maxParticles) {
        art.particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            life: Math.random() * 80 + 40
        });
    }
}


// -----------------------------
// 🔥 Update particle field (Flux thermique)
// -----------------------------
function updateParticles(GAQI, GEI) {
    const heat = GAQI / 100;   // 0 → vert / 1 → rouge
    const wind = GEI / 100;    // intensité du flux

    art.particles.forEach(p => {
        // wind distortion
        p.vx += (Math.random() - 0.5) * 0.02 * wind;
        p.vy += (Math.random() - 0.5) * 0.02 * wind;

        p.x += p.vx;
        p.y += p.vy;

        p.life--;

        // wrap
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        if (p.life <= 0) {
            p.x = Math.random() * canvas.width;
            p.y = Math.random() * canvas.height;
            p.life = Math.random() * 80 + 40;
        }
    });

    // target zoom evolves with data volatility
    art.zoomTarget = 1 + (Math.abs(GAQI - GEI) / 200);
    art.zoom += (art.zoomTarget - art.zoom) * 0.02;
}


// -----------------------------
// 🌡️ Heatmap Background
// -----------------------------
function drawHeatmap(GAQI) {
    const heat = GAQI / 100;

    const grd = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.8
    );

    grd.addColorStop(0, `rgba(${200 + 55 * heat}, ${50 * (1-heat)}, 0, ${art.heatmapIntensity})`);
    grd.addColorStop(1, `rgba(0,0,0,0)`);

    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}


// -----------------------------
// 🎇 Traînée lumineuse (effet comète)
// -----------------------------
function drawTrail(prev, curr, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
}


// -----------------------------
// 🧿 Drawing the ART Layer
// -----------------------------
function drawArtLayer(GAQI, GEI, lastPos, currPos, pointColor) {
    // heatmap
    drawHeatmap(GAQI);

    // zoom camera
    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);
    ctx.scale(art.zoom, art.zoom);
    ctx.translate(-canvas.width/2, -canvas.height/2);

    // particles
    ctx.fillStyle = `rgba(255,255,255,0.4)`;
    art.particles.forEach(p => {
        ctx.fillRect(p.x, p.y, 2, 2);
    });

    ctx.restore();

    // comète
    if (lastPos) {
        drawTrail(lastPos, currPos, pointColor);
    }
}


// Call once
spawnParticles();

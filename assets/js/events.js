const THERMAL_RADIUS = 50; // rayon d’influence des points
const THERMAL_DECAY = 0.95; // effet de diffusion / disparition progressive
let thermalMap;

function initThermalMap(){
  thermalMap = ctx.createImageData(canvas.width, canvas.height);
  for(let i=0;i<thermalMap.data.length;i+=4){
    thermalMap.data[i+0] = 0; // R
    thermalMap.data[i+1] = 0; // G
    thermalMap.data[i+2] = 0; // B
    thermalMap.data[i+3] = 255; // alpha
  }
}

function updateThermalMap(){
  const w = canvas.width;
  const h = canvas.height;

  // Décay progressif
  for(let i=0;i<thermalMap.data.length;i+=4){
    thermalMap.data[i+0] *= THERMAL_DECAY;
    thermalMap.data[i+1] *= THERMAL_DECAY;
    thermalMap.data[i+2] *= THERMAL_DECAY;
  }

  // Ajouter chaleur pour chaque point
  displayedPoints.forEach(p=>{
    const px = Math.floor((p.x/100)*w);
    const py = Math.floor(h - (p.y/100)*h);

    for(let dx=-THERMAL_RADIUS;dx<=THERMAL_RADIUS;dx++){
      for(let dy=-THERMAL_RADIUS;dy<=THERMAL_RADIUS;dy++){
        const x = px+dx;
        const y = py+dy;
        if(x<0||x>=w||y<0||y>=h) continue;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist>THERMAL_RADIUS) continue;
        const idx = (y*w + x)*4;
        const intensity = (1 - dist/THERMAL_RADIUS)*0.5; // influence
        thermalMap.data[idx+0] = Math.min(255, thermalMap.data[idx+0] + intensity*255); // rouge
        thermalMap.data[idx+1] = Math.min(255, thermalMap.data[idx+1] + intensity*100); // vert
        thermalMap.data[idx+2] = Math.min(255, thermalMap.data[idx+2] + intensity*50);  // bleu
      }
    }
  });
}

function drawThermalBackground(){
  ctx.putImageData(thermalMap,0,0);
}

// Dans nextFrame ou drawPoints, remplacer drawBackground() par :
updateThermalMap();
drawThermalBackground();
drawPoints(); // points au-dessus de la carte thermique

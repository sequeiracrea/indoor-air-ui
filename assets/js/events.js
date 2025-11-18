// Couleurs selon stabilité
const STABILITY_COLORS = {
  stable: "green",
  alert: "orange",
  unstable: "red"
};

// Exemple de données simulées (remplacer par tes indices réels)
async function fetchStabilityData() {
  // Simulation : 100 points avec SRI, GAQI, GEI, TCI
  const points = [];
  for(let i=0;i<100;i++){
    const SRI = Math.random()*100;
    const GAQI = Math.random()*100;
    const GEI = Math.random()*100;
    const TCI = Math.random()*100;
    // Score global de stabilité : plus petit = stable
    const stabilityScore = Math.sqrt((SRI/100)**2 + (GAQI/100)**2 + (GEI/100)**2 + (TCI/100)**2);
    let status = "stable";
    if(stabilityScore > 0.5 && stabilityScore <= 0.75) status = "alert";
    else if(stabilityScore > 0.75) status = "unstable";
    points.push({x:GAQI, y:GEI, tci:TCI, sri:SRI, color:STABILITY_COLORS[status], score:stabilityScore});
  }
  return points;
}

// Création du diagramme
async function renderStabilityChart() {
  const dataPoints = await fetchStabilityData();

  const ctx = document.getElementById("stabilityChart").getContext("2d");
  new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: "États environnementaux",
        data: dataPoints.map(p => ({x:p.x, y:p.y, extra:p})),
        pointBackgroundColor: dataPoints.map(p=>p.color),
        pointRadius: 6,
        pointHoverRadius: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => {
              const p = ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, Score: ${p.score.toFixed(2)}`;
            }
          }
        },
        legend: { display: false }
      },
      scales: {
        x: { title: { display:true, text:"GAQI" }, min:0, max:100 },
        y: { title: { display:true, text:"GEI" }, min:0, max:100 }
      }
    }
  });

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Note :</strong> Chaque point représente un état. La couleur indique la stabilité globale calculée sur SRI, GAQI, GEI et TCI.
  `;
}

window.addEventListener("load", renderStabilityChart);

const STABILITY_COLORS = {
  stable: "green",
  alert: "orange",
  unstable: "red"
};

let stabilityChart;
let dataPoints = [];

// Génération des données simulées
function generateStabilityData(numPoints = 100) {
  const points = [];
  for(let i=0;i<numPoints;i++){
    const SRI = Math.random()*100;
    const GAQI = Math.random()*100;
    const GEI = Math.random()*100;
    const TCI = Math.random()*100;
    const stabilityScore = Math.sqrt((SRI/100)**2 + (GAQI/100)**2 + (GEI/100)**2 + (TCI/100)**2);
    let status = "stable";
    if(stabilityScore > 0.5 && stabilityScore <= 0.75) status = "alert";
    else if(stabilityScore > 0.75) status = "unstable";
    points.push({x:GAQI, y:GEI, sri:SRI, tci:TCI, color:STABILITY_COLORS[status], score:stabilityScore});
  }
  return points;
}

// Filtre les points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  return points.filter(p => p.tci>=tciMin && p.tci<=tciMax && p.sri>=sriMin && p.sri<=sriMax);
}

// Dessine le diagramme avec contour de stabilité
function renderChart(filteredPoints) {
  const ctx = document.getElementById("stabilityChart").getContext("2d");

  if(stabilityChart) stabilityChart.destroy();

  stabilityChart = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [{
        label: "États environnementaux",
        data: filteredPoints.map(p=>({x:p.x,y:p.y, extra:p})),
        pointBackgroundColor: filteredPoints.map(p=>p.color),
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
      },
      animation: { duration: 1000 }
    }
  });

  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Note :</strong> Chaque point représente un état. La couleur indique la stabilité globale calculée sur SRI, GAQI, GEI et TCI.
  `;
}

// Application des filtres
function applyFilters(){
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);
  const filtered = filterPoints(dataPoints, tciMin, tciMax, sriMin, sriMax);
  renderChart(filtered);
}

// Initialisation
window.addEventListener("load", () => {
  dataPoints = generateStabilityData(150); // Génère 150 points simulés
  renderChart(dataPoints);

  document.getElementById("applyFilters").addEventListener("click", applyFilters);
});

const STABILITY_COLORS = { stable:"green", alert:"orange", unstable:"red" };
let stabilityChart;
let allPoints = [];
let timeIndex = 0;
const maxTimeSteps = 50;

// Génération des données simulées sur plusieurs pas de temps
function generateAnimatedData(numPoints=100, steps=maxTimeSteps){
  const data = [];
  for(let t=0;t<steps;t++){
    const stepPoints = [];
    for(let i=0;i<numPoints;i++){
      const SRI = Math.random()*100;
      const GAQI = Math.random()*100;
      const GEI = Math.random()*100;
      const TCI = Math.random()*100;
      const stabilityScore = Math.sqrt((SRI/100)**2 + (GAQI/100)**2 + (GEI/100)**2 + (TCI/100)**2);
      let status = "stable";
      if(stabilityScore>0.5 && stabilityScore<=0.75) status="alert";
      else if(stabilityScore>0.75) status="unstable";
      stepPoints.push({x:GAQI, y:GEI, sri:SRI, tci:TCI, color:STABILITY_COLORS[status], score:stabilityScore});
    }
    data.push(stepPoints);
  }
  return data;
}

// Filtrer points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  return points.filter(p => p.tci>=tciMin && p.tci<=tciMax && p.sri>=sriMin && p.sri<=sriMax);
}

// Render Chart
function renderChart(points){
  const ctx = document.getElementById("stabilityChart").getContext("2d");
  if(stabilityChart) stabilityChart.destroy();
  stabilityChart = new Chart(ctx, {
    type:'scatter',
    data:{
      datasets:[{
        label:'État environnemental',
        data:points.map(p=>({x:p.x, y:p.y, extra:p})),
        pointBackgroundColor:points.map(p=>p.color),
        pointRadius:6,
        pointHoverRadius:10
      }]
    },
    options:{
      responsive:true,
      maintainAspectRatio:false,
      plugins:{
        tooltip:{
          callbacks:{
            label:ctx=>{
              const p=ctx.raw.extra;
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, Score: ${p.score.toFixed(2)}`;
            }
          }
        },
        legend:{ display:false }
      },
      scales:{
        x:{ title:{display:true,text:"GAQI"}, min:0, max:100 },
        y:{ title:{display:true,text:"GEI"}, min:0, max:100 }
      }
    }
  });
}

// Animation pas à pas
function animateStep(){
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);

  const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);
  timeIndex = (timeIndex+1) % maxTimeSteps;
  requestAnimationFrame(()=>setTimeout(animateStep, 400));
}

// Application filtre manuel
function applyFilters(){
  const tciMin = parseFloat(document.getElementById("tciMin").value);
  const tciMax = parseFloat(document.getElementById("tciMax").value);
  const sriMin = parseFloat(document.getElementById("sriMin").value);
  const sriMax = parseFloat(document.getElementById("sriMax").value);
  const stepPoints = filterPoints(allPoints[timeIndex], tciMin, tciMax, sriMin, sriMax);
  renderChart(stepPoints);
}

// Initialisation
window.addEventListener("load", ()=>{
  allPoints = generateAnimatedData(150, maxTimeSteps);
  animateStep();
  document.getElementById("applyFilters").addEventListener("click", applyFilters);
  document.getElementById("stabilityLegend").innerHTML = `
    <strong>Note :</strong> Points colorés selon la stabilité globale (stable/alerte/instable). Évolution simulée dans le temps.
  `;
});

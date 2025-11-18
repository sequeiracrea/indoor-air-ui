const STABILITY_COLORS = { stable:"rgba(0,200,0,0.2)", alert:"rgba(255,165,0,0.2)", unstable:"rgba(255,0,0,0.2)" };
const POINT_COLORS = { stable:"green", alert:"orange", unstable:"red" };
let stabilityChart;
let allPoints = [];
let timeIndex = 0;
const maxTimeSteps = 50;

// Génération des données simulées
function generateAnimatedData(numPoints=150, steps=maxTimeSteps){
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
      stepPoints.push({x:GAQI, y:GEI, sri:SRI, tci:TCI, status, score:stabilityScore});
    }
    data.push(stepPoints);
  }
  return data;
}

// Filtrer points selon TCI et SRI
function filterPoints(points, tciMin, tciMax, sriMin, sriMax){
  return points.filter(p => p.tci>=tciMin && p.tci<=tciMax && p.sri>=sriMin && p.sri<=sriMax);
}

// Zones de fond type nucléide
function drawBackground(ctx, chart){
  const {left, right, top, bottom} = chart.chartArea;
  const width = right-left;
  const height = bottom-top;
  ctx.save();
  ctx.fillStyle = STABILITY_COLORS.stable;
  ctx.fillRect(left, top, width*0.5, height*0.5);
  ctx.fillStyle = STABILITY_COLORS.alert;
  ctx.fillRect(left+width*0.5, top, width*0.5, height*0.5);
  ctx.fillStyle = STABILITY_COLORS.unstable;
  ctx.fillRect(left, top+height*0.5, width, height*0.5);
  ctx.restore();
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
        pointBackgroundColor:points.map(p=>POINT_COLORS[p.status]),
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
              return `GAQI: ${p.x.toFixed(1)}, GEI: ${p.y.toFixed(1)}, SRI: ${p.sri.toFixed(1)}, TCI: ${p.tci.toFixed(1)}, Score: ${p.score.toFixed(2)}, État: ${p.status}`;
            }
          }
        },
        legend:{ display:false }
      },
      scales:{
        x:{ title:{display:true,text:"GAQI"}, min:0, max:100 },
        y:{ title:{display:true,text:"GEI"}, min:0, max:100 }
      }
    },
    plugins:[{
      id:'backgroundPlugin',
      beforeDraw:chart=>drawBackground(chart.ctx, chart)
    }]
  });
}

// Animation
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
    <strong>Légende :</strong><br>
    - Fond vert : stable<br>
    - Fond orange : alerte<br>
    - Fond rouge : instable<br>
    - Points : états simulés animés<br>
    - Tooltip : tous les indices et score global
  `;
});

import { fetchScatterBar } from './api.js';

const ctx = document.getElementById('mainScatter').getContext('2d');
const sideCtx = document.getElementById('stackedBar').getContext('2d');
let mainChart, sideChart;

function init() {
  mainChart = new Chart(ctx, { type:'scatter', data:{datasets:[{data:[]}]} , options:{
    onClick: (evt, items) => {
      if (!items.length) return;
      const it = items[0];
      const point = mainChart.data.datasets[it.datasetIndex].data[it.index];
      updateSideBar(point);
    }
  }});
  sideChart = new Chart(sideCtx, { type:'bar', data: {labels:['CO2','NO2','NH3','CO'], datasets:[{ data:[], backgroundColor:['#06B6D4','#F59F42','#A855F7','#3B82F6'] }]}, options:{ indexAxis:'y', scales:{ x:{ max: 100 }}}});
}

function updateSideBar(point) {
  const total = (point.co2||0)+(point.no2||0)+(point.nh3||0)+(point.co||0);
  const arr = [(point.co2||0)/total*100, (point.no2||0)/total*100, (point.nh3||0)/total*100, (point.co||0)/total*100];
  sideChart.data.datasets[0].data = arr;
  sideChart.update();
}

async function load() {
  const payload = await fetchScatterBar('temp','rh',3600,60);
  const pts = payload.points.map(p => ({ x:p.x, y:p.y, co2:p.co2, no2:p.no2, nh3:p.nh3, co:p.co }));
  mainChart.data.datasets[0].data = pts;
  mainChart.update();
}

window.addEventListener('load', ()=>{ init(); load(); });

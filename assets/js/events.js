import { fetchHistory } from './api.js';
const ctx = document.getElementById('volChart').getContext('2d');
const volChart = new Chart(ctx, { type:'line', data:{ labels:[], datasets:[{label:'σ CO2', data:[], borderColor:'#E54848'}]}, options:{ animation:false } });

async function loadWindow() {
  const hist = await fetchHistory(1800); // 30min
  if (!hist) return;
  // compute sliding sigma every 30s
  const windowSize = 30;
  const co2series = hist.series.map(s=>s.measures.co2);
  const labels = [];
  const sigmas = [];
  for (let i=windowSize; i<co2series.length; i+=1) {
    const slice = co2series.slice(i-windowSize, i);
    const mean = slice.reduce((a,b)=>a+b,0)/slice.length;
    const sigma = Math.sqrt(slice.reduce((a,b)=>a+(b-mean)*(b-mean),0)/slice.length);
    labels.push(hist.series[i].timestamp);
    sigmas.push(sigma);
  }
  volChart.data.labels = labels;
  volChart.data.datasets[0].data = sigmas;
  volChart.update();
}
window.addEventListener('load', loadWindow);

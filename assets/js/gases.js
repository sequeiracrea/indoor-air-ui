import { fetchScatterBar } from './api.js';

const ctx = document.getElementById('gasesScatter').getContext('2d');
const scatter = new Chart(ctx, {
  type: 'bubble',
  data: { datasets: [{ label:'CO2 vs NO2', data: [] }]},
  options: { animation:false, scales:{ x:{title:{display:true,text:'CO2 (ppm)'}}, y:{title:{display:true,text:'NO2 (ppm)'}} }}
});

async function load() {
  const payload = await fetchScatterBar('co2','no2',3600,30);
  if (!payload) return;
  const pts = payload.points.map(p => ({
    x: p.x ?? p.co2, // depending on request
    y: p.y ?? p.no2,
    r: Math.min(20, Math.max(3, Math.log10(p.total+1)*4)),
    backgroundColor: p.event ? 'rgba(255,79,183,0.9)' : 'rgba(59,130,246,0.7)'
  }));
  scatter.data.datasets[0].data = pts;
  scatter.update();
}

window.addEventListener('load', load);

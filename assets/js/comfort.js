import { fetchData } from './api.js';
const ctx = document.getElementById('radarChart').getContext('2d');
const radar = new Chart(ctx, {
  type:'radar',
  data:{ labels:['Temp','Hum','Press'], datasets:[{ label:'TCI', data:[0,0,0], backgroundColor:'rgba(152,215,167,0.4)', borderColor:'#98D7A7' }]},
  options:{ scales:{ r:{ min:0, max:100 } } }
});

async function loop() {
  const payload = await fetchData();
  if (!payload) return setTimeout(loop,1000);
  const t = payload.measures.temp;
  const h = payload.measures.rh;
  const p = payload.measures.pres;
  // Convert to "comfort distance" normalized [0-100]
  const vTemp = Math.max(0, 100 - Math.abs(t-22)*5);
  const vHum = Math.max(0, 100 - Math.abs(h-50)*1.5);
  const vPress = Math.max(0, 100 - Math.abs(p-1013)*0.5);
  radar.data.datasets[0].data = [vTemp, vHum, vPress];
  radar.update('none');
  setTimeout(loop, 1000);
}

window.addEventListener('load', loop);

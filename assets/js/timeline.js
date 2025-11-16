import { fetchHistory } from './api.js';

// fetch initial history (1h) and build chart
const ctx = document.getElementById('timelineChart').getContext('2d');
let chart;

function buildEmpty() {
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'CO2', data: [], borderColor: '#06B6D4', tension:0.2 },
      { label: 'NO2', data: [], borderColor: '#F59F42', tension:0.2 },
      { label: 'NH3', data: [], borderColor: '#A855F7', tension:0.2 }
    ]},
    options: { animation:false, normalized:true, scales:{ x:{display:false} } }
  });
}

async function loadInitial() {
  const history = await fetchHistory(3600); // last 1h
  if (!history) return;
  const labels = history.series.map(s => s.timestamp);
  const co2 = history.series.map(s => s.measures.co2);
  const no2 = history.series.map(s => s.measures.no2);
  const nh3 = history.series.map(s => s.measures.nh3);
  chart.data.labels = labels;
  chart.data.datasets[0].data = co2;
  chart.data.datasets[1].data = no2;
  chart.data.datasets[2].data = nh3;
  chart.update();
}

// poll small updates (1s)
async function poll() {
  const r = await fetch('/data'); // local relative works on same domain; else use API_BASE
  // If hosted on different domain, use API call: fetchData()
  const payload = await fetch('https://indoor-sim-server.onrender.com/data').then(r=>r.json()).catch(()=>null);
  if (!payload) return setTimeout(poll,1000);
  const ts = payload.timestamp;
  chart.data.labels.push(ts);
  chart.data.datasets[0].data.push(payload.measures.co2);
  chart.data.datasets[1].data.push(payload.measures.no2);
  chart.data.datasets[2].data.push(payload.measures.nh3);
  // keep length manageable
  if (chart.data.labels.length > 3600) {
    chart.data.labels.shift();
    chart.data.datasets.forEach(ds=>ds.data.shift());
  }
  chart.update('none');
  setTimeout(poll,1000);
}

window.addEventListener('load', async () => {
  buildEmpty();
  await loadInitial();
  poll();
});


/* assets/js/gases.js */
(function(){
  const { fetchHistory } = window.IndoorAPI;
  async function buildGases(){
    try{
      const json = await fetchHistory(3600);
      const series = json.series || [];
      if(!series.length) return console.warn("no series");
      const map = {
        co: series.map(s=>s.measures.co),
        co2: series.map(s=>s.measures.co2),
        no2: series.map(s=>s.measures.no2),
        nh3: series.map(s=>s.measures.nh3),
        ts: series.map(s=>s.timestamp)
      };

      const cfg = (label, data, color) => ({
        type:'line',
        data:{ labels: map.ts, datasets:[{ label, data, borderColor:color, tension:0.3, fill:true, backgroundColor:color+'22' }]},
        options:{ animation:false, responsive:true, scales:{ x:{ display:false } } }
      });

      new Chart(document.getElementById('coChart').getContext('2d'), cfg('CO', map.co, '#3B82F6'));
      new Chart(document.getElementById('co2Chart').getContext('2d'), cfg('CO2', map.co2, '#06B6D4'));
      new Chart(document.getElementById('no2Chart').getContext('2d'), cfg('NO2', map.no2, '#F59F42'));
      new Chart(document.getElementById('nh3Chart').getContext('2d'), cfg('NH3', map.nh3, '#A855F7'));

    }catch(e){ console.error("gases err", e); }
  }

  window.addEventListener('load', buildGases);
})();

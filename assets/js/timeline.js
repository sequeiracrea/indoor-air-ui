/* assets/js/timeline.js */
(function(){
  const { fetchHistory, fetchLatest } = window.IndoorAPI;
  let chart;

  function buildEmpty(){
    const ctx = document.getElementById('timelineChart').getContext('2d');
    chart = new Chart(ctx, {
      type:'line',
      data:{ labels:[], datasets:[
        { label:'CO2', data:[], borderColor:'#06B6D4', tension:0.2 },
        { label:'NO2', data:[], borderColor:'#F59F42', tension:0.2 },
        { label:'NH3', data:[], borderColor:'#A855F7', tension:0.2 }
      ]},
      options:{ animation:false, normalized:true, scales:{ x:{ display:false } } }
    });
  }

  async function loadInitial(){
    try{
      const json = await fetchHistory(3600);
      const series = json.series || [];
      chart.data.labels = series.map(s => s.timestamp);
      chart.data.datasets[0].data = series.map(s => s.measures.co2);
      chart.data.datasets[1].data = series.map(s => s.measures.no2);
      chart.data.datasets[2].data = series.map(s => s.measures.nh3);
      chart.update();
    }catch(e){ console.error(e); }
  }

  async function poll(){
    try{
      const payload = await fetchLatest();
      if(!payload) return setTimeout(poll,1000);
      chart.data.labels.push(payload.timestamp);
      chart.data.datasets[0].data.push(payload.measures.co2);
      chart.data.datasets[1].data.push(payload.measures.no2);
      chart.data.datasets[2].data.push(payload.measures.nh3);
      if(chart.data.labels.length > 3600){
        chart.data.labels.shift(); chart.data.datasets.forEach(ds=>ds.data.shift());
      }
      chart.update('none');
    }catch(e){ console.error(e); }
    setTimeout(poll,1000);
  }

  window.addEventListener('load', async ()=>{
    buildEmpty();
    await loadInitial();
    poll();
  });
})();

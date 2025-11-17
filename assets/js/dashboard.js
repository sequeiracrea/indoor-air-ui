/* assets/js/dashboard.js */
(function(){
  const { fetchLatest } = window.IndoorAPI;

  let gaqiChart, subbarsChart;

  function colorForGAQI(v){
    if(v>=90) return '#3EE78F';
    if(v>=70) return '#06B6D4';
    if(v>=50) return '#FFCC33';
    if(v>=30) return '#FF9933';
    return '#FF4F4F';
  }

  function createDonut(){
    const ctx = document.getElementById('gaqiDonut').getContext('2d');
    gaqiChart = new Chart(ctx, {
      type:'doughnut',
      data:{ labels:['GAQI','rest'], datasets:[{ data:[0,100], backgroundColor:['#3EE78F','#ECEFF1'] }]},
      options:{ cutout:'70%', plugins:{ legend:{ display:false } } }
    });
  }

  function createSubbars(){
    const ctx = document.getElementById('subbarsChart').getContext('2d');
    subbarsChart = new Chart(ctx, {
      type:'bar',
      data:{ labels:['AQL','TCI','GEI','SRI'], datasets:[{ data:[0,0,0,0], backgroundColor:['#F59F42','#98D7A7','#06B6D4','#A855F7'] }]},
      options:{ indexAxis:'y', scales:{ x:{ max:100 } }, plugins:{ legend:{ display:false } } }
    });
  }

  function updateMeasuresGrid(measures){
    const container = document.getElementById('measuresGrid');
    container.innerHTML = '';
    const entries = [
      ['CO₂', measures.co2, 'ppm'],
      ['NO₂', measures.no2, 'ppm'],
      ['NH₃', measures.nh3, 'ppm'],
      ['CO', measures.co, 'ppm'],
      ['Temp', measures.temp, '°C'],
      ['Hum', measures.rh, '%'],
      ['Press', measures.pres, 'hPa']
    ];
    for(const [label,val,unit] of entries){
      const el = document.createElement('div');
      el.className = 'small-card';
      el.innerHTML = `<div style="font-weight:700">${label}</div><div style="font-size:1.1rem;margin-top:6px">${(val!==undefined?Number(val).toFixed(2):'--')} ${unit}</div>`;
      container.appendChild(el);
    }
  }

  async function loop(){
    try{
      const payload = await fetchLatest(); // { timestamp, measures, indices }
      if(!payload) return setTimeout(loop,1000);
      const m = payload.measures || payload;
      const idx = payload.indices || payload;

      const gaqi = Number(idx.GAQI ?? idx.GAQI ?? 0);
      gaqiChart.data.datasets[0].data[0] = gaqi;
      gaqiChart.data.datasets[0].data[1] = Math.max(0,100-gaqi);
      gaqiChart.data.datasets[0].backgroundColor[0] = colorForGAQI(gaqi);
      gaqiChart.update('none');
      document.getElementById('gaqiLabel').textContent = `GAQI ${gaqi.toFixed(1)}`;

      const aql = Number(idx.AQL ?? 0);
      const tci = Number(idx.TCI ?? 0);
      const gei = Number(idx.GEI ?? 0);
      const sri = Number(idx.SRI ?? 0);
      subbarsChart.data.datasets[0].data = [aql,tci,gei,sri];
      subbarsChart.update('none');

      updateMeasuresGrid(m);

    }catch(e){
      console.error("dashboard loop err", e);
    }finally{
      setTimeout(loop,1000);
    }
  }

  window.addEventListener('load', ()=>{
    createDonut();
    createSubbars();
    loop();
  });
})();

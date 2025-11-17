/* assets/js/events.js */
(function(){
  const { fetchHistory } = window.IndoorAPI;
  async function build(){
    try{
      const json = await fetchHistory(1800);
      const series = json.series || [];
      if(!series.length) return;
      const co2 = series.map(s=>s.measures.co2);
      const windowSize = 30;
      const labels=[]; const sigmas=[];
      for(let i=windowSize;i<co2.length;i++){
        const slice = co2.slice(i-windowSize,i);
        const mean = slice.reduce((a,b)=>a+b,0)/slice.length;
        const sigma = Math.sqrt(slice.reduce((a,b)=>a+(b-mean)*(b-mean),0)/slice.length);
        labels.push(series[i].timestamp);
        sigmas.push(sigma);
      }
      new Chart(document.getElementById('volChart').getContext('2d'), {
        type:'line',
        data:{ labels, datasets:[{ label:'σ CO₂', data:sigmas, borderColor:'#E54848', tension:0.2 }]},
        options:{ animation:false, scales:{ x:{ display:false } } }
      });
    }catch(e){ console.error(e); }
  }
  window.addEventListener('load', build);
})();

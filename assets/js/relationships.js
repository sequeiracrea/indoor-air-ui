/* assets/js/relationships.js */
(function(){
  const VARS = ['co','co2','no2','nh3','temp','rh','pres'];
  const { fetchHistory } = window.IndoorAPI;

  function corrColor(r){
    if(r>0.6) return '#3B82F6';
    if(r>0.3) return '#06B6D4';
    if(r>-0.3) return '#D1D5DB';
    if(r>-0.6) return '#A855F7';
    return '#DB2777';
  }

  function pearson(a,b){
    const n = a.length;
    if(n<2) return 0;
    const ma = a.reduce((s,x)=>s+x,0)/n;
    const mb = b.reduce((s,x)=>s+x,0)/n;
    let num=0, denA=0, denB=0;
    for(let i=0;i<n;i++){
      const da=a[i]-ma, db=b[i]-mb;
      num+=da*db; denA+=da*da; denB+=db*db;
    }
    const den = Math.sqrt(denA*denB); return den? num/den : 0;
  }

  async function buildGrid(){
    try{
      const json = await fetchHistory(3600);
      const series = json.series || [];
      const container = document.getElementById('matrix-container');
      container.innerHTML = '';

      const dataMap = {};
      VARS.forEach(v => dataMap[v] = series.map(s => (s.measures && s.measures[v] != null) ? s.measures[v] : null).filter(x=>x!=null));

      // grid: create cells in row-major
      for(let i=0;i<VARS.length;i++){
        for(let j=0;j<VARS.length;j++){
          const cell = document.createElement('div');
          cell.className = 'matrix-cell';
          if(i===j){
            cell.innerHTML = `<div class="mini-histo">📊 ${VARS[i]}</div>`;
          } else if(j>i){
            const a = dataMap[VARS[i]] || [];
            const b = dataMap[VARS[j]] || [];
            let r = 0;
            if(a.length>=2 && a.length===b.length) r = pearson(a,b);
            cell.style.background = corrColor(r);
            cell.innerHTML = `<div class="corr-val">${r.toFixed(2)}</div>`;
            cell.addEventListener('click', ()=> window.location.href = `gases.html?x=${VARS[i]}&y=${VARS[j]}`);
          } else {
            cell.classList.add('mirror');
          }
          container.appendChild(cell);
        }
      }
    }catch(e){ console.error("relationships err", e); }
  }

  window.addEventListener('load', buildGrid);
})();

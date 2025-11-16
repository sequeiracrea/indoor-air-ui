const VARS = ['co','co2','no2','nh3','temp','rh','pres'];

function corrColor(r) {
  if (r > 0.6) return '#3B82F6';
  if (r > 0.3) return '#06B6D4';
  if (r > -0.3) return '#D1D5DB';
  if (r > -0.6) return '#A855F7';
  return '#DB2777';
}

async function buildGrid() {
  const API_URL = "https://indoor-sim-server.onrender.com/history?sec=3600";
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    const series = json.series;

    const container = document.getElementById('matrix-container');
    container.innerHTML = '';

    const dataMap = {};
    VARS.forEach(v => dataMap[v] = series.map(d => d.measures[v]).filter(x=>x!=null));

    for (let i=0;i<VARS.length;i++){
      const row = document.createElement('div');
      row.className = 'matrix-row';
      for (let j=0;j<VARS.length;j++){
        const cell = document.createElement('div');
        cell.className = 'matrix-cell';

        if(i===j){
          cell.innerHTML = `<div class="mini-histo">📊 ${VARS[i]}</div>`;
        } else if (j>i){
          const a = dataMap[VARS[i]];
          const b = dataMap[VARS[j]];
          let r=0;
          if(a.length>=2 && a.length===b.length){
            const n = a.length;
            const ma = a.reduce((s,x)=>s+x,0)/n;
            const mb = b.reduce((s,x)=>s+x,0)/n;
            let num=0, denA=0, denB=0;
            for(let k=0;k<n;k++){
              const da=a[k]-ma; const db=b[k]-mb;
              num+=da*db; denA+=da*da; denB+=db*db;
            }
            r = Math.sqrt(denA*denB)===0 ? 0 : num/Math.sqrt(denA*denB);
          }
          cell.style.background = corrColor(r);
          cell.innerHTML = `<div class="corr-val">${r.toFixed(2)}</div>`;
          cell.addEventListener('click',()=>window.location.href=`gases.html?x=${VARS[i]}&y=${VARS[j]}`);
        } else {
          cell.classList.add('mirror');
        }

        row.appendChild(cell);
      }
      container.appendChild(row);
    }

  } catch(e){
    console.error("Erreur relationships.js:", e);
  }
}

window.addEventListener('load', buildGrid);

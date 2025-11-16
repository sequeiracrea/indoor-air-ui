const API_URL = "https://indoor-sim-server.onrender.com/data";

const vars = ["CO","CO2","NO2","NH3","Temp","Hum","Press"];

async function fetchData() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    return json;
  } catch(e) {
    console.error("Erreur fetch Relationship:", e);
    return [];
  }
}

function corrColor(r) {
  if (r > 0.6) return "#3B82F6";      // bleu fort
  if (r > 0.3) return "#06B6D4";      // bleu clair
  if (r > -0.3) return "#D1D5DB";     // gris neutre
  if (r > -0.6) return "#A855F7";     // violet
  return "#DB2777";                    // rouge
}

function pearsonCorr(x, y) {
  const n = x.length;
  const avgX = x.reduce((a,b)=>a+b,0)/n;
  const avgY = y.reduce((a,b)=>a+b,0)/n;
  const numerator = x.map((v,i)=> (v-avgX)*(y[i]-avgY)).reduce((a,b)=>a+b,0);
  const denom = Math.sqrt(
    x.map(v=>Math.pow(v-avgX,2)).reduce((a,b)=>a+b,0) *
    y.map(v=>Math.pow(v-avgY,2)).reduce((a,b)=>a+b,0)
  );
  return denom ? numerator/denom : 0;
}

async function buildGrid() {
  const data = await fetchData();
  const container = document.getElementById("matrix-container");
  container.innerHTML = "";

  // Préparer un tableau des valeurs pour chaque variable
  const varValues = {};
  vars.forEach(v => varValues[v] = data.map(d => d[v]));

  for (let i=0;i<vars.length;i++){
    for (let j=0;j<vars.length;j++){
      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      if (i===j) {
        cell.innerHTML = `<div class="mini-histo">📊 ${vars[i]}</div>`;
      } else if (j>i){
        const r = pearsonCorr(varValues[vars[i]], varValues[vars[j]]);
        cell.style.background = corrColor(r);
        cell.innerHTML = `<div class="corr-val">${r.toFixed(2)}</div>`;
        cell.addEventListener("click", ()=> {
          window.location.href = `gases.html?x=${vars[i]}&y=${vars[j]}`;
        });
      } else {
        cell.classList.add("mirror");
      }
      container.appendChild(cell);
    }
  }
}

window.addEventListener("load", buildGrid);

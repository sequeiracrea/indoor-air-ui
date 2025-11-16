import { fetchCorr } from './api.js';

const vars = ['co','co2','no2','nh3','temp','rh','pres']; // adjust order
async function buildGrid() {
  const res = await fetchCorr(vars.join(','), 3600);
  // build HTML table / grid
  const container = document.getElementById('matrix-container');
  container.innerHTML = '';
  for (let i=0;i<vars.length;i++){
    const row = document.createElement('div');
    row.className = 'matrix-row';
    for (let j=0;j<vars.length;j++){
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      if (i===j) {
        // show mini histogram placeholder (we won't compute histogram here)
        cell.innerHTML = `<div class="mini-histo">🔳 ${vars[i]}</div>`;
      } else if (j>i) {
        // get corr key
        const key = `${vars[i]}-${vars[j]}`;
        const val = res.corr[key] ?? res.corr[`${vars[j]}-${vars[i]}`] ?? 0;
        const color = corrColor(val);
        cell.style.background = color;
        cell.innerHTML = `<div class="corr-val">${val.toFixed(2)}</div>`;
        cell.addEventListener('click', ()=> openDetail(vars[i], vars[j]));
      } else {
        cell.classList.add('mirror');
      }
      row.appendChild(cell);
    }
    container.appendChild(row);
  }
}
function corrColor(r) {
  // map -1..1 to color scale
  if (r > 0.6) return '#3B82F6';
  if (r > 0.3) return '#06B6D4';
  if (r > -0.3) return '#D1D5DB';
  if (r > -0.6) return '#A855F7';
  return '#DB2777';
}
function openDetail(a,b) {
  // navigate to a focused scatter (gases page) or open modal
  window.location.href = `gases.html?x=${a}&y=${b}`;
}

window.addEventListener('load', buildGrid);


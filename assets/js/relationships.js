// au lieu de import
// import { fetchCorr } from './api.js';

const fetchCorr = window.IndoorAPI.fetchCorr;


let vars = ['co','co2','no2','nh3','temp','rh','pres'];
let modeLibre = true;

async function buildGrid() {
  const container = document.getElementById('matrix-container');
  container.innerHTML = '';

  const res = await fetchCorr(vars.join(','), 3600);

  // CSS Grid setup
  container.style.setProperty('--cols', vars.length);
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${vars.length}, 1fr)`;

  for (let i = 0; i < vars.length; i++) {
    for (let j = 0; j < vars.length; j++) {
      const cell = document.createElement('div');
      cell.className = 'matrix-cell';
      cell.dataset.row = i;
      cell.dataset.col = j;

      if (i === j) {
        cell.classList.add('diagonal');
        cell.innerText = vars[i].toUpperCase();
      } else if (j > i) {
        const key = `${vars[i]}-${vars[j]}`;
        const val = res.corr[key] ?? res.corr[`${vars[j]}-${vars[i]}`] ?? 0;
        cell.style.background = corrColor(val);
        cell.innerHTML = `<div>${val.toFixed(2)}</div>`;

        // clic pour ouvrir scatter ciblé
        cell.addEventListener('click', () => {
          window.location.href = `gases.html?x=${vars[i]}&y=${vars[j]}`;
        });

        // hover sur ligne/colonne
        cell.addEventListener('mouseenter', () => highlightLineCol(i, j));
        cell.addEventListener('mouseleave', clearHighlight);
      } else {
        cell.classList.add('mirror'); // cellule triangle bas
      }

      container.appendChild(cell);
    }
  }
}

// Mapping -1..1 vers couleur
function corrColor(r) {
  if (r > 0.6) return '#3B82F6';
  if (r > 0.3) return '#06B6D4';
  if (r > -0.3) return '#D1D5DB';
  if (r > -0.6) return '#A855F7';
  return '#DB2777';
}

// Hover effect
function highlightLineCol(i, j) {
  document.querySelectorAll(`.matrix-cell[data-row='${i}'], .matrix-cell[data-col='${j}']`)
          .forEach(c => c.classList.add('hovered'));
}
function clearHighlight() {
  document.querySelectorAll('.matrix-cell.hovered')
          .forEach(c => c.classList.remove('hovered'));
}

// Tri par corrélation moyenne
function avgCorr(v) {
  const res = window.lastCorr || {};
  const keys = Object.keys(res);
  let sum = 0, count = 0;
  for (let k of keys) {
    if (k.includes(v)) {
      sum += Math.abs(res[k]);
      count++;
    }
  }
  return count ? sum / count : 0;
}

// Toggle mode
const toggle = document.getElementById('mode-toggle');
toggle?.addEventListener('click', () => {
  modeLibre = !modeLibre;
  if (!modeLibre && window.lastCorr) {
    vars.sort((a, b) => avgCorr(b) - avgCorr(a));
  } else {
    vars.sort(); // ordre alphabétique
  }
  buildGrid();
});

window.addEventListener('load', async () => {
  const container = document.getElementById('matrix-container');
  // fetch une fois pour stocker les corr
  window.lastCorr = (await fetchCorr(vars.join(','), 3600)).corr;
  buildGrid();
});

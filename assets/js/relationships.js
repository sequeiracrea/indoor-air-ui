import { API } from "./api.js";

/**
 * Charge la matrice de corrélation
 */
async function loadCorr() {
  const vars = [...document.getElementById("var-selector").selectedOptions].map(o => o.value);

  const url = `${API}/corr?vars=${vars.join(",")}&sec=1800`;
  const res = await fetch(url);
  const data = await res.json();

  buildMatrix(data.vars, data.corr);
}

/**
 * Construit la matrice visuelle
 */
function buildMatrix(vars, corr) {
  const container = document.getElementById("matrix-container");
  container.innerHTML = "";

  for (let i = 0; i < vars.length; i++) {
    for (let j = 0; j < vars.length; j++) {
      const v1 = vars[i];
      const v2 = vars[j];

      const cell = document.createElement("div");

      // DIAGONALE
      if (v1 === v2) {
        cell.className = "matrix-cell diagonal";
        cell.innerHTML = `<strong>${v1}</strong><small>auto</small>`;
        container.appendChild(cell);
        continue;
      }

      // RECUP CORR
      const key1 = `${v1}-${v2}`;
      const key2 = `${v2}-${v1}`;
      const r = corr[key1] ?? corr[key2] ?? 0;

      // classes selon signe
      let cls = "corr-neutral";
      if (r > 0.3) cls = "corr-pos";
      if (r < -0.3) cls = "corr-neg";

      // cercle proportionnel
      const magnitude = Math.abs(r);
      const size = 15 + magnitude * 45; // 15 → 60 px

      cell.className = `matrix-cell ${cls}`;
      cell.innerHTML = `
        <div class="corr-dot" 
             style="width:${size}px; height:${size}px; background:white; opacity:0.85;"></div>
        <strong>${r}</strong>
        <small>${v1} vs ${v2}</small>
      `;

      // Click → page scatter
      cell.addEventListener("click", () => {
        window.location.href = `gases.html?x=${v1}&y=${v2}`;
      });

      // tooltip explicatif
      cell.title = 
        `Corrélation : ${r}
Relation : ${v1} ↔ ${v2}
Tendance : ${r > 0 ? "positive" : "négative"}`;

      container.appendChild(cell);
    }
  }
}

/**
 * Initialisation
 */
window.addEventListener("load", loadCorr);

// bouton "Mettre à jour"
document.getElementById("apply-vars").addEventListener("click", loadCorr);

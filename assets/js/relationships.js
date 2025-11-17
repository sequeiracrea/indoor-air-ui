// assets/js/relationships.js
const API = "https://indoor-sim-server.onrender.com";

async function fetchCorr() {
  try {
    const url = `${API}/corr?vars=co2,no2,nh3,co,temp,rh,pres&sec=1800`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !data.corr || !data.vars) {
      console.error("Corr API invalide :", data);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Erreur fetchCorr:", err);
    return null;
  }
}

function colorForCorr(r) {
  if (r > 0.6) return "#4c7df0";   // positif fort
  if (r < -0.6) return "#b34cff";  // négatif fort
  return "#ccc";                  // neutre
}

function buildMatrix(vars, corr) {
  const container = document.getElementById("matrix-container");
  container.innerHTML = "";

  vars.forEach(v1 => {
    vars.forEach(v2 => {
      const key = `${v1}-${v2}`;
      const r = corr[key] ?? 0;

      const cell = document.createElement("div");
      cell.className = "matrix-cell";
      cell.style.backgroundColor = colorForCorr(r);
      cell.innerHTML = `<strong>${r}</strong><br><small>${v1} / ${v2}</small>`;

      cell.onclick = () => {
        // ouvre un scatter dynamique (tu me diras si tu veux le générer)
        window.location.href = `scatterbar.html?x=${v1}&y=${v2}`;
      };

      container.appendChild(cell);
    });
  });
}

async function init() {
  const data = await fetchCorr();
  if (!data) return;

  buildMatrix(data.vars, data.corr);
}

init();

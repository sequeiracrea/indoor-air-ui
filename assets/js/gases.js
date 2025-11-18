// ------------------------------------------------------
// CONFIG : couleurs associées aux gaz
// ------------------------------------------------------
const GAS_COLORS = {
  co2: "#4CAF50",
  no2: "#FF5722",
  o3: "#3F51B5",
  pm25: "#9C27B0",
  pm10: "#FFC107",
  temp: "#E91E63",
  pres: "#795548",
  rh: "#03A9F4",
  voc: "#8BC34A"
};

// ------------------------------------------------------
// PRESETS D’ANALYSE
// ------------------------------------------------------
const PRESETS = [
  {
    id: "pollution_vs_meteo",
    name: "Polluants vs Facteurs Météo",
    x: "no2",
    y: "temp",
    description: "Analyse de l’effet de la température sur les polluants urbains."
  },
  {
    id: "humidité_vs_particules",
    name: "Humidité vs Particules",
    x: "rh",
    y: "pm25",
    description: "Met en lumière l’impact de l’humidité sur la concentration en particules fines."
  },
  {
    id: "pression_vs_o3",
    name: "Pression atmosphérique vs Ozone",
    x: "pres",
    y: "o3",
    description: "Analyse des comportements de l’ozone selon les variations de pression."
  }
];

// ------------------------------------------------------
// Récupération sélection depuis Relationships si existe
// ------------------------------------------------------
function getSelectionFromQuery() {
  const params = new URLSearchParams(window.location.search);

  if (params.has("x") && params.has("y")) {
    return {
      x: params.get("x"),
      y: params.get("y")
    };
  }
  return null;
}

// ------------------------------------------------------
// Variables globales
// ------------------------------------------------------
let dataRecords = [];
let histogramX = null;
let histogramY = null;
let scatterChart = null;

// ------------------------------------------------------
// Initialisation chargement data
// ------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  fetch("data/dataset.json")
    .then(res => res.json())
    .then(json => {
      dataRecords = json;
      initUI();
      buildAllCharts();
    });
});

// ------------------------------------------------------
// UI : initialise presets et sélection X/Y
// ------------------------------------------------------
function initUI() {
  const selX = document.getElementById("select-x");
  const selY = document.getElementById("select-y");
  const selPreset = document.getElementById("preset-select");
  const presetDescription = document.getElementById("preset-description");

  // Remplir presets
  PRESETS.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    selPreset.appendChild(opt);
  });

  // Créer options variables gas
  Object.keys(GAS_COLORS).forEach(g => {
    let o1 = document.createElement("option");
    o1.value = g;
    o1.textContent = g.toUpperCase();
    selX.appendChild(o1);

    let o2 = document.createElement("option");
    o2.value = g;
    o2.textContent = g.toUpperCase();
    selY.appendChild(o2);
  });

  // Gestion du preset
  selPreset.addEventListener("change", () => {
    const preset = PRESETS.find(p => p.id === selPreset.value);
    if (!preset) return;

    selX.value = preset.x;
    selY.value = preset.y;

    presetDescription.textContent = preset.description;
    buildAllCharts();
  });

  // Mise à jour en direct si l’utilisateur change X ou Y
  selX.addEventListener("change", () => {
    selPreset.value = "";
    presetDescription.textContent = "";
    buildAllCharts();
  });

  selY.addEventListener("change", () => {
    selPreset.value = "";
    presetDescription.textContent = "";
    buildAllCharts();
  });

  // Appliquer la sélection venant de Relationship page
  const external = getSelectionFromQuery();
  if (external) {
    selX.value = external.x;
    selY.value = external.y;
    selPreset.value = "";
    presetDescription.textContent = "";
  }
}

// ------------------------------------------------------
// Construction complète des charts
// ------------------------------------------------------
function buildAllCharts() {
  const xVar = document.getElementById("select-x").value;
  const yVar = document.getElementById("select-y").value;

  buildHistogram("histogram-x", xVar, true);
  buildHistogram("histogram-y", yVar, false);
  buildScatter(xVar, yVar);
}

// ------------------------------------------------------
// HISTOGRAMMES
// ------------------------------------------------------
function buildHistogram(canvasId, variable, isX) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const values = dataRecords.map(r => r[variable]);

  if ((isX && histogramX) || (!isX && histogramY)) {
    (isX ? histogramX : histogramY).destroy();
  }

  const chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: values,
      datasets: [{
        label: variable.toUpperCase(),
        data: values,
        backgroundColor: GAS_COLORS[variable]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  if (isX) histogramX = chart;
  else histogramY = chart;
}

// ------------------------------------------------------
// SCATTER avec doubles légendes personnalisées
// ------------------------------------------------------
function buildScatter(xVar, yVar) {
  const ctx = document.getElementById("scatter-plot").getContext("2d");

  if (scatterChart) scatterChart.destroy();

  const points = dataRecords.map(r => ({
    x: r[xVar],
    y: r[yVar],
    backgroundColor: mixColors(GAS_COLORS[xVar], GAS_COLORS[yVar], 0.5),
    borderColor: mixColors(GAS_COLORS[xVar], GAS_COLORS[yVar], 0.5)
  }));

  scatterChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "",   // IMPORTANT : empêche la création de la 3e légende
          data: points,
          pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            generateLabels: chart => [
              {
                text: xVar.toUpperCase(),
                fillStyle: GAS_COLORS[xVar],
                strokeStyle: GAS_COLORS[xVar],
                lineWidth: 2
              },
              {
                text: yVar.toUpperCase(),
                fillStyle: GAS_COLORS[yVar],
                strokeStyle: GAS_COLORS[yVar],
                lineWidth: 2
              }
            ]
          }
        }
      },
      scales: {
        x: { title: { display: true, text: xVar.toUpperCase() } },
        y: { title: { display: true, text: yVar.toUpperCase() } }
      }
    }
  });
}

// ------------------------------------------------------
// Mélange 2 couleurs (pour la teinte des points)
// ------------------------------------------------------
function mixColors(c1, c2, ratio) {
  const r1 = parseInt(c1.substr(1, 2), 16);
  const g1 = parseInt(c1.substr(3, 2), 16);
  const b1 = parseInt(c1.substr(5, 2), 16);

  const r2 = parseInt(c2.substr(1, 2), 16);
  const g2 = parseInt(c2.substr(3, 2), 16);
  const b2 = parseInt(c2.substr(5, 2), 16);

  const r = Math.floor(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.floor(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.floor(b1 * (1 - ratio) + b2 * ratio);

  return `rgb(${r}, ${g}, ${b})`;
}

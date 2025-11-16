import Chart from "https://cdn.jsdelivr.net/npm/chart.js@4.3.0/dist/chart.esm.min.js";

const API_URL = "https://indoor-sim-server.onrender.com/history?sec=3600"; // dernière heure

async function buildScatterBar() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    const data = json.series; // tableau de mesures

    if (!data || !Array.isArray(data)) {
      console.error("Data API vide ou invalide:", json);
      return;
    }

    // Scatter Temp vs Hum
    const scatterCtx = document.getElementById("mainScatter").getContext("2d");
    new Chart(scatterCtx, {
      type: "scatter",
      data: {
        datasets: [{
          label: "Temp vs Hum",
          data: data.map(d => ({ x: d.measures.temp, y: d.measures.rh })),
          backgroundColor: "rgba(255,99,132,0.6)"
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Temp (°C)" } },
          y: { title: { display: true, text: "Hum (%)" } }
        }
      }
    });

    // Moyenne des gaz pour stacked bar
    const avgCO2 = data.reduce((a,d)=>a+d.measures.co2,0)/data.length;
    const avgNO2 = data.reduce((a,d)=>a+d.measures.no2,0)/data.length;
    const avgNH3 = data.reduce((a,d)=>a+d.measures.nh3,0)/data.length;

    const barCtx = document.getElementById("stackedBar").getContext("2d");
    new Chart(barCtx, {
      type: "bar",
      data: {
        labels: ["Gaz moyens"],
        datasets: [
          { label: "CO2", data: [avgCO2], backgroundColor: "#3B82F6" },
          { label: "NO2", data: [avgNO2], backgroundColor: "#F59E0B" },
          { label: "NH3", data: [avgNH3], backgroundColor: "#10B981" }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: "top" } } }
    });

  } catch(e) {
    console.error("Erreur scatterbar:", e);
  }
}

window.addEventListener("load", buildScatterBar);

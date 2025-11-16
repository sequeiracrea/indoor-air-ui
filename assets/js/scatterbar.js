const API_URL = "https://indoor-sim-server.onrender.com/data";

async function buildScatterBar() {
  try {
    const res = await fetch(API_URL);
    const json = await res.json();

    const data = Array.isArray(json) ? json : json.data;
    if (!data || !Array.isArray(data)) {
      console.error("Data API vide ou invalide:", json);
      return;
    }

    const scatterCtx = document.getElementById("mainScatter").getContext("2d");
    new Chart(scatterCtx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Temp vs Hum",
            data: data.map(d => ({ x: d.Temp, y: d.Hum })),
            backgroundColor: "rgba(255,99,132,0.6)"
          }
        ]
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Temp (°C)" } },
          y: { title: { display: true, text: "Hum (%)" } }
        }
      }
    });

    const avgCO2 = data.reduce((a,d)=>a+d.CO2,0)/data.length;
    const avgNO2 = data.reduce((a,d)=>a+d.NO2,0)/data.length;
    const avgNH3 = data.reduce((a,d)=>a+d.NH3,0)/data.length;

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

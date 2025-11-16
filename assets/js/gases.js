async function buildGases() {
  const API_URL = "https://indoor-sim-server.onrender.com/history?sec=3600";
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    const data = json.series;

    if (!data || !Array.isArray(data)) {
      console.error("Data API vide ou invalide:", json);
      return;
    }

    const gases = ["co","co2","no2","nh3"];
    gases.forEach(g => {
      const ctx = document.getElementById(`${g}Chart`).getContext("2d");
      new Chart(ctx, {
        type: "line",
        data: {
          labels: data.map(d => d.timestamp),
          datasets: [{
            label: g.toUpperCase(),
            data: data.map(d => d.measures[g]),
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59,130,246,0.2)",
            tension: 0.3
          }]
        },
        options: {
          responsive: true,
          scales: { x: { display: false }, y: { beginAtZero: true } }
        }
      });
    });

  } catch(e) {
    console.error("Erreur gases.js:", e);
  }
}

window.addEventListener("load", buildGases);

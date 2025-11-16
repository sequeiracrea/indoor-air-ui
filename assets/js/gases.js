const API_URL = "https://indoor-sim-server.onrender.com/data";

function getParams() {
  const params = new URLSearchParams(window.location.search);
  return [params.get("x") || "CO2", params.get("y") || "NO2"];
}

async function buildScatter() {
  const data = await (await fetch(API_URL)).json();
  const [xVar, yVar] = getParams();

  const ctx = document.getElementById("gasesScatter").getContext("2d");
  new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [{
        label: `${xVar} vs ${yVar}`,
        data: data.map(d => ({x: d[xVar], y: d[yVar]})),
        backgroundColor: "rgba(75,192,192,0.6)"
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: xVar } },
        y: { title: { display: true, text: yVar } }
      }
    }
  });
}

window.addEventListener("load", buildScatter);

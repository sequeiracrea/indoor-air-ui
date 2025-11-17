/* assets/js/gases.js
   UMD — utilise Chart.js global (chart.umd.min.js) and window.IndoorAPI
*/

(function(){
  function getQuery() {
    const p = new URLSearchParams(window.location.search);
    return { x: p.get("x") || "co2", y: p.get("y") || "no2" };
  }

  function safeVal(v){ return (v==null || v===undefined) ? null : Number(v); }

  async function buildScatter() {
    const { x, y } = getQuery();
    // ensure API present
    const api = window.IndoorAPI;
    if (!api) {
      console.error("IndoorAPI missing");
      return;
    }

    // fetch history (1h)
    let hist;
    try {
      hist = await api.fetchHistory(3600);
    } catch (e) {
      console.error("fetchHistory error", e);
      return;
    }
    const series = hist.series || [];
    if (!series.length) {
      console.warn("no series data");
    }

    // build points
    const points = series.map(s => ({ x: safeVal(s.measures && s.measures[x]), y: safeVal(s.measures && s.measures[y]) }))
                         .filter(p => p.x !== null && p.y !== null);

    // if no points, show message
    const canvas = document.getElementById("gasesScatter");
    if(!canvas){ console.error("canvas gasesScatter not found"); return; }

    // compute bounds with padding
    const xs = points.map(p=>p.x), ys = points.map(p=>p.y);
    const minX = xs.length? Math.min(...xs):0;
    const maxX = xs.length? Math.max(...xs):1;
    const minY = ys.length? Math.min(...ys):0;
    const maxY = ys.length? Math.max(...ys):1;
    const padX = (maxX - minX) * 0.08 || 1;
    const padY = (maxY - minY) * 0.08 || 1;

    // destroy previous Chart if any (safe)
    if (canvas._chartInstance) {
      canvas._chartInstance.destroy();
      canvas._chartInstance = null;
    }

    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "scatter",
      data: { datasets: [{ label: `${x.toUpperCase()} vs ${y.toUpperCase()}`, data: points, backgroundColor: "#3B82F6" }] },
      options: {
        responsive:true,
        plugins: { legend: { display: true } },
        scales: {
          x: { title: { display: true, text: x.toUpperCase() }, min: minX - padX, max: maxX + padX },
          y: { title: { display: true, text: y.toUpperCase() }, min: minY - padY, max: maxY + padY }
        }
      }
    });

    // save instance reference
    canvas._chartInstance = chart;

    // set page title if element exists
    const titleEl = document.getElementById("dynamicTitle");
    if (titleEl) titleEl.innerText = `${x.toUpperCase()} vs ${y.toUpperCase()}`;
  }

  window.addEventListener("load", buildScatter);
})();

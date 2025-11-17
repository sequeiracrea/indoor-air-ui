/* assets/js/relationships.js
   UMD — utilise window.IndoorAPI fourni par assets/js/api.js
*/

(function () {
  // variables par défaut (ordre d'affichage)
  const DEFAULT_VARS = ["co2", "co", "no2", "nh3", "temp", "rh", "pres"];
  const DEFAULT_SEC = 3600; // 1h

  // utilitaires
  function corrColor(r) {
    if (r > 0.6) return "#3B82F6";
    if (r > 0.3) return "#06B6D4";
    if (r > -0.3) return "#D1D5DB";
    if (r > -0.6) return "#A855F7";
    return "#DB2777";
  }
  function safeNum(v) { return (typeof v === "number") ? v : 0; }
  function round2(v){ return Number(v).toFixed(2); }

  // Build full grid (diagonale + upper + lower)
  async function buildFullGrid(vars) {
    const container = document.getElementById("matrix-container");
    if (!container) return console.error("matrix-container introuvable");
    container.innerHTML = "<div style='opacity:.6'>Chargement…</div>";

    // ensure API available
    const api = window.IndoorAPI;
    if (!api || !api.fetchCorr) {
      container.innerHTML = "<div style='color:crimson'>API indisponible</div>";
      return;
    }

    // fetch corr from server (/corr). if fails, fallback to history-based (client)
    let corrObj = null;
    try {
      const resp = await api.fetchCorr(vars.join(","), DEFAULT_SEC);
      if (resp && resp.corr) corrObj = resp.corr;
    } catch (e) {
      console.warn("/corr failed, fallback to compute from history", e);
    }

    if (!corrObj) {
      // fallback compute from history
      try {
        const h = await api.fetchHistory(DEFAULT_SEC);
        const series = h.series || [];
        const dataMap = {};
        vars.forEach(v => dataMap[v] = series.map(s => (s.measures && s.measures[v] != null) ? s.measures[v] : null).filter(x=>x!=null));
        corrObj = {};
        for (let i=0;i<vars.length;i++){
          for (let j=0;j<vars.length;j++){
            const a = dataMap[vars[i]]||[], b = dataMap[vars[j]]||[];
            let rVal = 0;
            if (a.length>=2 && a.length === b.length){
              const n=a.length;
              const ma = a.reduce((s,x)=>s+x,0)/n;
              const mb = b.reduce((s,x)=>s+x,0)/n;
              let num=0, da2=0, db2=0;
              for(let k=0;k<n;k++){
                const da=a[k]-ma, db=b[k]-mb;
                num+=da*db; da2+=da*da; db2+=db*db;
              }
              const den = Math.sqrt(da2*db2);
              rVal = den? num/den : 0;
            }
            corrObj[`${vars[i]}-${vars[j]}`] = parseFloat((rVal||0).toFixed(3));
          }
        }
      } catch (e) {
        console.error("fallback history failed", e);
        container.innerHTML = "<div style='color:crimson'>Impossible de récupérer les corrélations</div>";
        return;
      }
    }

    // Build CSS grid structure: set number of columns equal to vars.length
    container.style.display = "grid";
    container.style.gridTemplateColumns = `repeat(${vars.length}, 1fr)`;
    container.style.gap = "6px";
    container.innerHTML = "";

    // create cells row-major
    for (let i=0;i<vars.length;i++){
      for (let j=0;j<vars.length;j++){
        const v1 = vars[i], v2 = vars[j];
        const cell = document.createElement("div");
        cell.className = "matrix-cell";
        cell.style.minHeight = "64px";
        cell.style.display = "flex";
        cell.style.flexDirection = "column";
        cell.style.alignItems = "center";
        cell.style.justifyContent = "center";
        cell.style.borderRadius = "8px";
        cell.style.color = "#fff";
        cell.style.fontWeight = "600";
        cell.dataset.row = i;
        cell.dataset.col = j;

        if (i === j) {
          // diagonal
          cell.classList.add("diagonal");
          cell.style.background = "#111827";
          cell.innerHTML = `<div style="font-size:0.95rem">${v1.toUpperCase()}</div><small style="opacity:.85">auto</small>`;
        } else {
          // find correlation (server may store both orders)
          const k1 = `${v1}-${v2}`, k2 = `${v2}-${v1}`;
          let r = corrObj[k1];
          if (r === undefined) r = corrObj[k2];
          if (r === undefined) r = 0;
          const color = corrColor(safeNum(r));
          cell.style.background = color;

          // dot size + display
          const mag = Math.min(1, Math.abs(r));
          const size = Math.round(12 + mag * 48); // 12..60
          const dot = document.createElement("div");
          dot.style.width = dot.style.height = `${size}px`;
          dot.style.borderRadius = "50%";
          dot.style.background = "#fff";
          dot.style.opacity = "0.95";
          dot.style.marginBottom = "6px";

          const num = document.createElement("div");
          num.textContent = round2(r);
          num.style.fontSize = "0.9rem";

          const lbl = document.createElement("small");
          lbl.textContent = `${v1} ↔ ${v2}`;
          lbl.style.opacity = ".9";

          cell.appendChild(dot);
          cell.appendChild(num);
          cell.appendChild(lbl);

          // click -> open gases.html?x=...&y=...
          cell.addEventListener("click", ()=> {
            const url = `gases.html?x=${encodeURIComponent(v1)}&y=${encodeURIComponent(v2)}`;
            window.location.href = url;
          });

          // hover highlight row & column
          cell.addEventListener("mouseenter", ()=> {
            // highlight row i
            const allCells = container.querySelectorAll(".matrix-cell");
            allCells.forEach(c => {
              if (c.dataset.row === String(i) || c.dataset.col === String(j)) {
                c.classList.add("hovered");
              }
            });
          });
          cell.addEventListener("mouseleave", ()=> {
            const all = container.querySelectorAll(".matrix-cell.hovered");
            all.forEach(c=>c.classList.remove("hovered"));
          });

          // tooltip
          cell.title = `r = ${round2(r)}\n${v1} ↔ ${v2}`;
        }

        container.appendChild(cell);
      }
    }
  }

  // wire select & buttons
  function setUpControls() {
    const apply = document.getElementById("apply-vars");
    const reset = document.getElementById("reset-vars");
    const sel = document.getElementById("var-selector");

    if (apply) apply.addEventListener("click", ()=> {
      const selVars = sel ? [...sel.selectedOptions].map(o=>o.value) : DEFAULT_VARS.slice();
      const list = selVars.length? selVars : DEFAULT_VARS.slice();
      buildFullGrid(list);
    });

    if (reset) reset.addEventListener("click", ()=> {
      if (sel) for(let i=0;i<sel.options.length;i++) sel.options[i].selected = true;
      buildFullGrid(DEFAULT_VARS.slice());
    });
  }

  // init on load
  window.addEventListener("load", ()=> {
    setUpControls();
    buildFullGrid(DEFAULT_VARS.slice());
  });

})();

/* assets/js/relationships.js
   Version UMD compatible avec window.IndoorAPI (assets/js/api.js)
*/

(function(){
  // Utilise IndoorAPI défini par assets/js/api.js
  const API_BASE = (window.IndoorAPI && window.IndoorAPI.API_BASE) ? window.IndoorAPI.API_BASE : "https://indoor-sim-server.onrender.com";
  const DEFAULT_SEC = 1800;

  // variables par défaut dans l'ordre affiché
  const DEFAULT_VARS = ['co2','co','no2','nh3','temp','rh','pres'];

  // utilitaires
  function corrColorClass(r){
    if (r === null || r === undefined) return 'corr-neutral';
    if (r > 0.3) return 'corr-pos';
    if (r < -0.3) return 'corr-neg';
    return 'corr-neutral';
  }

  function safeRound(v){
    if (typeof v !== 'number') return '0.00';
    return v.toFixed(2);
  }

  // construit la matrice visuelle
  function buildMatrix(vars, corrObj){
    const container = document.getElementById('matrix-container');
    if(!container) {
      console.error("matrix container introuvable");
      return;
    }
    container.innerHTML = '';

    // grille: rows * cols
    for (let i=0;i<vars.length;i++){
      for (let j=0;j<vars.length;j++){
        const v1 = vars[i], v2 = vars[j];
        const cell = document.createElement('div');
        cell.className = 'matrix-cell';

        // diagonale
        if (i === j) {
          cell.classList.add('diagonal');
          cell.innerHTML = `<strong>${v1}</strong><small>auto</small>`;
          container.appendChild(cell);
          continue;
        }

        // récupérer corrélation (corr stocké 'a-b' for a<=b server side maybe both)
        const key1 = `${v1}-${v2}`;
        const key2 = `${v2}-${v1}`;
        let r = corrObj[key1];
        if (r === undefined) r = corrObj[key2];
        if (r === undefined) r = 0;

        const cls = corrColorClass(r);
        cell.classList.add(cls);

        // taille du dot proportionnelle à |r|
        const mag = Math.min(1, Math.abs(r)); // 0..1
        const size = Math.round(14 + mag * 46); // 14..60 px

        cell.innerHTML = `
          <div class="corr-dot" style="width:${size}px;height:${size}px;background:white;border-radius:50%;opacity:0.95;margin-bottom:8px"></div>
          <strong style="display:block;margin-bottom:4px">${safeRound(r)}</strong>
          <small style="opacity:0.9">${v1} ↔ ${v2}</small>
        `;

        // tooltip accessible
        cell.title = `Corrélation: ${safeRound(r)}\n${v1} ↔ ${v2}\nCliquez pour ouvrir le scatter.`;

        // click -> ouvrir gases.html?x=...&y=...
        cell.addEventListener('click', ()=> {
          const url = `gases.html?x=${encodeURIComponent(v1)}&y=${encodeURIComponent(v2)}`;
          window.location.href = url;
        });

        container.appendChild(cell);
      }
    }
  }

  // fetch corr depuis serveur (via /corr)
  async function fetchCorrForVars(vars, sec){
    try {
      const qvars = vars.join(',');
      const url = `${API_BASE}/corr?vars=${encodeURIComponent(qvars)}&sec=${encodeURIComponent(sec)}`;
      const res = await fetch(url);
      if(!res.ok){
        console.error("Erreur HTTP /corr", res.status);
        return null;
      }
      const json = await res.json();
      // json expected: { vars: [...], sec: N, corr: { "a-b": 0.123, ... } }
      if(!json || !json.corr) {
        console.error("Réponse /corr invalide", json);
        return null;
      }
      return json;
    } catch(e) {
      console.error("fetchCorr erreur", e);
      return null;
    }
  }

  // lecture des variables sélectionnées dans le <select>
  function readSelectedVars(){
    const sel = document.getElementById('var-selector');
    if(!sel) return DEFAULT_VARS.slice();
    const selected = [...sel.selectedOptions].map(o => o.value);
    return selected.length ? selected : DEFAULT_VARS.slice();
  }

  // handler principal
  async function loadAndBuild(){
    const vars = readSelectedVars();
    const sec = DEFAULT_SEC;
    const json = await fetchCorrForVars(vars, sec);
    if(!json) {
      // si /corr KO, essayer de construire correlation heuristique depuis /history
      console.warn("/corr failed, fallback to history-based computation");
      await fallbackFromHistory(vars, sec);
      return;
    }
    // serveur renvoie vars (ordre) et corr object
    const serverVars = json.vars && json.vars.length ? json.vars : vars;
    buildMatrix(serverVars, json.corr);
  }

  // fallback: calculer corr localement à partir de /history
  async function fallbackFromHistory(vars, sec){
    try {
      const histUrl = `${API_BASE}/history?sec=${sec}`;
      const r = await fetch(histUrl);
      if(!r.ok) { console.error("history fetch failed", r.status); return; }
      const j = await r.json();
      const series = j.series || [];
      // build arrays
      const dataMap = {};
      vars.forEach(v => dataMap[v] = series.map(s => (s.measures && (v in s.measures)) ? s.measures[v] : null).filter(x=>x!=null));

      // compute pairwise pearson
      const corr = {};
      for(let i=0;i<vars.length;i++){
        for(let j=0;j<vars.length;j++){
          const a = dataMap[vars[i]];
          const b = dataMap[vars[j]];
          let rVal = 0;
          if(a.length>=2 && a.length === b.length){
            const n = a.length;
            const ma = a.reduce((s,x)=>s+x,0)/n;
            const mb = b.reduce((s,x)=>s+x,0)/n;
            let num=0, denA=0, denB=0;
            for(let k=0;k<n;k++){
              const da = a[k]-ma, db = b[k]-mb;
              num += da*db; denA += da*da; denB += db*db;
            }
            const den = Math.sqrt(denA*denB);
            rVal = den ? num/den : 0;
          }
          corr[`${vars[i]}-${vars[j]}`] = parseFloat((rVal||0).toFixed(3));
        }
      }
      buildMatrix(vars, corr);
    } catch(e) {
      console.error("fallbackFromHistory error", e);
    }
  }

  // boutons and init
  window.addEventListener('load', function(){
    const apply = document.getElementById('apply-vars');
    const reset = document.getElementById('reset-vars');

    apply && apply.addEventListener('click', loadAndBuild);
    reset && reset.addEventListener('click', function(){
      // reset to default set (select all)
      const sel = document.getElementById('var-selector');
      if(sel){
        for(let i=0;i<sel.options.length;i++) sel.options[i].selected = true;
      }
      loadAndBuild();
    });

    // initial load
    loadAndBuild();
  });

})();

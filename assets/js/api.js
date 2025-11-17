/* assets/js/api.js */
const API_BASE = "https://indoor-sim-server.onrender.com";

function checkOk(res){
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res;
}

async function fetchLatest(){
  const r = await fetch(`${API_BASE}/data`);
  checkOk(r);
  return await r.json();
}

async function fetchHistory(sec=3600){
  const r = await fetch(`${API_BASE}/history?sec=${sec}`);
  checkOk(r);
  return await r.json(); // { requested_sec, length, series: [...] }
}

async function fetchCorr(vars="co2,no2,nh3,co", sec=1800){
  const r = await fetch(`${API_BASE}/corr?vars=${vars}&sec=${sec}`);
  checkOk(r);
  return await r.json();
}

/* exposer global pour scripts non-modules */
window.IndoorAPI = {
  fetchLatest,
  fetchHistory,
  fetchCorr,
  API_BASE
};

// assets/js/api.js
export const API_BASE = "https://indoor-sim-server.onrender.com";

export async function fetchData() {
  try {
    const r = await fetch(`${API_BASE}/data`);
    return await r.json();
  } catch (e) {
    console.error("fetchData err", e);
    return null;
  }
}

export async function fetchHistory(sec = 3600) {
  try {
    const r = await fetch(`${API_BASE}/history?sec=${sec}`);
    return await r.json();
  } catch (e) {
    console.error("fetchHistory err", e);
    return null;
  }
}

export async function fetchCorr(vars = "co2,no2,nh3,co", sec = 1800) {
  try {
    const r = await fetch(`${API_BASE}/corr?vars=${vars}&sec=${sec}`);
    return await r.json();
  } catch (e) {
    console.error("fetchCorr err", e);
    return null;
  }
}

export async function fetchScatterBar(x="temp", y="rh", sec=3600, step=60) {
  try {
    const r = await fetch(`${API_BASE}/scatterbar?x=${x}&y=${y}&sec=${sec}&step=${step}`);
    return await r.json();
  } catch (e) {
    console.error("fetchScatterBar err", e);
    return null;
  }
}

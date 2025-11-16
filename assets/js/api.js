// assets/js/api.js

const API_URL = "https://indoor-sim-server.onrender.com/data";

export async function fetchLiveData() {
    try {
        const res = await fetch(API_URL);
        return await res.json();
    } catch (err) {
        console.error("Erreur API:", err);
        return null;
    }
}


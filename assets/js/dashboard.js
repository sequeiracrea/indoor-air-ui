import { fetchLiveData } from './api.js';

function updateDashboard(data) {
    document.getElementById("gaqi-value").textContent = data.GAQI.toFixed(1);
    document.getElementById("co2").textContent = data.CO2 + " ppm";
    document.getElementById("co").textContent = data.CO + " ppm";
    document.getElementById("no2").textContent = data.NO2 + " ppm";
    document.getElementById("nh3").textContent = data.NH3 + " ppm";

    document.getElementById("temp").textContent = data.temperature + " °C";
    document.getElementById("humidity").textContent = data.humidity + " %";
    document.getElementById("pressure").textContent = data.pressure + " hPa";
}

async function loop() {
    const data = await fetchLiveData();
    if (data) updateDashboard(data);
    setTimeout(loop, 1000);
}

loop();


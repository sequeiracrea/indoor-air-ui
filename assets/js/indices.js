import { fetchLiveData } from './api.js';

function setGauge(id, value, max=500) {
    const el = document.getElementById(id);
    el.innerHTML = `
        <div class="gauge-value">${value.toFixed(1)}</div>
        <div class="gauge-bar">
            <div class="gauge-fill" style="width:${(value/max)*100}%"></div>
        </div>
    `;
}

async function loop() {
    const data = await fetchLiveData();
    if (data) {
        setGauge("gauge-gaqi", data.GAQI);

        setGauge("gauge-co2", data.CO2, 2000);
        setGauge("gauge-co", data.CO);
        setGauge("gauge-no2", data.NO2);
        setGauge("gauge-nh3", data.NH3);
    }
    setTimeout(loop, 1000);
}

loop();

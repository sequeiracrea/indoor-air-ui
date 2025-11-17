/* assets/js/comfort.js */
(function(){
  const { fetchLatest } = window.IndoorAPI;
  let radar;
  function build(){
    const ctx = document.getElementById('radarChart').getContext('2d');
    radar = new Chart(ctx, {
      type:'radar',
      data:{ labels:['Temp','Hum','Press'], datasets:[{ label:'Confort', data:[0,0,0], backgroundColor:'rgba(152,215,167,0.4)', borderColor:'#98D7A7' }]},
      options:{ scales:{ r:{ min:0, max:100 } }, animation:false }
    });
  }

  function adviceFromValues(temp,hum,press){
    if(temp>25 && hum>60) return "Air chaud et humide — ventiler et déshumidifier si possible.";
    if(temp<19 && hum<40) return "Air froid et sec — augmenter le chauffage/humidifier.";
    if(hum>60) return "Humidité élevée — risque de lourdeur, contrôler ventilation.";
    return "Confort dans la zone normale.";
  }

  async function loop(){
    try{
      const payload = await fetchLatest();
      const m = payload.measures || payload;
      const vTemp = Math.max(0,100 - Math.abs(m.temp - 22)*5);
      const vHum = Math.max(0,100 - Math.abs(m.rh - 50)*1.5);
      const vPress = Math.max(0,100 - Math.abs(m.pres - 1013)*0.5);
      radar.data.datasets[0].data = [vTemp, vHum, vPress];
      radar.update('none');
      document.getElementById('comfortAdvice').textContent = adviceFromValues(m.temp, m.rh, m.pres);
    }catch(e){ console.error(e); }
    setTimeout(loop,1000);
  }

  window.addEventListener('load', ()=>{
    build();
    loop();
  });
})();

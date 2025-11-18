<!-- -------------------------------------------------------
     SECTION SCATTER + HISTOGRAMMES
--------------------------------------------------------- -->
<div id="scatterContainer" style="display:flex; flex-direction:column; gap:1rem;">

  <!-- Titre du scatter -->
  <h2 id="scatterTitle">Scatter : sélectionnez vos variables</h2>

  <!-- Sélecteurs X/Y -->
  <div id="scatterSelectors" style="display:flex; gap:1rem; margin-bottom:0.5rem;">
    <label>
      X :
      <select id="select-x">
        <option value="co">CO</option>
        <option value="co2">CO₂</option>
        <option value="no2">NO₂</option>
        <option value="nh3">NH₃</option>
        <option value="temp">Température</option>
        <option value="rh">Humidité</option>
        <option value="pres">Pression</option>
      </select>
    </label>
    <label>
      Y :
      <select id="select-y">
        <option value="co">CO</option>
        <option value="co2">CO₂</option>
        <option value="no2">NO₂</option>
        <option value="nh3">NH₃</option>
        <option value="temp">Température</option>
        <option value="rh">Humidité</option>
        <option value="pres">Pression</option>
      </select>
    </label>
  </div>

  <!-- Boutons des cas d’usage -->
  <div id="scatterUseCases" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.5rem;">
    <!-- Les boutons sont générés dynamiquement par gases.js -->
  </div>

  <!-- Description du cas d’usage sélectionné -->
  <div id="scatterUseCaseDescription" style="font-style:italic; margin-bottom:0.5rem;">
    <!-- Mise à jour possible via JS si tu veux montrer la description dynamique -->
  </div>

  <!-- Canvas scatter -->
  <canvas id="gasesScatter" style="width:100%; height:400px;"></canvas>

  <!-- Détails statistiques -->
  <div id="scatterDetails" style="margin-top:0.5rem; font-size:0.9rem; color:#333;"></div>

  <!-- Histogrammes X/Y -->
  <div style="display:flex; gap:1rem; margin-top:1rem;">
    <div style="flex:1;">
      <h4>Histogramme X</h4>
      <canvas id="histX" style="width:100%; height:150px;"></canvas>
    </div>
    <div style="flex:1;">
      <h4>Histogramme Y</h4>
      <canvas id="histY" style="width:100%; height:150px;"></canvas>
    </div>
  </div>

</div>

<!-- Optionnel : CSS pour les boutons de cas d’usage -->
<style>
  .btn-usecase {
    background-color:#f0f0f0;
    border:1px solid #ccc;
    padding:0.3rem 0.6rem;
    cursor:pointer;
    border-radius:4px;
    font-size:0.85rem;
    transition:0.2s;
  }
  .btn-usecase:hover {
    background-color:#ddd;
  }
</style>

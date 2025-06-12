<template>
  <div id="mapWrapper">
    <div id="mapContainer"></div>
    <div id="northArrow"></div>

    <MenuSidebar
      @service-added="showServiceAddedPopup"
      @open-visualization-sidebar="openVisualizationSidebar"
    />

    <SearchPanel @zoom-to-coordinates="handleZoomToCoordinates" />

    <div v-if="showPopup" class="service-added-popup-overlay">
      <div class="service-added-popup">
        <h5 class="popup-title">Successfully added Service</h5>
        <div class="popup-content">
          <p><strong>Layer:</strong> {{ serviceParameters.layerName }}</p>
          <p><strong>SRS:</strong> {{ serviceParameters.srs }}</p>
          <p><strong>Extent:</strong> {{ serviceParameters.extent }}</p>
        </div>
        <button @click="hideServiceAddedPopup" class="btn btn-primary close-popup-btn">OK</button>
      </div>
    </div>

    <VisualizationSidebar
      v-if="showVisualizationSidebar"
      @close-sub-menu="closeVisualizationSidebar"
      @update-visualization-mode="handleVisualizationModeChange"
    />
  </div>
</template>

<script>
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import MenuSidebar from './MenuSidebar.vue';
import SearchPanel from './SearchPanel.vue';
import VisualizationSidebar from './sub-sidebars/VisualizationSidebar.vue';
import CesiumMapManager from './utils/CesiumMapManager';
import PopupManager from './utils/PopupManager';

Cesium.Ion.defaultAccessToken = 'your-token';

export default {
  name: 'EarthViewer',
  components: { MenuSidebar, SearchPanel, VisualizationSidebar },

  data() {
    return {
      mapManager: null,
      popupManager: new PopupManager(),
      showVisualizationSidebar: false
    };
  },

  mounted() {
    this.mapManager = new CesiumMapManager('mapContainer', 'https://vedas.sac.gov.in/elevation/cdem_10m_2016/');
    this.mapManager.init();
  },

  methods: {
    handleZoomToCoordinates(coordinates) {
      this.mapManager.flyToCoordinates(coordinates);
    },
    showServiceAddedPopup(params) {
      this.popupManager.show(params);
    },
    hideServiceAddedPopup() {
      this.popupManager.hide();
    },
    openVisualizationSidebar() {
      this.showVisualizationSidebar = true;
    },
    closeVisualizationSidebar() {
      this.showVisualizationSidebar = false;
    },
    handleVisualizationModeChange(mode) {
      this.mapManager.setSceneMode(mode);
    }
  },

  computed: {
    serviceParameters() {
      return this.popupManager.getParams();
    },
    showPopup() {
      return this.popupManager.isVisible();
    }
  }
};
</script>

<style scoped>
#mapWrapper {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
}
#mapContainer {
  width: 100%;
  height: 100%;
}
#northArrow {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  background-image: url('');
  background-size: cover;
  z-index: 10;
}
html, body {
  margin: 0;
  padding: 0;
}
.service-added-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.service-added-popup {
  background-color: #333;
  color: white;
  padding: 30px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  max-width: 400px;
  width: 90%;
  position: relative;
}
.popup-title {
  font-size: 1.5em;
  margin-bottom: 20px;
  color: #007bff;
}
.popup-content p {
  margin-bottom: 10px;
  font-size: 1.1em;
}
.popup-content strong {
  color: rgba(255, 255, 255, 0.9);
}
.close-popup-btn {
  margin-top: 20px;
  padding: 10px 30px;
  font-size: 1em;
  background-color: #007bff;
  border-color: #007bff;
  color: white;
  border-radius: 5px;
  cursor: pointer;
}
.close-popup-btn:hover {
  background-color: #0056b3;
  border-color: #004085;
}
</style>

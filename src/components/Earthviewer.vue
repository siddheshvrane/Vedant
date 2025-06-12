]<template>
  <div id="mapWrapper">
    <div id="mapContainer"></div>

    <div id="northArrow" @click="resetCameraNorth">
      <img :src="compassSrc" alt="North Arrow" class="north-arrow-img" />
    </div>

    <div id="vedantLogo">
      <img :src="vedantLogoSrc" alt="Vedant Logo" class="vedant-logo-img" />
      <div class="copyright-text">Copyright © 2024 - VEDAS, SAC, ISRO.</div>
    </div>

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

// IMPORT THE COMPASS IMAGE HERE
import compassImage from '../assets/compass.png'; // Correct relative path from Earthviewer.vue to src/assets

// IMPORT THE NEW VEDANT LOGO HERE
import vedantLogo from '../assets/vedant_Logo_white.png'; // Correct relative path to src/assets

// Make sure to replace 'your-token' with your actual Cesium Ion Access Token
Cesium.Ion.defaultAccessToken = 'your-token';

export default {
  name: 'EarthViewer',
  components: { MenuSidebar, SearchPanel, VisualizationSidebar },

  data() {
    return {
      mapManager: null,
      popupManager: new PopupManager(),
      showVisualizationSidebar: false,
      compassSrc: compassImage, // Make the imported compass image path available
      vedantLogoSrc: vedantLogo, // Make the imported vedant logo path available
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
    },
    /**
     * @method resetCameraNorth
     * @description Reorients the Cesium globe camera to point North (heading 0),
     * while maintaining the current approximate location and altitude.
     * @returns {void}
     */
    resetCameraNorth() {
      const viewer = this.mapManager.getViewer();
      if (!viewer) {
        console.warn("Cesium viewer not initialized. Cannot reset camera.");
        return;
      }

      // Get current camera position
      const currentCameraPosition = viewer.camera.positionCartographic;
      const longitude = Cesium.Math.toDegrees(currentCameraPosition.longitude);
      const latitude = Cesium.Math.toDegrees(currentCameraPosition.latitude);
      const height = currentCameraPosition.height;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),      // North
          pitch: Cesium.Math.toRadians(-45.0),      // A common angled view
          roll: Cesium.Math.toRadians(0.0)          // No roll
        },
        duration: 1.5 // Smooth animation duration in seconds
      });
      console.log('Camera reoriented to North.');
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

/* North Arrow Styles */
#northArrow {
  position: absolute;
  top: 80px; /* Shifted down to make space for search panel */
  right: 20px;
  width: 80px; /* Made bigger */
  height: 80px; /* Made bigger */
  z-index: 1000; /* Ensure it's on top */
  cursor: pointer; /* Add pointer cursor to indicate it's clickable */
  transition: transform 0.1s linear; /* Keep existing rotation transition */
}
#northArrow .north-arrow-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}

/* Vedant Logo and Copyright Styles - UPDATED for closer spacing */
#vedantLogo {
  position: absolute;
  bottom: 10px; /* Moved closer to the bottom edge */
  right: 20px; /* Aligned to the RIGHT */
  width: 160px; /* 2 times bigger than North Arrow (80px * 2) */
  z-index: 1000; /* Ensure it's on top of the map */

  /* Flexbox for stacking logo and text */
  display: flex;
  flex-direction: column; /* Stack children vertically */
  align-items: flex-end; /* Align items to the right */
}
#vedantLogo .vedant-logo-img {
  width: 100%;
  height: 100px; /* Keep fixed height for the image itself */
  display: block;
  object-fit: contain; /* Ensures the entire logo is visible within its bounds */
  margin-bottom: 0; /* REMOVED/REDUCED GAP HERE */
}
.copyright-text {
  color: rgba(255, 255, 255, 0.7); /* Slightly transparent white */
  font-size: 0.8em; /* Smaller font size */
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.5); /* Slight shadow for readability on map */
  white-space: nowrap; /* Keep text on one line */
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
<template>
  <div id="mapWrapper">
    <div v-if="loading" class="loading-screen">
      <img :src="vedantLogoSrc" alt="Vedant Logo" class="vedant-logo-img-loading fade-in" />
      <img :src="spaceImageSrc" alt="Space Background" class="space-image" />
    </div>

    <div v-else id="mapContainer"></div>

    <div id="northArrow" @click="resetCameraNorth" v-show="!loading">
      <img :src="compassSrc" alt="North Arrow" class="north-arrow-img" />
    </div>

    <div
      id="vedantLogo"
      v-show="!loading"
      :class="{ 'vedant-logo-container-final-pos': globeLogoFinalPosition }"
    >
      <img :src="vedantLogoSrc" alt="Vedant Logo" class="vedant-logo-img-globe" />
      <div class="copyright-text" :class="{ 'copyright-text-final': globeLogoFinalPosition }">
        Copyright © 2024 - VEDAS, SAC, ISRO.
      </div>
    </div>

    <MenuSidebar
      @service-added="showServiceAddedPopup"
      @open-visualization-sidebar="openVisualizationSidebar"
      v-show="!loading"
    />

    <SearchPanel @zoom-to-coordinates="handleZoomToCoordinates" v-show="!loading" />

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

import compassImage from '../assets/compass.png';
import vedantLogo from '../assets/vedant_Logo_white.png';
import spaceImage from '../assets/space.jpg';

// Remember to replace 'your-token' with your actual Cesium Ion Access Token
Cesium.Ion.defaultAccessToken = 'your-token';

export default {
  name: 'EarthViewer',
  components: { MenuSidebar, SearchPanel, VisualizationSidebar },

  data() {
    return {
      mapManager: null,
      popupManager: new PopupManager(),
      showVisualizationSidebar: false,
      compassSrc: compassImage,
      vedantLogoSrc: vedantLogo,
      spaceImageSrc: spaceImage,
      loading: true,
      globeLogoFinalPosition: false
    };
  },

  mounted() {
    setTimeout(() => {
      this.loading = false;
      this.$nextTick(() => {
        try {
          this.mapManager = new CesiumMapManager('mapContainer', 'https://vedas.sac.gov.in/elevation/cdem_10m_2016/');
          this.mapManager.init();

          setTimeout(() => {
            this.globeLogoFinalPosition = true;
          }, 100);
        } catch (error) {
          console.error('Error initializing CesiumMapManager:', error);
        }
      });
    }, 3000);
  },

  methods: {
    handleZoomToCoordinates(coordinates) {
      if (this.mapManager) {
        this.mapManager.flyToCoordinates(coordinates);
      }
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
      if (this.mapManager) {
        this.mapManager.setSceneMode(mode);
      }
    },
    resetCameraNorth() {
      const viewer = this.mapManager ? this.mapManager.getViewer() : null;
      if (!viewer) return;

      const currentCameraPosition = viewer.camera.positionCartographic;
      const longitude = Cesium.Math.toDegrees(currentCameraPosition.longitude);
      const latitude = Cesium.Math.toDegrees(currentCameraPosition.latitude);
      const height = currentCameraPosition.height;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-45.0),
          roll: Cesium.Math.toRadians(0.0)
        },
        duration: 1.5
      });
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

.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  overflow: hidden;
}

.vedant-logo-img-loading {
  width: 400px;
  height: auto;
  object-fit: contain;
  margin-bottom: 20px;
  opacity: 0;
  animation: fadeIn 2s forwards;
  animation-delay: 0.5s;
}

.space-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1;
  opacity: 0.7;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

#vedantLogo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  width: 400px;
  height: auto;
  opacity: 1;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  transition: all 1.2s ease-out; /* Smooth, non-bouncing transition */
}

#vedantLogo.vedant-logo-container-final-pos {
  top: 100%;
  left: 100%;
  transform: translate(calc(-100% - 5px), calc(-100% - 5px)) scale(0.7); /* Adjusted scale for 280px final width (280/400 = 0.7) */
  width: 280px; /* Adjusted target final width for the logo */
}

.vedant-logo-img-globe {
  width: 100%;
  height: auto;
  object-fit: contain;
  margin-bottom: 0;
}

.copyright-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1em; /* Increased font size */
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.8s ease-out 0.4s;
}

.copyright-text.copyright-text-final {
  opacity: 1;
}

#northArrow {
  position: absolute;
  top: 80px;
  right: 20px;
  width: 80px;
  height: 80px;
  z-index: 1000;
  cursor: pointer;
  transition: transform 0.1s linear;
}
#northArrow .north-arrow-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
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
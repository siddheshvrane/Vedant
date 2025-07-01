<template>
  <div class="scene-info-container poppins-font" v-show="isVisible">
    <h5 class="info-title">Scene Information</h5>
    <div class="info-item">
      <span class="info-label">Latitude:</span>
      <span class="info-value">{{ formattedLatitude }}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Longitude:</span>
      <span class="info-value">{{ formattedLongitude }}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Elevation:</span>
      <span class="info-value">{{ formattedElevation }}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Terrain:</span>
      <span class="info-value">{{ terrainType }}</span>
    </div>
    <div class="info-item">
      <span class="info-label">Imagery:</span>
      <span class="info-value">{{ satelliteImageryType }}</span>
    </div>
  </div>
</template>

<script>
import { MapService } from '../services.js';

export default {
  name: 'SceneInfo',
  props: {
    isVisible: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      latitude: 0.0,
      longitude: 0.0,
      elevation: 0.0,
      terrainType: 'N/A',
      satelliteImageryType: 'N/A',
      mapViewSubscription: null,
    };
  },
  computed: {
    formattedLatitude() {
      return this.latitude.toFixed(4) + '°';
    },
    formattedLongitude() {
      return this.longitude.toFixed(4) + '°';
    },
    formattedElevation() {
      return (this.elevation / 1000).toFixed(2) + ' km';
    },
  },
  mounted() {
    this.mapViewSubscription = MapService.updateView$.subscribe(this.updateSceneInfoHandler);
  },
  beforeUnmount() {
    if (this.mapViewSubscription) {
      this.mapViewSubscription.unsubscribe();
    }
  },
  methods: {
    /**
     * @method updateSceneInfoHandler
     * @description Updates the component's data with new scene information from MapService.
     * @param {Object} sceneData - Object containing currentCoordinates, terrainType, satelliteImageryType.
     * @returns {void}
     */
    updateSceneInfoHandler(sceneData) {
      if (sceneData && sceneData.currentCoordinates) {
        this.latitude = sceneData.currentCoordinates.latitude;
        this.longitude = sceneData.currentCoordinates.longitude;
        this.elevation = sceneData.currentCoordinates.elevation;
      }
      if (sceneData && sceneData.terrainType) {
        this.terrainType = sceneData.terrainType;
      }
      if (sceneData && sceneData.satelliteImageryType) {
        this.satelliteImageryType = sceneData.satelliteImageryType;
      }
    },
  },
};
</script>

<style scoped>
.scene-info-container {
  position: fixed;
  bottom: 20px;
  left: 20px;
  background-color: rgba(30, 30, 30, 0.7);
  color: white;
  padding: 15px 20px; /* REVERTED: Original padding */
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  z-index: 1001;
  font-family: 'Poppins', sans-serif;
  width: 250px; /* REVERTED: Original width for a more square appearance */
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.info-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px; /* REVERTED: Original margin */
  color: #007bff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px; /* REVERTED: Original padding */
}

.info-item { /* REVERTED: Style for each item on its own line */
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px; /* REVERTED: Original margin */
  font-size: 0.95em; /* REVERTED: Original font size */
}

/* Removed .info-row, .info-item-half, .info-item-third styles */

.info-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.info-value {
  color: rgba(255, 255, 255, 0.95);
  text-align: right;
  /* white-space: nowrap; Removed as values now have more space */
}
</style>
<template>
  <div class="scene-info-container poppins-font" :class="{ 'shifted-right': isSidebarOpen }" v-show="isVisible">
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
// Corrected import path for MapService and UserInterfaceService from controller.js
import { MapService, UserInterfaceService } from '../../services/controller.js';

export default {
  name: 'SceneInfo',
  props: {
    isVisible: {
      type: Boolean,
      default: true
    },
    // NEW PROP: to know when the sidebar is open
    isSidebarOpen: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      latitude: 0.0,
      longitude: 0.0,
      elevation: 0.0,
      terrainType: 'N/A',
      satelliteImageryType: 'N/A',
      mapViewSubscription: null, // Holds the RxJS subscription
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
      // Assuming elevation is in meters, converting to kilometers
      return (this.elevation / 1000).toFixed(2) + ' km';
    },
  },
  mounted() {
    // Subscribe to MapService to get continuous map view updates
    this.mapViewSubscription = MapService.updateView$.subscribe(this.updateSceneInfoHandler);
  },
  beforeUnmount() {
    // Unsubscribe to prevent memory leaks when the component is destroyed
    if (this.mapViewSubscription) {
      this.mapViewSubscription.unsubscribe();
    }
  },
  methods: {
    /**
     * @method updateSceneInfoHandler
     * @description Updates the component's data with new scene information from MapService.
     * @param {Object} sceneData - Object containing currentCoordinates ({latitude, longitude, elevation}), terrainType, satelliteImageryType.
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
/* Scoped styles ensure these CSS rules only apply to this component. */
.scene-info-container {
  position: fixed; /* Positions the component relative to the viewport */
  bottom: 20px;    /* Distance from the bottom of the viewport */
  left: 20px;      /* Distance from the left of the viewport */
  background-color: rgba(30, 30, 30, 0.7); /* Semi-transparent dark background */
  color: white;    /* White text color */
  padding: 15px 20px; /* Padding inside the container */
  border-radius: 10px; /* Rounded corners */
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Subtle shadow for depth */
  z-index: 1001;   /* Ensures it's above the Cesium globe and other elements */
  font-family: 'Poppins', sans-serif; /* Consistent font */
  width: 250px;    /* Fixed width */
  backdrop-filter: blur(5px); /* Blurs content behind the element */
  -webkit-backdrop-filter: blur(5px); /* Safari support for backdrop-filter */
  /* Add transition for smooth movement */
  transition: transform 0.3s ease-out; /* Match sidebar's transition duration */
}

/* New style for when the sidebar is open */
.scene-info-container.shifted-right {
  transform: translateX(300px); /* Adjust this value as needed */
}

.info-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff; /* Blue title color */
  border-bottom: 1px solid rgba(255, 255, 255, 0.2); /* Light separator line */
  padding-bottom: 8px;
}

.info-item {
  display: flex; /* Uses flexbox for label and value alignment */
  justify-content: space-between; /* Pushes label to left, value to right */
  margin-bottom: 5px;
  font-size: 0.95em;
}

.info-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8); /* Slightly transparent white for labels */
}

.info-value {
  color: rgba(255, 255, 255, 0.95); /* Nearly opaque white for values */
  text-align: right;
}
</style>
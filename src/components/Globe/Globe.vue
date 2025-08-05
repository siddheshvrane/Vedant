<template>
  <div id="mapWrapper">
    <div id="globeContainer"></div>
  </div>
</template>

<script>
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Ensure this token is for your production environment if it's sensitive
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjNmUzZWU3Ni1kYzM3LTQyNzYtOTk0MS03YWVkMTZlNTU0MDMiLCJpZCI6MzEwMzcwLCJpYXQiOjE3NDk0NjMxNzl9.K7YHyi1fwwi5ICQKn4C82gUnv60u9nVs783T_UpHxG0';

// Adjust import paths relative to your file structure
import { MapService } from '../../services/MapService.js'; // Pure communication service
import CesiumGlobeManager from './CesiumGlobeManager.js';
import { Subscription } from 'rxjs'; // Import Subscription for managing multiple subscriptions

export default {
  name: 'Globe',
  data() {
    return {
      globeManager: null,
      subscriptions: new Subscription(), // Single Subscription to manage all
    };
  },
  mounted() {
    console.log('Globe.vue: Mounted, initializing CesiumGlobeManager...');
    this.globeManager = new CesiumGlobeManager('globeContainer');

    // Subscribe to MapService communication events
    // Note: MapService now only handles communication, all logic is in managers
    this.setupMapServiceSubscriptions();

    // Initialize globe immediately or wait for trigger
    this.initializeGlobe();
  },
  beforeUnmount() {
    console.log('Globe.vue: Unmounting, destroying CesiumGlobeManager and subscriptions...');
    // Unsubscribe all RxJS subscriptions
    this.subscriptions.unsubscribe();

    if (this.globeManager) {
      this.globeManager.removeCameraChangeListener(this.onCameraChanged);
      this.globeManager.destroy(); // Clean up Cesium viewer
    }
    // Inform MapService that the viewer is no longer available
    MapService.setGlobeViewer(null);
    MapService.notifyGlobeInitialized(false);
  },
  methods: {
    /**
     * Sets up subscriptions to MapService communication events.
     * Since MapService is now pure communication, we mainly listen for globe initialization.
     */
    setupMapServiceSubscriptions() {
      // Globe initialization trigger
      this.subscriptions.add(
        MapService.initGlobe$.subscribe(() => {
          this.initializeGlobe();
        })
      );

      // Note: Individual action subscriptions are now handled directly in CesiumGlobeManager
      // This keeps the Vue component focused on UI concerns while managers handle business logic
    },

    /**
     * Initializes the globe and sets up camera monitoring.
     */
    initializeGlobe() {
      this.$nextTick(() => {
        try {
          const viewer = this.globeManager.init();
          this.globeManager.addCameraChangeListener(this.onCameraChanged);
          this.onCameraChanged(); // Initial camera update

          // Notify MapService that globe is ready (pure communication)
          MapService.notifyGlobeInitialized(true);
          MapService.setGlobeViewer(viewer); // This makes the viewer available to other services
          
          console.log('Globe.vue: Globe initialization completed successfully');
        } catch (error) {
          console.error('Globe.vue: Globe initialization error:', error);
          MapService.notifyGlobeInitialized(false);
          MapService.setGlobeViewer(null);
        }
      });
    },

    /**
     * Handles camera change events and updates MapService with scene information.
     */
    onCameraChanged() {
      if (this.globeManager) {
        // Get scene information from CesiumCoreManager and communicate via MapService
        MapService.updateView(this.globeManager.getSceneInformation());
      }
    },

    // --- Direct control methods for UI interactions ---
    // These methods provide direct access for UI components that need immediate response
    
    zoomIn() {
        if (this.globeManager) this.globeManager.zoomIn();
    },
    
    zoomOut() {
        if (this.globeManager) this.globeManager.zoomOut();
    },
    
    /**
     * Direct method for rendering graphics (bypasses MapService for immediate response).
     * @param {object} graphic - Graphic object to render.
     */
    renderGraphic(graphic) {
        if (this.globeManager) this.globeManager.renderGraphic(graphic);
    },
    
    /**
     * Direct method for removing graphics (bypasses MapService for immediate response).
     * @param {string} graphicIdentifier - Identifier of graphic to remove.
     */
    removeGraphic(graphicIdentifier) {
        if (this.globeManager) this.globeManager.removeGraphic(graphicIdentifier);
    },
    
    /**
     * Direct method for zooming to coordinates (bypasses MapService for immediate response).
     * @param {object} coordinates - Coordinates to zoom to.
     */
    zoomToCoordinates(coordinates) {
        if (this.globeManager) this.globeManager.zoomToCoordinates(coordinates);
    },
    
    /**
     * Direct method for displaying location marker (bypasses MapService for immediate response).
     * @param {object} location - Location to display marker.
     */
    displayLocationMarker(location) {
        if (this.globeManager) this.globeManager.displayLocationMarker(location);
    },
    
    /**
     * Direct method for orienting to north (bypasses MapService for immediate response).
     */
    orientToNorth() {
        if (this.globeManager) this.globeManager.orientToNorth();
    },
    
    /**
     * Direct method for updating globe view mode (bypasses MapService for immediate response).
     * @param {string} mode - Visualization mode ('2D', '3D').
     */
    updateGlobeViewMode(mode) {
        if (this.globeManager) {
            // All visualization logic is now in CesiumCoreManager
            this.globeManager.setGlobeVisualizationMode(mode);
        }
    },

    // --- Layer management methods ---
    // These can be called directly or triggered via MapService communication
    
    /**
     * Adds a layer to the globe.
     * @param {object} layerEntry - Layer entry object.
     */
    addLayerToGlobe(layerEntry) {
        if (this.globeManager) {
            this.globeManager.addCesiumLayer(layerEntry);
        }
    },
    
    /**
     * Removes a layer from the globe.
     * @param {string} layerId - Layer ID to remove.
     */
    removeLayerFromGlobe(layerId) {
        if (this.globeManager) {
            this.globeManager.removeCesiumLayer(layerId);
        }
    },
    
    /**
     * Toggles layer visibility on the globe.
     * @param {string} layerId - Layer ID.
     * @param {boolean} isVisible - Visibility state.
     */
    toggleLayerVisibilityOnGlobe(layerId, isVisible) {
        if (this.globeManager) {
            this.globeManager.toggleCesiumLayerVisibility(layerId, isVisible);
        }
    },
    
    /**
     * Reconciles globe layers (full sync).
     * @param {Array<object>} layersToReconcile - Ordered array of layer entries.
     */
    reconcileGlobeLayers(layersToReconcile) {
      if (this.globeManager) {
        this.globeManager.reconcileGlobeLayers(layersToReconcile);
      }
    },
    
    /**
     * Zooms to a specific layer on the globe.
     * @param {object} layerEntry - Layer entry object.
     */
    zoomToLayerOnGlobe(layerEntry) {
      if (this.globeManager) {
        this.globeManager.zoomToLayer(layerEntry);
      }
    },

    // --- Advanced camera control methods ---
    
    /**
     * Sets camera view with specific options.
     * @param {object} viewOptions - Camera view options.
     */
    setCameraView(viewOptions) {
      if (this.globeManager) {
        return this.globeManager.setCameraView(viewOptions);
      }
    },
    
    /**
     * Gets current camera state.
     * @returns {object} Current camera state.
     */
    getCameraState() {
      if (this.globeManager) {
        return this.globeManager.getCameraState();
      }
      return null;
    },
    
    /**
     * Moves camera by movement vector.
     * @param {Cesium.Cartesian3} movement - Movement vector.
     */
    moveCamera(movement) {
      if (this.globeManager) {
        this.globeManager.moveCamera(movement);
      }
    },
    
    /**
     * Rotates camera in specified direction.
     * @param {string} direction - Direction ('left', 'right', 'up', 'down').
     * @param {number} angle - Angle in radians.
     */
    rotateCamera(direction, angle) {
      if (this.globeManager) {
        this.globeManager.rotateCamera(direction, angle);
      }
    },
    
    /**
     * Enables or disables default camera controls.
     * @param {boolean} enabled - Whether to enable controls.
     */
    setDefaultCameraControlsEnabled(enabled) {
      if (this.globeManager) {
        this.globeManager.setDefaultCameraControlsEnabled(enabled);
      }
    },
    
    /**
     * Cancels current camera flight.
     */
    cancelCameraFlight() {
      if (this.globeManager) {
        this.globeManager.cancelCameraFlight();
      }
    },

    // --- Flight animation methods ---
    
    /**
     * Creates a flight animation between points.
     * @param {Array<Cesium.Cartesian3>} pathPositions - Array of positions.
     * @param {object} config - Flight configuration.
     * @param {Function} onProgress - Progress callback.
     * @param {Function} onComplete - Completion callback.
     * @returns {string} Animation ID.
     */
    createFlightAnimation(pathPositions, config, onProgress, onComplete) {
      if (this.globeManager) {
        return this.globeManager.createFlightAnimation(pathPositions, config, onProgress, onComplete);
      }
      return null;
    },
    
    /**
     * Creates a marker-based flight animation.
     * @param {Array<object>} markers - Array of marker objects.
     * @param {object} config - Flight configuration.
     * @param {Function} onProgress - Progress callback.
     * @param {Function} onComplete - Completion callback.
     * @returns {string} Animation ID.
     */
    createMarkerFlightAnimation(markers, config, onProgress, onComplete) {
      if (this.globeManager) {
        return this.globeManager.createMarkerFlightAnimation(markers, config, onProgress, onComplete);
      }
      return null;
    },
    
    /**
     * Cancels a specific flight animation.
     * @param {string} animationId - Animation ID to cancel.
     */
    cancelFlightAnimation(animationId) {
      if (this.globeManager) {
        this.globeManager.cancelFlightAnimation(animationId);
      }
    },
    
    /**
     * Cancels all active flight animations.
     */
    cancelAllFlightAnimations() {
      if (this.globeManager) {
        this.globeManager.cancelAllFlightAnimations();
      }
    },
    
    /**
     * Gets active flight animations.
     * @returns {Array<string>} Array of active animation IDs.
     */
    getActiveFlightAnimations() {
      if (this.globeManager) {
        return this.globeManager.getActiveFlightAnimations();
      }
      return [];
    },

    // --- Time and visualization control ---
    
    /**
     * Sets globe clock time.
     * @param {object} time - Time object {hour, minute, ampm}.
     */
    setGlobeClockTime(time) {
      if (this.globeManager) {
        this.globeManager.setGlobeClockTime(time);
      }
    },
    
    /**
     * Gets current globe clock time.
     * @returns {object} Current time {hour, minute, ampm}.
     */
    getCurrentGlobeClockTime() {
      if (this.globeManager) {
        return this.globeManager.getCurrentGlobeClockTime();
      }
      return null;
    },
    
    /**
     * Gets current visualization mode.
     * @returns {string} Current visualization mode.
     */
    getCurrentVisualizationMode() {
      if (this.globeManager) {
        return this.globeManager.getCurrentVisualizationMode();
      }
      return '3D';
    },

    // --- Terrain sampling ---
    
    /**
     * Samples terrain heights for given positions.
     * @param {Array<Cesium.Cartesian3>} positions - Positions to sample.
     * @param {number} heightOffset - Height offset above terrain.
     * @returns {Promise<Array<Cesium.Cartesian3>>} Terrain-adjusted positions.
     */
    async sampleTerrainHeights(positions, heightOffset) {
      if (this.globeManager) {
        return this.globeManager.sampleTerrainHeights(positions, heightOffset);
      }
      return positions || [];
    },

    // --- Scene information ---
    
    /**
     * Gets current scene information.
     * @returns {object} Scene information object.
     */
    getSceneInformation() {
      if (this.globeManager) {
        return this.globeManager.getSceneInformation();
      }
      return {};
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
#globeContainer {
  width: 100%;
  height: 100%;
}
</style>
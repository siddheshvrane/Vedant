<template>
  <div id="mapWrapper">
    <div id="globeContainer"></div>
  </div>
</template>

<script>
// These imports are necessary for Cesium to be available within this module's scope.
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// Cesium Ion access token is required for using Cesium's default assets (e.g., imagery, terrain)..
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjNmUzZWU3Ni1kYzM3LTQyNzYtOTk0MS03YWVkMTZlNTU0MDMiLCJpZCI6MzEwMzcwLCJpYXQiOjE3NDk0NjMxNzl9.K7YHyi1fwwi5ICQKn4C82gUnv60u9nVs783T_UpHxG0'; // <<< IMPORTANT: Update this!

import { MapService } from '../../services/controller.js'; // Path changed: Go up two levels from components/Globe/ to src/, then down to services/
import CesiumGlobeManager from './CesiumGlobeManager.js'; // Path changed: Now in the same folder as Globe.vue

export default {
  name: 'Globe',
  data() {
    return {
      globeManager: null,

      compassRedirectSubscription: null,
      graphicRenderSubscription: null,
      graphicRemovalSubscription: null,
      zoomToCoordinatesSubscription: null,
      displayLocationMarkerSubscription: null,
      initGlobeSubscription: null,
    };
  },
  /**
   * @Lifecycle Hook: mounted
   * Subscribes to MapService observables and initializes CesiumGlobeManager.
   */
  mounted() {
    console.log('Globe.vue: mounted, creating CesiumGlobeManager instance.');
    this.globeManager = new CesiumGlobeManager('globeContainer');

    // Subscribe to MapService for various commands
    this.compassRedirectSubscription = MapService.orientToNorth$.subscribe(this.orientToNorth);
    this.graphicRenderSubscription = MapService.renderGraphic$.subscribe(this.renderGraphic);
    this.graphicRemovalSubscription = MapService.removeGraphic$.subscribe(this.removeGraphic);
    this.zoomToCoordinatesSubscription = MapService.zoomToCoordinates$.subscribe(this.zoomToCoordinates);
    this.displayLocationMarkerSubscription = MapService.displayLocationMarker$.subscribe(this.displayLocationMarker);

    // Subscribe to the initGlobe$ observable from MapService
    this.initGlobeSubscription = MapService.initGlobe$.subscribe(() => {
      console.log('Globe.vue: Received initGlobe command, attempting to initialize globeManager.');
      this.$nextTick(() => { // Ensure DOM element is ready
        try {
          const viewer = this.globeManager.init(); // Initialize Cesium Viewer via manager
          console.log('Globe.vue: globeManager.init() returned viewer:', viewer);

          this.globeManager.addCameraChangeListener(this.onCameraChanged); // Add camera listener
          this.onCameraChanged(); // Trigger initial view update to MapService

          MapService.notifyGlobeInitialized(true); // Notify that globe is ready
          MapService.setGlobeViewer(viewer); // Pass the viewer instance to the service
        } catch (error) {
          console.error('Error initializing Globe:', error);
          MapService.notifyGlobeInitialized(false); // Notify failure
          MapService.setGlobeViewer(null); // Indicate no viewer available
        }
      });
    });
  },
  /**
   * @Lifecycle Hook: beforeUnmount
   * Cleans up CesiumGlobeManager and unsubscribes from RxJS observables.
   */
  beforeUnmount() {
    if (this.globeManager) {
      this.globeManager.removeCameraChangeListener(this.onCameraChanged);
      this.globeManager.destroy(); // Destroy Cesium Viewer via manager
    }
    // Unsubscribe from all RxJS observables.
    if (this.compassRedirectSubscription) this.compassRedirectSubscription.unsubscribe();
    if (this.graphicRenderSubscription) this.graphicRenderSubscription.unsubscribe();
    if (this.graphicRemovalSubscription) this.graphicRemovalSubscription.unsubscribe();
    if (this.zoomToCoordinatesSubscription) this.zoomToCoordinatesSubscription.unsubscribe();
    if (this.displayLocationMarkerSubscription) this.displayLocationMarkerSubscription.unsubscribe();
    if (this.initGlobeSubscription) this.initGlobeSubscription.unsubscribe();
  },
  methods: {
    /**
     * @method onCameraChanged
     * Callback for Cesium camera changes, delegates to CesiumGlobeManager.
     */
    onCameraChanged() {
      if (this.globeManager) {
        MapService.updateView(this.globeManager.getSceneInformation());
      }
    },

    // All these methods now simply delegate to the globeManager
    zoomIn() {
      console.log('Globe: zoomIn method called');
      if (this.globeManager) this.globeManager.zoomIn();
    },
    zoomOut() {
      console.log('Globe: zoomOut method called');
      if (this.globeManager) this.globeManager.zoomOut();
    },
    renderGraphic(graphic) {
      console.log('Globe: renderGraphic method called with graphic:', graphic);
      if (this.globeManager) this.globeManager.renderGraphic(graphic);
    },
    removeGraphic(graphicIdentifier) {
      console.log('Globe: removeGraphic method called for identifier:', graphicIdentifier);
      if (this.globeManager) this.globeManager.removeGraphic(graphicIdentifier);
    },
    zoomToCoordinates(coordinates) {
      console.log('Globe: zoomToCoordinates method called with coordinates:', coordinates);
      if (this.globeManager) this.globeManager.zoomToCoordinates(coordinates);
    },
    displayLocationMarker(location) {
      console.log('Globe: displayLocationMarker method called for location:', location);
      if (this.globeManager) this.globeManager.displayLocationMarker(location);
    },
    orientToNorth() {
      console.log('Globe: orientToNorth method called');
      if (this.globeManager) this.globeManager.orientToNorth();
    }
  }
};
</script>

<style scoped>
/* Only globe-specific styles remain here */
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
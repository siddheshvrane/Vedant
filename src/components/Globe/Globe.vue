<template>
  <div id="mapWrapper">
    <div id="globeContainer"></div>
  </div>
</template>

<script>
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJjNmUzZWU3Ni1kYzM3LTQyNzYtOTk0MS03YWVkMTZlNTU0MDMiLCJpZCI6MzEwMzcwLCJpYXQiOjE3NDk0NjMxNzl9.K7YHyi1fwwi5ICQKn4C82gUnv60u9nVs783T_UpHxG0';

import { MapService } from '../../services/controller.js';
import CesiumGlobeManager from './CesiumGlobeManager.js';

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
      visualizationModeSubscription: null, // New subscription for visualization mode changes
    };
  },
  mounted() {
    this.globeManager = new CesiumGlobeManager('globeContainer');

    this.compassRedirectSubscription = MapService.orientToNorth$.subscribe(this.orientToNorth);
    this.graphicRenderSubscription = MapService.renderGraphic$.subscribe(this.renderGraphic);
    this.graphicRemovalSubscription = MapService.removeGraphic$.subscribe(this.removeGraphic);
    this.zoomToCoordinatesSubscription = MapService.zoomToCoordinates$.subscribe(this.zoomToCoordinates);
    this.displayLocationMarkerSubscription = MapService.displayLocationMarker$.subscribe(this.displayLocationMarker);

    // New subscription to handle visualization mode changes
    this.visualizationModeSubscription = MapService.visualizationModeChanged$.subscribe(this.updateGlobeViewMode);


    this.initGlobeSubscription = MapService.initGlobe$.subscribe(() => {
      this.$nextTick(() => {
        try {
          const viewer = this.globeManager.init();
          this.globeManager.addCameraChangeListener(this.onCameraChanged);
          this.onCameraChanged();

          MapService.notifyGlobeInitialized(true);
          MapService.setGlobeViewer(viewer);
        } catch (error) {
          MapService.notifyGlobeInitialized(false);
          MapService.setGlobeViewer(null);
        }
      });
    });
  },
  beforeUnmount() {
    if (this.globeManager) {
      this.globeManager.removeCameraChangeListener(this.onCameraChanged);
      this.globeManager.destroy();
    }
    if (this.compassRedirectSubscription) this.compassRedirectSubscription.unsubscribe();
    if (this.graphicRenderSubscription) this.graphicRenderSubscription.unsubscribe();
    if (this.graphicRemovalSubscription) this.graphicRemovalSubscription.unsubscribe();
    if (this.zoomToCoordinatesSubscription) this.zoomToCoordinatesSubscription.unsubscribe();
    if (this.displayLocationMarkerSubscription) this.displayLocationMarkerSubscription.unsubscribe();
    if (this.initGlobeSubscription) this.initGlobeSubscription.unsubscribe();
    if (this.visualizationModeSubscription) this.visualizationModeSubscription.unsubscribe(); // Unsubscribe new subscription
  },
  methods: {
    onCameraChanged() {
      if (this.globeManager) {
        MapService.updateView(this.globeManager.getSceneInformation());
      }
    },
    zoomIn() {
      if (this.globeManager) this.globeManager.zoomIn();
    },
    zoomOut() {
      if (this.globeManager) this.globeManager.zoomOut();
    },
    renderGraphic(graphic) {
      if (this.globeManager) this.globeManager.renderGraphic(graphic);
    },
    removeGraphic(graphicIdentifier) {
      if (this.globeManager) this.globeManager.removeGraphic(graphicIdentifier);
    },
    zoomToCoordinates(coordinates) {
      if (this.globeManager) this.globeManager.zoomToCoordinates(coordinates);
    },
    displayLocationMarker(location) {
      if (this.globeManager) this.globeManager.displayLocationMarker(location);
    },
    orientToNorth() {
      if (this.globeManager) this.globeManager.orientToNorth();
    },
    // New method to update the globe's view mode
    updateGlobeViewMode(mode) {
      if (this.globeManager) {
        this.globeManager.setGlobeVisualizationMode(mode);
      }
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
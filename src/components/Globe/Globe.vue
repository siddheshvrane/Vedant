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
import { MapService } from '../../services/MapService.js'; // Corrected path to MapService.js
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

    // Consolidate subscriptions using the single 'subscriptions' object
    this.subscriptions.add(
      MapService.orientToNorth$.subscribe(() => {
        this.orientToNorth();
      })
    );
    this.subscriptions.add(
      MapService.renderGraphic$.subscribe(graphic => {
        this.renderGraphic(graphic);
      })
    );
    this.subscriptions.add(
      MapService.removeGraphic$.subscribe(graphicIdentifier => {
        this.removeGraphic(graphicIdentifier);
      })
    );
    this.subscriptions.add(
      MapService.zoomToCoordinates$.subscribe(coordinates => {
        this.zoomToCoordinates(coordinates);
      })
    );
    this.subscriptions.add(
      MapService.displayLocationMarker$.subscribe(location => {
        this.displayLocationMarker(location);
      })
    );
    this.subscriptions.add(
      MapService.visualizationModeChanged$.subscribe(mode => {
        this.updateGlobeViewMode(mode);
      })
    );

    // --- Subscriptions for Layer Management on Globe ---
    // Note: addLayerToGlobe, removeLayerFromGlobe, toggleLayerVisibilityOnGlobe
    // are still valid for direct (non-reconcile) operations, but for full sync,
    // reconcileGlobeLayers will be used.
    // However, it's generally best to let reconcileGlobeLayers handle all additions/removals
    // to maintain consistent Z-order. You might eventually deprecate direct add/remove/toggle
    // calls to `globeManager` and always funnel through `reconcileGlobeLayers` where appropriate.
    // For now, keep them if you have direct use cases.
    this.subscriptions.add(
      MapService.addLayerToGlobe$.subscribe(layerEntry => {
        this.addLayerToGlobe(layerEntry);
      })
    );
    this.subscriptions.add(
      MapService.removeLayerFromGlobe$.subscribe(layerId => {
        this.removeLayerFromGlobe(layerId);
      })
    );
    this.subscriptions.add(
      MapService.toggleLayerVisibilityOnGlobe$.subscribe(({ layerId, isVisible }) => {
        this.toggleLayerVisibilityOnGlobe(layerId, isVisible);
      })
    );

    // CRUCIAL: Subscribe to the new reconcileGlobeLayers$
    this.subscriptions.add(
      MapService.reconcileGlobeLayers$.subscribe(layersToReconcile => {
        this.reconcileGlobeLayers(layersToReconcile);
      })
    );

    // NEW: Subscribe to zoomToLayerOnGlobe$
    this.subscriptions.add(
      MapService.zoomToLayerOnGlobe$.subscribe(layerEntry => {
        this.zoomToLayerOnGlobe(layerEntry);
      })
    );

    // Initiate globe initialization.
    // This part should ensure the globe is created, and then MapService is informed.
    this.subscriptions.add(
      MapService.initGlobe$.subscribe(() => {
        this.$nextTick(() => {
          try {
            const viewer = this.globeManager.init();
            this.globeManager.addCameraChangeListener(this.onCameraChanged);
            this.onCameraChanged(); // Initial camera update

            MapService.notifyGlobeInitialized(true);
            MapService.setGlobeViewer(viewer); // This makes the viewer available to other services
          } catch (error) {
            console.error('Globe initialization error:', error);
            MapService.notifyGlobeInitialized(false);
            MapService.setGlobeViewer(null);
          }
        });
      })
    );
    // If you need the globe to initialize immediately on mount without an explicit MapService.initGlobe$ trigger
    // then you might want to call `MapService.triggerGlobeInitialization()` here, or just execute the `try...catch` block directly.
    // Given the `initGlobeSubscription`, it seems you expect an external trigger. Ensure that trigger happens.
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
    onCameraChanged() {
      if (this.globeManager) {
        MapService.updateView(this.globeManager.getSceneInformation());
      }
    },
    // ... (existing methods like zoomIn, zoomOut, renderGraphic, removeGraphic,
    // zoomToCoordinates, displayLocationMarker, orientToNorth, updateGlobeViewMode)
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
    updateGlobeViewMode(mode) {
        if (this.globeManager) {
            this.globeManager.setGlobeVisualizationMode(mode);
        }
    },
    // --- Methods to bridge to CesiumGlobeManager for Layer Management ---
    addLayerToGlobe(layerEntry) {
        if (this.globeManager) {
            // Note: This individual add is mostly for direct operations,
            // the full sync will use reconcileGlobeLayers.
            this.globeManager.addCesiumLayer(layerEntry);
        }
    },
    removeLayerFromGlobe(layerId) {
        if (this.globeManager) {
            // Similar to add, for direct removal. Full sync will use reconcile.
            this.globeManager.removeCesiumLayer(layerId);
        }
    },
    toggleLayerVisibilityOnGlobe(layerId, isVisible) {
        if (this.globeManager) {
            this.globeManager.toggleCesiumLayerVisibility(layerId, isVisible);
        }
    },
    // CRUCIAL: Method to handle the full layer reconciliation
    reconcileGlobeLayers(layersToReconcile) {
      if (this.globeManager) {
        this.globeManager.reconcileGlobeLayers(layersToReconcile);
      }
    },
    // NEW: Method to handle zoom to layer
    zoomToLayerOnGlobe(layerEntry) {
      if (this.globeManager) {
        this.globeManager.zoomToLayer(layerEntry);
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
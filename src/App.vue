<template>
  <div>
    <Globe @globe-ready="handleGlobeLoaded" />

    <SceneInfo v-show="globeIsLoaded" />

    <MenuSidebar
      @service-added="showServiceAddedPopup"
      @open-visualization-sidebar="openVisualizationSidebar"
      v-show="globeIsLoaded"
    />

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
import Globe from './components/Globe.vue';
import MenuSidebar from './components/MenuSidebar.vue';
import VisualizationSidebar from './components/sub-sidebars/VisualizationSidebar.vue';
import SceneInfo from './components/SceneInfo.vue';

import PopupManager from './components/utils/PopupManager';
import { MapService } from './services.js';

export default {
  name: 'App',
  components: {
    Globe,
    MenuSidebar,
    VisualizationSidebar,
    SceneInfo,
  },
  data() {
    return {
      popupManager: new PopupManager(),
      showVisualizationSidebar: false,
      globeIsLoaded: false, // New data property to track globe loading state
    };
  },
  methods: {
    /**
     * @method handleGlobeLoaded
     * @description Sets globeIsLoaded to true when the Globe component emits 'globe-ready'.
     * @returns {void}
     */
    handleGlobeLoaded() {
      this.globeIsLoaded = true;
    },
    handleZoomToCoordinates(coordinates) {
      MapService.zoomToCoordinates(coordinates);
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
      console.log(`App.vue: handleVisualizationModeChange for mode: ${mode}`);
    },
  },
  computed: {
    serviceParameters() {
      return this.popupManager.getParams();
    },
    showPopup() {
      return this.popupManager.isVisible();
    },
  },
};
</script>

<style>
/* Global styles from App.vue if any */
</style>
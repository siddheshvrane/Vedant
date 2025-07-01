<template>
  <div>
    <Globe />

    <!-- Integrate the new SceneInfo component here -->
    <SceneInfo :is-visible="!loading" />

    <MenuSidebar
      @service-added="showServiceAddedPopup"
      @open-visualization-sidebar="openVisualizationSidebar"
      v-show="!loading"
    />

    <!-- SearchPanel is already integrated in Globe.vue now -->
    <!-- <SearchPanel @zoom-to-coordinates="handleZoomToCoordinates" v-show="!loading" /> -->

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
// SearchPanel is now integrated directly into Globe.vue's template
// import SearchPanel from './components/SearchPanel.vue';
import VisualizationSidebar from './components/sub-sidebars/VisualizationSidebar.vue';
import SceneInfo from './components/SceneInfo.vue'; // NEW: Import SceneInfo

import PopupManager from './components/utils/PopupManager';
import { MapService } from './services.js';

export default {
  name: 'App',
  components: {
    Globe,
    MenuSidebar,
    // SearchPanel is no longer directly here
    VisualizationSidebar,
    SceneInfo, // NEW: Register SceneInfo
  },
  data() {
    return {
      popupManager: new PopupManager(),
      showVisualizationSidebar: false,
      loading: false, // App.vue no longer manages the main loading screen for the globe
    };
  },
  methods: {
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
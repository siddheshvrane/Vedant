<template>
  <div>
    <Globe @globe-ready="handleGlobeLoaded" />

    <SceneInfo v-show="globeIsLoaded" />

    <Menu v-show="globeIsLoaded && !isSidebarOpen" />

    <Sidebar v-show="globeIsLoaded && isSidebarOpen"
      @service-added="showServiceAddedPopup"
      @open-visualization-sidebar="openVisualizationSidebar"
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
// Remove the old MenuSidebar import
// import MenuSidebar from './components/MenuSidebar.vue'; 
import VisualizationSidebar from './components/sub-sidebars/VisualizationSidebar.vue';
import SceneInfo from './components/SceneInfo.vue';

// Import the new Menu and Sidebar components
import Menu from './components/Menu.vue';
import Sidebar from './components/Sidebar.vue';

import PopupManager from './components/utils/PopupManager';
// Ensure UserInterfaceService is imported
import { MapService, UserInterfaceService } from './services.js'; 

export default {
  name: 'App',
  components: {
    Globe,
    // Remove MenuSidebar from components list
    // MenuSidebar, 
    VisualizationSidebar,
    SceneInfo,
    // Add new components
    Menu,
    Sidebar,
  },
  data() {
    return {
      popupManager: new PopupManager(),
      showVisualizationSidebar: false,
      globeIsLoaded: false,
      isSidebarOpen: false, // New state to track if sidebar is currently open
      sidebarVisibilitySubscription: null, // For RxJS subscription cleanup
    };
  },
  mounted() {
    // Subscribe to UserInterfaceService to get updates on sidebar visibility
    this.sidebarVisibilitySubscription = UserInterfaceService.isSidebarOpen$.subscribe(isOpen => {
      this.isSidebarOpen = isOpen;
      console.log('App.vue: Sidebar visibility updated to:', this.isSidebarOpen);
    });
  },
  beforeUnmount() {
    // Unsubscribe to prevent memory leaks
    if (this.sidebarVisibilitySubscription) {
      this.sidebarVisibilitySubscription.unsubscribe();
    }
  },
  methods: {
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
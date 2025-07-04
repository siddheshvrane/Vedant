<template>
  <div id="app-container">
    <ProjectLogo />

    <Globe />

    <SceneInfo v-if="globeIsReady" :is-sidebar-open="isSidebarOpen" />

    <Compass v-if="viewerInstance" />
    <SearchPanel v-if="viewerInstance" />

    <Menu v-show="globeIsReady && !isSidebarOpen" />
    <Sidebar v-show="globeIsReady && isSidebarOpen"
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
import SceneInfo from './components/SceneInfo.vue';
import Compass from './components/Compass.vue';
import SearchPanel from './components/SearchPanel.vue';
import ProjectLogo from './components/ProjectLogo.vue';
import Menu from './components/Menu.vue';
import Sidebar from './components/Sidebar.vue';
import VisualizationSidebar from './components/sub-sidebars/VisualizationSidebar.vue';

import PopupManager from './components/utils/PopupManager';
// IMPORTANT CHANGE: AppInitializer is NOT imported here because it's handled directly in your combined controller.js
import { MapService, UserInterfaceService } from './services/controller.js';

export default {
  name: 'App',
  components: {
    Globe,
    SceneInfo,
    Compass,
    SearchPanel,
    ProjectLogo,
    Menu,
    Sidebar,
    VisualizationSidebar,
  },
  data() {
    return {
      popupManager: new PopupManager(),
      showVisualizationSidebar: false,
      globeIsReady: false, // Controls visibility of main UI elements
      viewerInstance: null, // Holds the Cesium viewer instance from MapService for global availability if needed
      isSidebarOpen: false, // State to track if sidebar is currently open
      // Subscriptions for cleanup
      projectLogoReadySubscription: null,
      globeInitializedSubscription: null,
      globeViewerSubscription: null,
      sidebarVisibilitySubscription: null,
    };
  },
  created() {
    // IMPORTANT CHANGE: AppInitializer.initialize() is no longer called here.
    // It's called directly within your combined controller.js file when the app starts.
    console.log('App.vue: created. AppInitializer handled in controller.js.');
  },
  mounted() {
    console.log('App.vue: mounted');

    // These subscriptions are still needed for App.vue to react to service updates
    this.projectLogoReadySubscription = UserInterfaceService.projectLogoReady$.subscribe(() => {
        console.log('App.vue: ProjectLogo ready signal received. (AppInitializer in controller.js acts on this)');
    });

    this.globeInitializedSubscription = MapService.globeInitialized$.subscribe(isReady => {
      this.globeIsReady = isReady;
      if (!isReady) {
        console.error('App.vue: Globe failed to initialize.');
      }
      console.log('App.vue: Globe initialization status updated to:', isReady);
    });

    this.globeViewerSubscription = MapService.globeViewer$.subscribe(viewer => {
      this.viewerInstance = viewer;
      if (viewer) {
          console.log('App.vue: Cesium Viewer instance received.');
      } else {
          console.log('App.vue: Cesium Viewer instance is null (failed init or destroyed).');
      }
    });

    this.sidebarVisibilitySubscription = UserInterfaceService.isSidebarOpen$.subscribe(isOpen => {
      this.isSidebarOpen = isOpen;
      console.log('App.vue: Sidebar visibility updated to:', this.isSidebarOpen);
    });
  },
  beforeUnmount() {
    console.log('App.vue: beforeUnmount - Cleaning up subscriptions.');
    if (this.projectLogoReadySubscription) this.projectLogoReadySubscription.unsubscribe();
    if (this.globeInitializedSubscription) this.globeInitializedSubscription.unsubscribe();
    if (this.globeViewerSubscription) this.globeViewerSubscription.unsubscribe();
    if (this.sidebarVisibilitySubscription) this.sidebarVisibilitySubscription.unsubscribe();
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
      UserInterfaceService.toggleSidebar(true);
    },
    closeVisualizationSidebar() {
      this.showVisualizationSidebar = false;
      UserInterfaceService.toggleSidebar(false); // Assuming closing viz sidebar means closing main sidebar
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
/* ... (Your existing CSS for App.vue) ... */
#app-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  font-family: 'Poppins', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

body {
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#globeContainer {
  width: 100%;
  height: 100%;
}

.service-added-popup-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.service-added-popup {
  background-color: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  width: 300px;
  text-align: left;
}

.popup-title {
  color: #333;
  font-size: 1.2em;
  margin-bottom: 15px;
}

.popup-content p {
  margin-bottom: 8px;
  font-size: 0.9em;
  color: #555;
}

.close-popup-btn {
  margin-top: 20px;
  width: 100%;
}
</style>
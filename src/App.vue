<template>
  <div id="app-container">
    <ProjectLogo />

    <Globe />

    <SceneInfo
      v-if="globeIsReady"
      :is-sidebar-open="isSidebarOpen"
      :sidebar-width="currentSidebarWidth" />

    <Compass v-if="viewerInstance" />
    <SearchPanel v-if="viewerInstance" />

    <Menu v-show="globeIsReady" />

    <Popup />
  </div>
</template>

<script>
import Globe from './components/Globe/Globe.vue';
import SceneInfo from './components/SceneInfo/SceneInfo.vue';
import Compass from './components/Compass/Compass.vue';
import SearchPanel from './components/SearchPanel/SearchPanel.vue';
import ProjectLogo from './components/ProjectLogo/ProjectLogo.vue';
import Menu from './components/Menu/Menu.vue';
import Popup from './components/Popup/Popup.vue';

import { MapService, UserInterfaceService } from './controller.js';

export default {
  name: 'App',
  components: {
    Globe,
    SceneInfo,
    Compass,
    SearchPanel,
    ProjectLogo,
    Menu,
    Popup,
  },
  data() {
    return {
      globeIsReady: false,
      viewerInstance: null,
      isSidebarOpen: false,
      currentSidebarWidth: '0px', // Will be updated by service subscription
      projectLogoReadySubscription: null,
      globeInitializedSubscription: null,
      globeViewerSubscription: null,
      sidebarVisibilitySubscription: null,
      sidebarWidthSubscription: null, // NEW: Subscription for sidebar width
    };
  },
  created() {
  },
  mounted() {
    this.projectLogoReadySubscription = UserInterfaceService.projectLogoReady$.subscribe(() => {
    });

    this.globeInitializedSubscription = MapService.globeInitialized$.subscribe(isReady => {
      this.globeIsReady = isReady;
    });

    this.globeViewerSubscription = MapService.globeViewer$.subscribe(viewer => {
      this.viewerInstance = viewer;
    });

    this.sidebarVisibilitySubscription = UserInterfaceService.isSidebarOpen$.subscribe(isOpen => {
      this.isSidebarOpen = isOpen;
      // If the sidebar is closed via the service, its width will be reset to 0px via the service too.
    });

    // NEW: Subscribe to the sidebar width updates from the service
    this.sidebarWidthSubscription = UserInterfaceService.sidebarWidthUpdated$.subscribe(width => {
      this.currentSidebarWidth = width;
    });
  },
  beforeUnmount() {
    if (this.projectLogoReadySubscription) this.projectLogoReadySubscription.unsubscribe();
    if (this.globeInitializedSubscription) this.globeInitializedSubscription.unsubscribe();
    if (this.globeViewerSubscription) this.globeViewerSubscription.unsubscribe();
    if (this.sidebarVisibilitySubscription) this.sidebarVisibilitySubscription.unsubscribe();
    if (this.sidebarWidthSubscription) this.sidebarWidthSubscription.unsubscribe(); // NEW: Unsubscribe
  },
  methods: {
    handleZoomToCoordinates(coordinates) {
      MapService.zoomToCoordinates(coordinates);
    },
  },
  computed: {
  },
};
</script>

<style>
/* ... (Your existing App.vue styles) ... */
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
</style>
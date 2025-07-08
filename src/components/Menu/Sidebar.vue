<template>
  <transition name="slide">
    <div v-if="isOpen" class="sidebar-content text-white shadow" :style="{ width: currentSidebarWidth }">
      <div v-if="!activeSubMenu" class="main-menu-panel">
        <ul class="list-unstyled sidebar-menu">
          <MenuItems :items="menuItems" @menu-item-clicked="handleMenuItemClick" />
        </ul>
      </div>

      <component
        :is="activeSubMenuComponent"
        v-if="activeSubMenu"
        @close-sub-menu="handleCloseSubMenu"
        @update-visualization-mode="handleVisualizationModeChange"
        class="sub-sidebar-transition-target"
      />
    </div>
  </transition>
</template>

<script>
import AddDataSidebar from './SubSidebars/AddData/AddDataSidebar.vue';
import LayerManagerSidebar from './SubSidebars/LayerManager/LayerManagerSidebar.vue';
import VisualizationSidebar from './SubSidebars/Visualization/VisualizationSidebar.vue';
import PluginManagerSidebar from './SubSidebars/Plugins/PluginManagerSidebar.vue';
import BasicToolsSidebar from './SubSidebars/BasicTools/BasicToolsSidebar.vue';

import MenuItems from './MenuItems.vue';
import { UserInterfaceService, MenuItemService, MapService } from '../../services/controller.js';

export default {
  name: 'Sidebar',
  components: {
    AddDataSidebar,
    LayerManagerSidebar,
    VisualizationSidebar,
    PluginManagerSidebar,
    BasicToolsSidebar,
    MenuItems,
  },
  data() {
    return {
      isOpen: false,
      activeSubMenu: null,
      activeSubMenuComponent: null,
      currentSidebarWidth: '0px', // Initialize to '0px' by default when closed
      menuItems: [],
      openSidebarSubscription: null,
      activateFeatureSubscription: null,
      closeSidebarSubscription: null,
      menuItemsLoadedSubscription: null,
    };
  },
  emits: ['service-added'],

  // REMOVED: The watcher for currentSidebarWidth.
  // We will now explicitly call updateSidebarWidth in the methods below.

  mounted() {
    this.openSidebarSubscription = UserInterfaceService.openSidebarPanel$.subscribe(this.handleOpenSidebarPanel);
    this.activateFeatureSubscription = UserInterfaceService.activateFeature$.subscribe(this.handleActivateFeature);
    this.closeSidebarSubscription = UserInterfaceService.closeSidebar$.subscribe(this.handleCloseSidebar);

    this.menuItemsLoadedSubscription = MenuItemService.menuItemsLoaded$.subscribe(items => {
      this.menuItems = items;
    });

    MenuItemService.retrieveAll();

    // IMPORTANT: No initial UserInterfaceService.updateSidebarWidth(this.currentSidebarWidth) here.
    // The BehaviorSubject in controller.js already defaults to '0px'.
  },
  beforeUnmount() {
    if (this.openSidebarSubscription) this.openSidebarSubscription.unsubscribe();
    if (this.activateFeatureSubscription) this.activateFeatureSubscription.unsubscribe();
    if (this.closeSidebarSubscription) this.closeSidebarSubscription.unsubscribe();
    if (this.menuItemsLoadedSubscription) this.menuItemsLoadedSubscription.unsubscribe();
    
    // When Sidebar unmounts, explicitly signal 0px width to ensure SceneInfo is reset.
    UserInterfaceService.updateSidebarWidth('0px');
  },
  methods: {
    handleOpenSidebarPanel() {
      this.isOpen = true;
      this.activeSubMenu = null;
      this.activeSubMenuComponent = null;
      this.currentSidebarWidth = '300px'; // Set to default open width
      // Publish the new width to the service
      UserInterfaceService.updateSidebarWidth(this.currentSidebarWidth);
    },
    handleActivateFeature(item) {
      if (item && item.component) {
        this.activeSubMenu = item.id;
        this.activeSubMenuComponent = item.component;
        this.currentSidebarWidth = item.width || '350px'; // Set to specific sub-menu width
      } else if (item === null) {
        this.activeSubMenu = null;
        this.activeSubMenuComponent = null;
        this.currentSidebarWidth = '300px'; // Reset to main sidebar width
      }
      // Publish the new width to the service
      UserInterfaceService.updateSidebarWidth(this.currentSidebarWidth);
    },
    handleCloseSidebar() {
      this.isOpen = false;
      this.activeSubMenu = null;
      this.activeSubMenuComponent = null;
      this.currentSidebarWidth = '0px'; // Set to 0px when completely closed
      // Publish the 0px width to the service
      UserInterfaceService.updateSidebarWidth(this.currentSidebarWidth);
    },
    handleCloseSubMenu() {
      UserInterfaceService.handleCloseSubMenu();
    },
    handleMenuItemClick(item) {
      UserInterfaceService.handleMenuItemClick(item);
    },
    handleVisualizationModeChange(mode) {
      MapService.setVisualizationMode(mode);
    }
  },
};
</script>

<style scoped>
/* ... (Your existing Sidebar.vue styles remain unchanged) ... */
.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sidebar-content {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  padding-top: 70px;
  z-index: 1050;
  display: flex;
  flex-direction: column;
  background: rgba(30, 30, 30, 0.7);
  opacity: 1;
  transition: width 0.3s ease, transform 0.3s ease;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.5);
  text-align: left;
}

.main-menu-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.sidebar-menu {
  width: 100%;
  padding: 0;
  margin: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(-100%);
}

.sub-sidebar-transition-target {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  padding-top: 70px;
  display: flex;
  flex-direction: column;
  background: rgba(30, 30, 30, 0);
  box-shadow: none;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
</style>
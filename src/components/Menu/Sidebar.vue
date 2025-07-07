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
// UPDATE THIS LINE: Add MapService to the import
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
      isOpen: false, // Sidebar's internal state for transitions and display
      activeSubMenu: null,
      activeSubMenuComponent: null,
      currentSidebarWidth: '300px',
      menuItems: [],
      openSidebarSubscription: null,
      activateFeatureSubscription: null,
      closeSidebarSubscription: null,
      menuItemsLoadedSubscription: null,
    };
  },
  emits: ['close-sidebar', 'service-added'], // Declare emitted events to parent

  mounted() {
    this.openSidebarSubscription = UserInterfaceService.openSidebarPanel$.subscribe(this.handleOpenSidebarPanel);
    this.activateFeatureSubscription = UserInterfaceService.activateFeature$.subscribe(this.handleActivateFeature);
    this.closeSidebarSubscription = UserInterfaceService.closeSidebar$.subscribe(this.handleCloseSidebar);

    this.menuItemsLoadedSubscription = MenuItemService.menuItemsLoaded$.subscribe(items => {
      this.menuItems = items;
    });

    MenuItemService.retrieveAll();
  },
  beforeUnmount() {
    if (this.openSidebarSubscription) this.openSidebarSubscription.unsubscribe();
    if (this.activateFeatureSubscription) this.activateFeatureSubscription.unsubscribe();
    if (this.closeSidebarSubscription) this.closeSidebarSubscription.unsubscribe();
    if (this.menuItemsLoadedSubscription) this.menuItemsLoadedSubscription.unsubscribe();
  },
  methods: {
    handleOpenSidebarPanel() {
      this.isOpen = true;
      this.activeSubMenu = null; // Ensure main menu is shown on initial open
      this.activeSubMenuComponent = null; // Ensure main menu is shown on initial open
      this.currentSidebarWidth = '300px';
    },
    handleActivateFeature(item) {
      if (item && item.component) {
        this.activeSubMenu = item.id;
        this.activeSubMenuComponent = item.component;
        this.currentSidebarWidth = item.width || '350px';
      } else if (item === null) {
        this.activeSubMenu = null;
        this.activeSubMenuComponent = null;
        this.currentSidebarWidth = '300px'; // Reset width to default sidebar width
      }
    },
    handleCloseSidebar() {
      this.isOpen = false;
      this.activeSubMenu = null; // Reset sub-menu on full sidebar close
      this.activeSubMenuComponent = null; // Reset sub-menu on full sidebar close
      this.currentSidebarWidth = '300px';
      this.$emit('close-sidebar');
    },
    handleCloseSubMenu() {
      UserInterfaceService.handleCloseSubMenu();
    },
    handleMenuItemClick(item) {
      UserInterfaceService.handleMenuItemClick(item);
    },
    // New method to handle visualization mode changes from VisualizationSidebar
    handleVisualizationModeChange(mode) {
      MapService.setVisualizationMode(mode); // Notify MapService of the mode change
    }
  },
};
</script>

<style scoped>
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
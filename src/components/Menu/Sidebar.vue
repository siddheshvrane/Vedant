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
        @update-visualization-mode="$emit('open-visualization-sidebar', $event)"
        class="sub-sidebar-transition-target"
      />
    </div>
  </transition>
</template>

<script>
// Corrected import paths for sub-sidebars:
import AddDataSidebar from '../sub-sidebars/AddDataSidebar.vue';
import LayerManagerSidebar from '../sub-sidebars/LayerManagerSidebar.vue';
import VisualizationSidebar from '../sub-sidebars/VisualizationSidebar.vue';
import PluginManagerSidebar from '../sub-sidebars/PluginManagerSidebar.vue';
import BasicToolsSidebar from '../sub-sidebars/BasicToolsSidebar.vue';

import MenuItems from './MenuItems.vue';
import { UserInterfaceService, MenuItemService } from '../../services/controller.js';

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
    // Sidebar still listens to service signals for its internal state/transitions
    this.openSidebarSubscription = UserInterfaceService.openSidebarPanel$.subscribe(this.handleOpenSidebarPanel);
    this.activateFeatureSubscription = UserInterfaceService.activateFeature$.subscribe(this.handleActivateFeature);
    // Sidebar listens to closeSidebar$ to trigger its internal close animation
    this.closeSidebarSubscription = UserInterfaceService.closeSidebar$.subscribe(this.handleCloseSidebar);

    this.menuItemsLoadedSubscription = MenuItemService.menuItemsLoaded$.subscribe(items => {
      this.menuItems = items;
      // console.log('Sidebar: Menu items loaded:', this.menuItems);
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
      // console.log('Sidebar: Opening internal panel.');
    },
    handleActivateFeature(item) {
      if (item && item.component) {
        // If an item with a component is provided, activate the sub-menu
        this.activeSubMenu = item.id;
        this.activeSubMenuComponent = item.component;
        this.currentSidebarWidth = item.width || '350px';
        // console.log(`Sidebar: Activating feature: ${item.name}`);
      } else if (item === null) {
        // If item is null, it signals to return to the main menu
        this.activeSubMenu = null;
        this.activeSubMenuComponent = null;
        this.currentSidebarWidth = '300px'; // Reset width to default sidebar width
        // console.log('Sidebar: Deactivating feature, returning to main menu.');
      }
    },
    handleCloseSidebar() {
      // Sidebar sets its own internal state for closing animation
      this.isOpen = false;
      this.activeSubMenu = null; // Reset sub-menu on full sidebar close
      this.activeSubMenuComponent = null; // Reset sub-menu on full sidebar close
      this.currentSidebarWidth = '300px';
      // Emit event to parent (Menu.vue) to handle updating global UserInterfaceService state
      this.$emit('close-sidebar');
      // console.log('Sidebar: Closing internal panel and emitting close-sidebar event.');
    },
    handleCloseSubMenu() {
      // This calls the UserInterfaceService to signal that the sub-menu should close.
      // The service will then emit null via activateFeature$, which this.handleActivateFeature() will catch.
      UserInterfaceService.handleCloseSubMenu();
      // console.log('Sidebar: Requesting sub-menu to close via service.');
    },
    handleMenuItemClick(item) {
      UserInterfaceService.handleMenuItemClick(item);
      // console.log('Sidebar: Menu item clicked, notifying service.');
    },
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
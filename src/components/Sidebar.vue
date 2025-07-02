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
// Your script content here
import AddDataSidebar from './sub-sidebars/AddDataSidebar.vue';
import LayerManagerSidebar from './sub-sidebars/LayerManagerSidebar.vue';
import VisualizationSidebar from './sub-sidebars/VisualizationSidebar.vue';
import PluginManagerSidebar from './sub-sidebars/PluginManagerSidebar.vue';
import MenuItems from './MenuItems.vue';
import { UserInterfaceService, MenuItemService } from '../services.js';

export default {
  name: 'Sidebar',
  components: {
    AddDataSidebar,
    LayerManagerSidebar,
    VisualizationSidebar,
    PluginManagerSidebar,
    MenuItems,
  },
  data() {
    return {
      isOpen: false,
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
  mounted() {
    this.openSidebarSubscription = UserInterfaceService.openSidebarPanel$.subscribe(this.handleOpenSidebarPanel);
    this.activateFeatureSubscription = UserInterfaceService.activateFeature$.subscribe(this.handleActivateFeature);
    this.closeSidebarSubscription = UserInterfaceService.closeSidebar$.subscribe(this.handleCloseSidebar);

    this.menuItemsLoadedSubscription = MenuItemService.menuItemsLoaded$.subscribe(items => {
      this.menuItems = items;
      console.log('Sidebar: Menu items loaded:', this.menuItems);
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
      this.activeSubMenu = null;
      this.activeSubMenuComponent = null;
      this.currentSidebarWidth = '300px';
    },
    handleActivateFeature(item) {
      if (item && item.component) {
        this.activeSubMenu = item.id;
        this.activeSubMenuComponent = item.component;
        this.currentSidebarWidth = item.width || '350px';
      }
    },
    handleCloseSidebar() {
      this.isOpen = false;
      this.activeSubMenu = null;
      this.activeSubMenuComponent = null;
      this.currentSidebarWidth = '300px';
    },
    handleCloseSubMenu() {
      UserInterfaceService.handleCloseSubMenu();
    },
    handleMenuItemClick(item) {
      UserInterfaceService.handleMenuItemClick(item);
    },
  },
};
</script>

<style scoped>
/* Your style content here */
.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sidebar-content {
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  padding-top: 70px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  background: rgba(30, 30, 30, 0.6) !important;
  opacity: 1 !important;
  transition: width 0.3s ease, transform 0.3s ease;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.5);
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
  background: rgba(30, 30, 30, 0.7);
  box-shadow: none;
}
</style>
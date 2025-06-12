<template>
  <div class="menu-container">
    <button v-if="!menuManager.currentViewIsOpen" @click="menuManager.openInitialMenu()" class="btn btn-dark menu-icon">
      <span class="navbar-toggler-icon"></span>
    </button>

    <transition name="slide">
      <div v-if="menuManager.currentViewIsOpen" class="sidebar-content text-white shadow" :style="{ width: menuManager.currentSidebarWidth }">
        <div v-if="menuManager.isOpen && !menuManager.activeSubMenu" class="main-menu-panel">
          <ul class="list-unstyled sidebar-menu">
            <li>
              <button @click="menuManager.closeAll()" class="btn btn-link text-white sidebar-item poppins-font">
                <i class="fas fa-times me-3"></i>
                <span>Close</span>
              </button>
            </li>
            <li v-for="item in menuManager.menuItems" :key="item.id">
              <button @click="menuManager.handleMenuItemClick(item)" class="btn btn-link text-white sidebar-item poppins-font">
                <i :class="item.icon" class="me-3"></i>
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </div>

        <component
          :is="menuManager.activeSubMenuComponent"
          v-if="menuManager.activeSubMenu"
          @close-sub-menu="menuManager.handleCloseSubMenu()"
          @update-visualization-mode="$emit('open-visualization-sidebar', $event)"
          class="sub-sidebar-transition-target"
        />
      </div>
    </transition>
  </div>
</template>

<script>
import AddDataSidebar from './sub-sidebars/AddDataSidebar.vue';
import LayerManagerSidebar from './sub-sidebars/LayerManagerSidebar.vue';
import VisualizationSidebar from './sub-sidebars/VisualizationSidebar.vue';
// If you have other sub-sidebars, uncomment and import them here
// import ToolsSidebar from './sub-sidebars/ToolsSidebar.vue';
// import PluginsSidebar from './sub-sidebars/PluginsSidebar.vue';

import { MenuSidebarManager } from './utils/MenuSidebarManager.js'; // Import the new class

export default {
  name: 'MenuSidebar',

  components: {
    AddDataSidebar,
    LayerManagerSidebar,
    VisualizationSidebar,
  },

  data() {
    const menuItems = [
      { id: 'addData', label: 'Add Data', icon: 'far fa-plus', component: 'AddDataSidebar', width: '350px' },
      { id: 'layerManager', label: 'Layer Manager', icon: 'fas fa-layer-group', component: 'LayerManagerSidebar', width: '350px' },
      { id: 'visualization', label: 'Visualization', icon: 'far fa-eye', component: 'VisualizationSidebar', width: '350px' },
      { id: 'tools', label: 'Tools', icon: 'fas fa-tools', component: 'ToolsSidebar', width: '350px' },
      { id: 'plugins', label: 'Plugins', icon: 'fas fa-plug', component: 'PluginsSidebar', width: '350px' },
    ];
    return {
      menuManager: new MenuSidebarManager(menuItems), // Create an instance of the class
    };
  },

};
</script>

<style scoped>

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.menu-icon {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1001;
  width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.menu-icon.btn {
    padding: 0;
}

.menu-icon .navbar-toggler-icon {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 1%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
    width: 1em;
    height: 1em;
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
  transition: width 0.3s ease;
  filter: none;
}


.main-menu-panel {
    width: 100%;
    height: 100%;
}

.sidebar-menu {
  width: 100%;
}

.sidebar-item {
  padding: 15px 20px;
  width: 100%;
  display: flex;
  align-items: center;
  font-size: 1.1em;
  text-decoration: none;
  border-radius: 0;
}

.sidebar-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  text-decoration: none;
}

.sidebar-item i {
  font-size: 1.5em;
  width: 25px;
  text-align: center;
}

.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from, .slide-leave-to {
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
}
</style>
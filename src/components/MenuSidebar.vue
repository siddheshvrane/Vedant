<template>
  <div class="menu-container">
    <button v-if="!currentViewIsOpen" @click="openInitialSidebar" class="btn btn-dark menu-icon">
      <span class="navbar-toggler-icon"></span>
    </button>

    <transition name="slide">
      <div v-if="currentViewIsOpen" class="sidebar-content text-white shadow" :style="{ width: currentSidebarWidth }">
        <div v-if="isOpen && !activeSubMenu" class="main-menu-panel">
          <ul class="list-unstyled sidebar-menu">
            <li>
              <button @click="closeSidebar" class="btn btn-link text-white sidebar-item poppins-font">
                <i class="fas fa-times me-3"></i>
                <span>Close</span>
              </button>
            </li>
            <li v-for="item in menuItems" :key="item.id">
              <button @click="handleMenuItemClick(item)" class="btn btn-link text-white sidebar-item poppins-font">
                <i :class="item.icon" class="me-3"></i>
                <span>{{ item.label }}</span>
              </button>
            </li>
          </ul>
        </div>

        <component
          :is="activeSubMenuComponent"
          v-if="activeSubMenu"
          @close-sub-menu="handleCloseSubMenu"
          class="sub-sidebar-transition-target"
        />
        </div>
    </transition>
  </div>
</template>

<script>
// Import your sub-sidebar components
import AddDataSidebar from './sub-sidebars/AddDataSidebar.vue';
import LayerManagerSidebar from './sub-sidebars/LayerManagerSidebar.vue';
// If you have other sub-sidebars, uncomment and import them here
// import VisualizationSidebar from './sub-sidebars/VisualizationSidebar.vue';
// import ToolsSidebar from './sub-sidebars/ToolsSidebar.vue';
// import PluginsSidebar from './sub-sidebars/PluginsSidebar.vue';


export default {
  name: 'MenuSidebar',

  components: {
    AddDataSidebar,
    LayerManagerSidebar,
    // Register other sub-sidebar components here
    // VisualizationSidebar,
    // ToolsSidebar,
    // PluginsSidebar,
  },

  data() {
    return {
      isOpen: false,
      activeSubMenu: null,
      currentSidebarWidth: '250px',

      menuItems: [
        { id: 'addData', label: 'Add Data', icon: 'far fa-plus', component: 'AddDataSidebar', width: '350px' },
        { id: 'layerManager', label: 'Layer Manager', icon: 'fas fa-layer-group', component: 'LayerManagerSidebar', width: '350px' },
        { id: 'visualization', label: 'Visualization', icon: 'far fa-eye', component: 'VisualizationSidebar', width: '350px' },
        { id: 'tools', label: 'Tools', icon: 'fas fa-tools', component: 'ToolsSidebar', width: '350px' },
        { id: 'plugins', label: 'Plugins', icon: 'fas fa-plug', component: 'PluginsSidebar', width: '350px' },
      ]
    };
  },

  computed: {
    currentViewIsOpen() {
      return this.isOpen || this.activeSubMenu !== null;
    },

    activeSubMenuComponent() {
      const item = this.menuItems.find(item => item.id === this.activeSubMenu);
      return item ? item.component : null;
    }
  },

  methods: {
    openInitialSidebar() {
      this.isOpen = true;
      this.activeSubMenu = null;
      this.currentSidebarWidth = '250px';
    },

    closeSidebar() {
      this.isOpen = false;
      this.activeSubMenu = null;
      this.currentSidebarWidth = '250px';
    },

    handleMenuItemClick(item) {
      if (item.component) {
        this.activeSubMenu = item.id;
        this.isOpen = true;
        this.currentSidebarWidth = item.width || '250px';
      } else {
        console.log(`Clicked: ${item.label} (No sub-menu component defined)`);
      }
    },

    handleCloseSubMenu() {
      this.activeSubMenu = null;
      this.isOpen = true;
      this.currentSidebarWidth = '250px';
    }
  }
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
  background: rgba(30, 30, 30, 0.6) !important; /* REVERTED TO 0.9, KEEP !important */
  opacity: 1 !important; /* KEEP !important FOR EXPLICIT OPACITY OVERRIDE */
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

/* Overall Slide Transition for the main sidebar wrapper */
.slide-enter-active, .slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from, .slide-leave-to {
  transform: translateX(-100%);
}

/* REMOVED .fade-enter-active, .fade-leave-active, .fade-enter-from, .fade-leave-to RULES HERE */

.sub-sidebar-transition-target {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding-top: 70px;
    display: flex;
    flex-direction: column;
    background: rgba(30, 30, 30, 0.9) !important; /* REVERTED TO 0.9, KEEP !important */
    opacity: 1 !important; /* KEEP !important FOR EXPLICIT OPACITY OVERRIDE */
}
</style>
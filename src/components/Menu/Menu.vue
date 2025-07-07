<template>
  <div class="menu-container">
    <button @click="openMenu" class="btn btn-dark menu-icon" v-show="!showLocalSidebar">
      <span class="navbar-toggler-icon"></span>
    </button>

    <Sidebar
      v-show="showLocalSidebar"
      @service-added="handleServiceAdded"
      @close-sidebar="handleCloseSidebarFromChild"
    />
  </div>
</template>

<script>
import { UserInterfaceService } from '../../services/controller.js';
import Sidebar from './Sidebar.vue'; // Import Sidebar, as it's now a child

export default {
  name: 'Menu',
  components: {
    Sidebar, // Register Sidebar
  },
  data() {
    return {
      showLocalSidebar: false, // Local state to control Sidebar visibility
      sidebarGlobalSubscription: null,
    };
  },
  mounted() {
    // Subscribe to global sidebar state changes (e.g., if a sub-menu closes via service)
    // This keeps Menu's local 'showLocalSidebar' in sync with the global 'isSidebarOpen'
    this.sidebarGlobalSubscription = UserInterfaceService.isSidebarOpen$.subscribe(isOpen => {
      this.showLocalSidebar = isOpen;
      // console.log('Menu.vue: Local sidebar visibility synced with global state:', isOpen);
    });
  },
  beforeUnmount() {
    if (this.sidebarGlobalSubscription) {
      this.sidebarGlobalSubscription.unsubscribe();
    }
  },
  methods: {
    /**
     * @method openMenu
     * @description Triggers the UserInterfaceService to open the initial sidebar menu.
     * This will correctly trigger Sidebar.vue's internal 'isOpen' state.
     */
    openMenu() {
      // UserInterfaceService.openInitialMenu() will set isSidebarOpen$ and openSidebarPanel$
      UserInterfaceService.openInitialMenu();
      // console.log('Menu.vue: Opening sidebar via UserInterfaceService.openInitialMenu().');
      // No need to set showLocalSidebar here, as it's updated by the subscription to isSidebarOpen$
    },
    /**
     * @method handleCloseSidebarFromChild
     * @description 
     */
    handleCloseSidebarFromChild() {
    },
    /**
     * @method handleServiceAdded
     * @description Forwards the 'service-added' event from Sidebar up to App.vue.
     */
    handleServiceAdded(params) {
      this.$emit('service-added', params);
    },
  },
};
</script>

<style scoped>
/* REMOVED: The empty .menu-container rule is removed to clear the linting warning. */

.menu-icon {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 1001; /* Ensure it's above other UI elements but below loading screen */
  width: 45px;
  height: 45px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(52, 58, 64, 0.7); /* Dark background with transparency */
  border: none;
  border-radius: 5px; /* Slightly rounded corners */
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); /* Soft shadow */
}

.menu-icon.btn {
  padding: 0;
}

.menu-icon .navbar-toggler-icon {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 1%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
  width: 1em;
  height: 1em;
}

/* Hover effect */
.menu-icon:hover {
  background-color: rgba(52, 58, 64, 0.9);
  cursor: pointer;
}
</style>
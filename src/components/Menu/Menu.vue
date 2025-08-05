// menu.vue
<template>
  <div class="menu-container">
    <button @click="openMenu" class="btn btn-dark menu-icon" v-show="!showLocalSidebar">
      <span class="navbar-toggler-icon"></span>
    </button>

    <Sidebar
      v-show="showLocalSidebar"
      @close-sidebar="handleCloseSidebarFromChild"
      />
  </div>
</template>

<script>
import { UserInterfaceService } from '../../controller.js';
import Sidebar from './Sidebar.vue';

export default {
  name: 'Menu',
  components: {
    Sidebar,
  },
  data() {
    return {
      showLocalSidebar: false,
      sidebarGlobalSubscription: null,
    };
  },
  
  emits: [], 

  mounted() {
    this.sidebarGlobalSubscription = UserInterfaceService.isSidebarOpen$.subscribe(isOpen => {
      this.showLocalSidebar = isOpen;
    });
  },
  beforeUnmount() {
    if (this.sidebarGlobalSubscription) {
      this.sidebarGlobalSubscription.unsubscribe();
    }
  },
  methods: {
    openMenu() {
      UserInterfaceService.openInitialMenu();
    },
    handleCloseSidebarFromChild() {
      UserInterfaceService.setSidebarOpen(false); 
    },
  },
};
</script>

<style scoped>
/* ... (Your existing Menu.vue styles) ... */
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
  background-color: rgba(52, 58, 64, 0.7);
  border: none;
  border-radius: 5px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.menu-icon.btn {
  padding: 0;
}

.menu-icon .navbar-toggler-icon {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 30 30'%3e%3cpath stroke='rgba%28255, 255, 255, 1%29' stroke-linecap='round' stroke-miterlimit='10' stroke-width='2' d='M4 7h22M4 15h22M4 23h22'/%3e%3c/svg%3e");
  width: 1em;
  height: 1em;
}

.menu-icon:hover {
  background-color: rgba(52, 58, 64, 0.9);
  cursor: pointer;
}
</style>
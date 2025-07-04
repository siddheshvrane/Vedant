<template>
  <div class="menu-container">
    <button @click="openMenu" class="btn btn-dark menu-icon">
      <span class="navbar-toggler-icon"></span>
    </button>
  </div>
</template>

<script>
import { UserInterfaceService } from '../services/controller.js';

export default {
  name: 'Menu',
  methods: {
    /**
     * @method openMenu
     * @description Triggers the UserInterfaceService to open the initial sidebar menu.
     */
    openMenu() {
      UserInterfaceService.openInitialMenu(); // Call the service method
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
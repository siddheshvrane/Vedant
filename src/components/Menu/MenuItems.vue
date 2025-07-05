<template>
  <li>
    <button @click="closeSidebar" class="btn btn-link text-white sidebar-item poppins-font">
      <i class="fas fa-times me-3"></i>
      <span>Close</span>
    </button>
  </li>
  <li v-for="item in items" :key="item.id">
    <button @click="itemClicked(item)" class="btn btn-link text-white sidebar-item poppins-font">
      <i :class="item.icon" class="me-3"></i>
      <span>{{ item.label }}</span>
    </button>
  </li>
</template>

<script>
import { UserInterfaceService, MenuItemService } from '../../services/controller.js';

export default {
  name: 'MenuItems',
  props: {
    items: {
      type: Array,
      required: true,
      default: () => [],
    },
  },
  // --- ADD THIS 'emits' OPTION ---
  emits: ['menu-item-clicked'], // Declare the custom event using its kebab-case name
  // ---------------------------------
  methods: {
    /**
     * @method itemClicked
     * @description Emits the clicked menu item to the parent component (Sidebar).
     * @param {Object} item - The menu item object that was clicked.
     */
    itemClicked(item) {
      // Notify parent that a menu item was clicked
      this.$emit('menu-item-clicked', item);
    },
    /**
     * @method closeSidebar
     * @description Triggers UserInterfaceService to close the entire sidebar.
     * Corresponds to `closeAll()` in the original `MenuSidebarManager`.
     */
    closeSidebar() {
      UserInterfaceService.closeAll();
    },
  },
};
</script>

<style scoped>
/* These styles are applied to individual menu items and can be reused from the original MenuSidebar.vue */
.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sidebar-item {
  padding: 15px 20px;
  width: 100%;
  display: flex;
  align-items: center;
  font-size: 1.1em;
  text-decoration: none;
  border-radius: 0;
  color: white; /* Ensure text color is white */
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
</style>
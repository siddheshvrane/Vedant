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
import MenuItem from '../../datamodels/MenuItem.js'; // Import the MenuItem class for prop type validation

export default {
  name: 'MenuItems',
  props: {
    items: {
      // Changed type from Array to a custom validator that checks for MenuItem instances
      // or simply keep it as Array, but this demonstrates strictness if desired.
      type: Array, // Still an array, but the contents are now MenuItem instances
      required: true,
      default: () => [],
      // Optional: Add a custom validator for stricter type checking if desired
      validator: (value) => {
        return value.every(item => item instanceof MenuItem);
      }
    },
  },
  emits: ['menu-item-clicked'],
  methods: {
    itemClicked(item) {
      this.$emit('menu-item-clicked', item);
    },
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
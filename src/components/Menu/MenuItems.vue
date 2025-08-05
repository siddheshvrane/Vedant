// MenuItems.vue
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
import { UserInterfaceService } from '../../controller.js';
import MenuItem from '../../datamodels/MenuItem.js';

export default {
  name: 'MenuItems',
  props: {
    items: {
      type: Array,
      required: true,
      default: () => [],
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
  color: white;
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
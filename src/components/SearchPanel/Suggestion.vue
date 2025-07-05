<template>
  <div v-if="isVisible && suggestions.length > 0" class="dropdown-menu-custom shadow-sm show">
    <ul class="list-unstyled">
      <li v-for="result in suggestions" :key="result.properties.id">
        <a href="#" class="dropdown-item-custom" @mousedown.prevent="selectLocation(result)">
          <i class="fas fa-map-marker-alt me-2"></i>
          {{ result.properties.name }}
        </a>
      </li>
    </ul>
  </div>
</template>

<script>
export default {
  name: 'Suggestion',
  props: {
    suggestions: {
      type: Array,
      default: () => [],
    },
    isVisible: {
      type: Boolean,
      default: false,
    },
  },
  methods: {
    /**
     * @method selectLocation
     * @description Emits the selected location feature to the parent component.
     * @param {Object} locationFeature - The selected GeoJSON Feature object.
     * @returns {void}
     */
    selectLocation(locationFeature) {
      this.$emit('select-location', locationFeature);
    },
  },
};
</script>

<style scoped>
/* All styles copied from the original SearchPanel.vue that were specific to the dropdown */
.dropdown-menu-custom {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  width: 100%;
  max-height: 200px;
  overflow-y: auto;
  background-color: rgba(30, 30, 30, 0.65);
  border: 1px solid rgba(0, 0, 0, 0.15);
  border-radius: 0.25rem;
  padding: 0;
  margin-top: 0.125rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.175);
}

.dropdown-menu-custom .list-unstyled {
    margin-bottom: 0;
    padding-bottom: 0;
}

.dropdown-item-custom {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 1rem;
  clear: both;
  font-weight: 400;
  text-align: inherit;
  white-space: nowrap;
  background-color: transparent;
  border: 0;
  text-decoration: none;
  color: white;
}

.dropdown-item-custom:hover,
.dropdown-item-custom:focus {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.1);
}

.dropdown-item-custom i {
    font-size: 0.9em;
    margin-right: 0.5rem;
}
</style>
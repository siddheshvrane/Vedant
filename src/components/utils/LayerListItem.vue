<template>
  <li class="layer-item">
    <button @click="$emit('zoom-to-layer', layer.id)" class="btn btn-sm btn-link text-white zoom-icon">
      <i class="fas fa-search-plus"></i>
    </button>

    <div class="form-check layer-checkbox-wrapper">
      <input
        class="form-check-input layer-checkbox"
        type="checkbox"
        :id="'layerCheck_' + layer.id"
        v-model="internalIsVisible"
        @change="$emit('toggle-visibility', layer.id, internalIsVisible)"
      >
      <label class="form-check-label layer-name" :for="'layerCheck_' + layer.id">
        {{ layer.name }}
      </label>
    </div>

    <button @click="$emit('edit-layer', layer.id)" class="btn btn-sm btn-link text-white edit-icon">
      <i class="fas fa-edit"></i>
    </button>

    <button @click="$emit('remove-layer', layer.id)" class="btn btn-sm btn-link text-danger remove-icon">
      <i class="fas fa-trash-alt"></i>
    </button>
  </li>
</template>

<script>
export default {
  name: 'LayerListItem',
  props: {
    layer: {
      type: Object,
      required: true,
      validator: (value) => {
        return 'id' in value && 'name' in value && 'isVisible' in value;
      },
    },
  },
  emits: ['zoom-to-layer', 'toggle-visibility', 'edit-layer', 'remove-layer'],
  data() {
    return {
      // Use internal data to bind v-model for the checkbox
      // and emit changes back to the parent
      internalIsVisible: this.layer.isVisible,
    };
  },
  watch: {
    // Watch for changes in the prop 'layer.isVisible' from the parent
    // to keep internal state in sync, if the parent modifies it
    'layer.isVisible'(newVal) {
      this.internalIsVisible = newVal;
    },
  },
};
</script>

<style scoped>
/* Styles specific to a single layer item */
.layer-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* Lighter divider for items */
  font-size: 0.95em;
}

.layer-item:last-child {
  border-bottom: none; /* No border for the last item */
}

.layer-checkbox-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  flex-grow: 1;
  margin-left: 10px;
}

.layer-checkbox {
  margin-right: 10px;
  width: 1.2em;
  height: 1.2em;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
}

.layer-checkbox:checked {
  background-color: #007bff;
  border-color: #007bff;
}

.layer-checkbox:focus {
  box-shadow: 0 0 0 0.25rem rgba(0, 123, 255, 0.25);
}

.layer-name {
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  cursor: pointer;
}

/* Icons styling */
.zoom-icon, .edit-icon, .remove-icon {
  width: 30px;
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.zoom-icon {
    color: rgba(255, 255, 255, 0.7);
}
.zoom-icon:hover {
    color: white;
}

.edit-icon {
    color: rgba(0, 123, 255, 0.7);
}
.edit-icon:hover {
    color: #007bff;
}

.remove-icon {
    color: rgba(220, 53, 69, 0.7);
}
.remove-icon:hover {
    color: #dc3545;
}
</style>
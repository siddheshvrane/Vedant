<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <h5 class="sub-sidebar-title">Layer Manager</h5>
      <button @click="goBack" class="btn btn-link text-white close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="sub-sidebar-body">
      <ul class="list-unstyled layer-list">
        <li v-for="layer in layers" :key="layer.id" class="layer-item">
          <button @click="zoomToLayer(layer.id)" class="btn btn-sm btn-link text-white zoom-icon">
            <i class="fas fa-search-plus"></i>
          </button>

          <div class="form-check layer-checkbox-wrapper">
            <input
              class="form-check-input layer-checkbox"
              type="checkbox"
              :id="'layerCheck_' + layer.id"
              v-model="layer.isVisible"
              @change="toggleLayerVisibility(layer.id)"
            >
            <label class="form-check-label layer-name" :for="'layerCheck_' + layer.id">
              {{ layer.name }}
            </label>
          </div>

          <button @click="editLayer(layer.id)" class="btn btn-sm btn-link text-white edit-icon">
            <i class="fas fa-edit"></i>
          </button>

          <button @click="removeLayer(layer.id)" class="btn btn-sm btn-link text-danger remove-icon">
            <i class="fas fa-trash-alt"></i> </button>
        </li>
        <li v-if="layers.length === 0" class="text-center text-muted mt-3">
          No layers added yet.
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  name: 'LayerManagerSidebar',

  data() {
    return {
      layers: [
        // Dummy data for demonstration. In a real app, this would come from a store or props.
        { id: 'layer1', name: 'Satellite Imagery', isVisible: true },
        { id: 'layer2', name: '3D Model', isVisible: false },
        { id: 'layer3', name: 'Elevation Data', isVisible: true },
        { id: 'layer4', name: 'Road Networks', isVisible: false },
        { id: 'layer5', name: 'Land Use Zones', isVisible: true },
      ],
    };
  },

  methods: {
    goBack() {
      // Emits an event to the parent (MenuSidebar) to close this sub-menu
      this.$emit('close-sub-menu');
    },
    zoomToLayer(layerId) {
      console.log(`Zooming to layer: ${layerId}`);
      // Implement actual map zoom logic here
      alert(`Action: Zoom to ${this.layers.find(l => l.id === layerId).name}`);
    },
    toggleLayerVisibility(layerId) {
      const layer = this.layers.find(l => l.id === layerId);
      if (layer) {
        console.log(`Toggling visibility for layer ${layerId}: ${layer.isVisible}`);
        // Implement actual layer visibility toggle on map here
        alert(`Action: Toggle visibility for ${layer.name} to ${layer.isVisible ? 'ON' : 'OFF'}`);
      }
    },
    editLayer(layerId) {
      console.log(`Editing layer: ${layerId}`);
      // Implement actual layer editing interface/logic here
      alert(`Action: Edit ${this.layers.find(l => l.id === layerId).name}`);
    },
    removeLayer(layerId) {
      if (confirm(`Are you sure you want to remove layer: ${this.layers.find(l => l.id === layerId).name}?`)) {
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        console.log(`Layer removed: ${layerId}`);
        // Implement actual layer removal from map/data store here
        alert('Layer Removed!');
      }
    },
  },
};
</script>

<style scoped>
/* Inherit common sub-sidebar panel styles from AddDataSidebar */
.sub-sidebar-panel {
  width: 350px; /* Consistent width for this sidebar */
  height: 100%;
  display: flex;
  flex-direction: column;

  flex-shrink: 0;
}

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sub-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

}

.sub-sidebar-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
  margin-left: 30px;
}

.close-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sub-sidebar-body {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  color: white; /* Default text color for body content */
}

/* Layer List Specific Styles */
.layer-list {
  padding: 0;
  margin: 0;
}

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
  margin-bottom: 0; /* Override Bootstrap's default margin */
  flex-grow: 1; /* Allow checkbox and name to take available space */
  margin-left: 10px; /* Space between zoom icon and checkbox */
}

.layer-checkbox {
  margin-right: 10px; /* Space between checkbox and label */
  /* Customizing checkbox appearance */
  width: 1.2em;
  height: 1.2em;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
}

.layer-checkbox:checked {
  background-color: #007bff; /* Bootstrap primary blue */
  border-color: #007bff;
}

.layer-checkbox:focus {
  box-shadow: 0 0 0 0.25rem rgba(0, 123, 255, 0.25); /* Focus outline for accessibility */
}

.layer-name {
  color: white;
  white-space: nowrap; /* Prevent layer names from wrapping */
  overflow: hidden;    /* Hide overflow text */
  text-overflow: ellipsis; /* Add ellipsis for clipped text */
  flex-grow: 1; /* Allow layer name to take most of the space */
  cursor: pointer; /* Indicates it's interactive, maybe for details */
}

/* Icons styling */
.zoom-icon, .edit-icon, .remove-icon {
  width: 30px; /* Fixed width for icons to align them */
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0; /* Prevent icons from shrinking */
}

.zoom-icon {
    color: rgba(255, 255, 255, 0.7);
}
.zoom-icon:hover {
    color: white;
}

.edit-icon {
    color: rgba(0, 123, 255, 0.7); /* Bootstrap blue for edit */
}
.edit-icon:hover {
    color: #007bff;
}

.remove-icon {
    color: rgba(220, 53, 69, 0.7); /* Bootstrap red for danger */
}
.remove-icon:hover {
    color: #dc3545;
}
</style>
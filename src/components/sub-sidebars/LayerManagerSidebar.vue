<template>
  <BaseSubSidebar title="Layer Manager">
    <ul class="list-unstyled layer-list">
      <LayerListItem
        v-for="layer in layers"
        :key="layer.id"
        :layer="layer"
        @zoom-to-layer="zoomToLayer"
        @toggle-visibility="toggleLayerVisibility"
        @edit-layer="editLayer"
        @remove-layer="removeLayer"
      />
      <li v-if="layers.length === 0" class="text-center text-muted mt-3">
        No layers added yet.
      </li>
    </ul>
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../utils/BaseSubSidebar.vue'; // Adjust path if BaseSubSidebar is elsewhere
import LayerListItem from '../utils/LayerListItem.vue'; // Adjust path based on where you put LayerListItem.vue

export default {
  name: 'LayerManagerSidebar',
  components: {
    BaseSubSidebar,
    LayerListItem,
  },
  data() {
    return {
      layers: [
        { id: 'layer1', name: 'Satellite Imagery', isVisible: true },
        { id: 'layer2', name: '3D Model', isVisible: false },
        { id: 'layer3', name: 'Elevation Data', isVisible: true },
        { id: 'layer4', name: 'Road Networks', isVisible: false },
        { id: 'layer5', name: 'Land Use Zones', isVisible: true },
      ],
    };
  },
  methods: {
    // This component itself is a sub-sidebar, so it uses the 'close-sub-menu' event.
    // The previous 'goBack' method implicitly served this role, so I'll keep the name
    // consistent with BaseSubSidebar's title bar, which might directly call this.
    // However, if the close button on BaseSubSidebar directly emits 'close-sub-menu',
    // then this goBack method might be redundant if not called elsewhere.
    // For now, I'm adapting it to use the event name 'close-sub-menu'
    // that BaseSubSidebar is designed to emit.
    goBack() { // Renamed from 'goBack' to directly handle 'close-sub-menu' event.
        this.$emit('close-sub-menu');
    },
    // The methods below are called by LayerListItem events
    zoomToLayer(layerId) {
      console.log(`Zooming to layer: ${layerId}`);
      alert(`Action: Zoom to ${this.layers.find(l => l.id === layerId).name}`);
      // Implement actual map zoom logic here, potentially interacting with CesiumMapManager
    },
    toggleLayerVisibility(layerId, isVisible) {
      const layer = this.layers.find(l => l.id === layerId);
      if (layer) {
        layer.isVisible = isVisible; // Update internal state
        console.log(`Toggling visibility for layer ${layerId}: ${layer.isVisible}`);
        alert(`Action: Toggle visibility for ${layer.name} to ${layer.isVisible ? 'ON' : 'OFF'}`);
        // Implement actual layer visibility toggle on map here
      }
    },
    editLayer(layerId) {
      console.log(`Editing layer: ${layerId}`);
      alert(`Action: Edit ${this.layers.find(l => l.id === layerId).name}`);
      // Implement actual layer editing interface/logic here
    },
    removeLayer(layerId) {
      const layerName = this.layers.find(l => l.id === layerId)?.name || 'unknown layer';
      if (confirm(`Are you sure you want to remove layer: ${layerName}?`)) {
        this.layers = this.layers.filter(layer => layer.id !== layerId);
        console.log(`Layer removed: ${layerId}`);
        alert('Layer Removed!');
        // Implement actual layer removal from map/data store here
      }
    },
  },
  created() {
    // If LayerManagerSidebar is directly inserted into a parent that expects a 'close-sub-menu' event
    // from its child, ensure this component emits it.
    // The BaseSubSidebar handles its own 'close-btn' click by emitting 'close-sub-menu'.
    // So, this component doesn't need to specifically emit it, unless it has its own close button.
    // The original template *does* have a close button calling 'goBack',
    // which I've now made emit 'close-sub-menu'.
  }
};
</script>

<style scoped>
/* Only styles for the LayerManagerSidebar container or general list applies here.
   Individual layer item styles are now in LayerListItem.vue */

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
  color: white;
}

/* Layer List Specific Styles */
.layer-list {
  padding: 0;
  margin: 0;
}
</style>
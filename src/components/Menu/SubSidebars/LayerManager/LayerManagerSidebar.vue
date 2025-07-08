<template>
  <BaseSubSidebar title="Layer Manager">
    <ul class="list-unstyled layer-list">
      <LayerListItem
        v-for="(layer, index) in layers"
        :key="layer.id"
        :layer="layer"
        :is-first="index === 0"
        :is-last="index === layers.length - 1"
        @zoom-to-layer="zoomToLayer"
        @toggle-visibility="toggleLayerVisibility"
        @edit-layer="editLayer"
        @remove-layer="removeLayer"
        @move-layer="moveLayer"
      />
      <li v-if="layers.length === 0" class="text-center text-muted mt-3">
        No layers added yet.
      </li>
    </ul>
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../SubSidebar.vue'; // Adjust path if BaseSubSidebar is elsewhere
import LayerListItem from './LayerListItem.vue'; // Adjust path based on where you put LayerListItem.vue

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
    goBack() {
        this.$emit('close-sub-menu');
    },
    zoomToLayer(layerId) {
      console.log(`Zooming to layer: ${layerId}`);
    },
    toggleLayerVisibility(layerId, isVisible) {
      const layer = this.layers.find(l => l.id === layerId);
      if (layer) {
        layer.isVisible = isVisible;
        console.log(`Toggling visibility for layer ${layerId}: ${layer.isVisible}`);
      }
    },
    editLayer(layerId) {
      console.log(`Editing layer: ${layerId}`);
    },
    removeLayer(layerId) {
      const layerName = this.layers.find(l => l.id === layerId)?.name || 'unknown layer';
      // Temporarily removed confirm() to diagnose focus issues.
      // Layers will now be removed without a confirmation dialog.
      this.layers = this.layers.filter(layer => layer.id !== layerId);
      console.log(`Layer removed (no confirmation dialog used for testing): ${layerId}`);
    },
    moveLayer(layerId, direction) {
      const index = this.layers.findIndex(l => l.id === layerId);
      if (index === -1) return;

      let newIndex = index;
      if (direction === 'up') {
        newIndex = Math.max(0, index - 1);
      } else if (direction === 'down') {
        newIndex = Math.min(this.layers.length - 1, index + 1);
      }

      if (newIndex !== index) {
        const [movedLayer] = this.layers.splice(index, 1);
        this.layers.splice(newIndex, 0, movedLayer);
        console.log(`Layer ${layerId} moved from ${index} to ${newIndex}`);
      }
    },
  },
  created() {
  }
};
</script>

<style scoped>
/* Only styles for the LayerManagerSidebar container or general list applies here.
   Individual layer item styles are now in LayerListItem.vue */

.sub-sidebar-panel {
  /* Removed fixed width to allow dynamic sizing */
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
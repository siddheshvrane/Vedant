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
import { LayerService } from '../../../../controller.js'; // Import the new LayerService

export default {
  name: 'LayerManagerSidebar',
  components: {
    BaseSubSidebar,
    LayerListItem,
  },
  data() {
    return {
      layers: [], // Layers will now be populated from LayerService
      layerServiceSubscription: null, // To manage the RxJS subscription
    };
  },
  methods: {
    goBack() {
        this.$emit('close-sub-menu');
    },
    zoomToLayer(layerId) {
      LayerService.zoomToLayer(layerId);
    },
    toggleLayerVisibility(layerId, isVisible) {
      LayerService.toggleLayerVisibility(layerId, isVisible);
    },
    editLayer(layerId) {
      LayerService.editLayer(layerId);
    },
    removeLayer(layerId) {
      LayerService.removeLayer(layerId);
    },
    moveLayer(layerId, direction) {
      LayerService.moveLayer(layerId, direction);
    },
  },
  created() {
    // Subscribe to the layers$ BehaviorSubject from LayerService
    this.layerServiceSubscription = LayerService.layers$.subscribe(updatedLayers => {
      this.layers = updatedLayers;
    });
  },
  beforeUnmount() {
    // Unsubscribe to prevent memory leaks when the component is destroyed
    if (this.layerServiceSubscription) {
      this.layerServiceSubscription.unsubscribe();
    }
  },
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
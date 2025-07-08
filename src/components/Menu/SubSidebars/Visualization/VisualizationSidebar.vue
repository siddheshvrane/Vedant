<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <button @click="$emit('back-to-main-menu')" class="btn btn-link text-white back-btn">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h5 class="sub-sidebar-title">Visualization Mode</h5>
      <button @click="$emit('close-all-sidebars')" class="btn btn-link text-white close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="sub-sidebar-body">
      <hr class="sidebar-divider mb-4">

      <div class="form-group mb-3">
        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            id="radio2DMode"
            value="2D"
            v-model="selectedMode"
            @change="emitModeChange"
          >
          <label class="form-check-label" for="radio2DMode">2D Mode</label>
        </div>
        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            id="radio3DGlobe"
            value="3D"
            v-model="selectedMode"
            @change="emitModeChange"
          >
          <label class="form-check-label" for="radio3DGlobe">2.5D (3D Globe)</label>
        </div>
        <div class="form-check">
          <input
            class="form-check-input"
            type="radio"
            id="radioAnaglyph"
            value="Anaglyph"
            v-model="selectedMode"
            @change="emitModeChange"
            disabled
          >
          <label class="form-check-label" for="radioAnaglyph">Anaglyph 3D (Not yet implemented)</label>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// Corrected import path: Go up three directories to 'src', then into 'services'
import { MapService } from '../../../../services/controller.js';

export default {
  name: 'VisualizationSidebar',
  data() {
    return {
      selectedMode: '3D', 
      modeSubscription: null,
    };
  },
  emits: ['close-all-sidebars', 'back-to-main-menu', 'update-visualization-mode'],
  
  mounted() {
    this.modeSubscription = MapService.visualizationModeChanged$.subscribe(mode => {
      if (this.selectedMode !== mode) {
        this.selectedMode = mode;
      }
    });

    MapService.setVisualizationMode(this.selectedMode);
  },

  beforeUnmount() {
    if (this.modeSubscription) {
      this.modeSubscription.unsubscribe();
    }
  },

  methods: {
    emitModeChange() {
      MapService.setVisualizationMode(this.selectedMode);
      this.$emit('update-visualization-mode', this.selectedMode); 
    },
  }
};
</script>

<style scoped>
/* Your existing styles remain unchanged */
.sub-sidebar-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sub-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 30, 30, 0);
}

.sub-sidebar-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
}

.back-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
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

.form-check-label {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 5px;
}

.form-check-input {
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
}

.form-check-input:checked {
    background-color: #007bff;
    border-color: #007bff;
}

.sidebar-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
</style>
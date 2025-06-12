<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <h5 class="sub-sidebar-title">Visualization Mode</h5>
      <button @click="goBack" class="btn btn-link text-white close-btn">
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
export default {
  name: 'VisualizationSidebar',
  data() {
    return {
      selectedMode: '3D', // Default to 3D Globe
    };
  },
  mounted() {
    // Emit the initial mode when the component is mounted
    this.emitModeChange();
  },
  methods: {
    goBack() {
      // Emits an event to the parent component to close this sidebar
      this.$emit('close-sub-menu');
    },
    emitModeChange() {
      // Emits the currently selected visualization mode to the parent component
      this.$emit('update-visualization-mode', this.selectedMode);
    }
  }
};
</script>

<style scoped>
/* Reusing styles from AddDataSidebar for consistency */
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
  justify-content: flex-end;
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

.sub-sidebar-body label {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 5px;
}

/* Custom styles for radio buttons */
.form-check-input {
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
}

.form-check-input:checked {
    background-color: #007bff;
    border-color: #007bff;
}

.form-check-label {
    color: rgba(255, 255, 255, 0.9);
}

.sidebar-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
</style>

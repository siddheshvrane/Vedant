<template>
  <div>
    <div class="marker-sequence-content popup-content">
      <!-- Marker List Section -->
      <div class="form-group">
        <label class="form-label">📍 Waypoint Sequence ({{ markers.length }} markers)</label>
        <div class="marker-list">
          <div
            v-for="(marker, index) in sortedMarkers"
            :key="marker.id"
            class="marker-item"
            :class="{ 'marker-selected': selectedMarkerId === marker.id }"
          >
            <div class="marker-info">
              <div class="marker-header">
                <span class="marker-number">{{ index + 1 }}</span>
                <span class="marker-title">Marker {{ marker.id }}</span>
                <div class="marker-actions">
                  <button 
                    @click="previewMarker(marker.id)"
                    class="btn-mini btn-preview"
                    title="Preview camera position"
                  >
                    👁️
                  </button>
                  <button 
                    @click="moveMarkerUp(index)"
                    :disabled="index === 0"
                    class="btn-mini btn-move"
                    title="Move up in sequence"
                  >
                    ⬆️
                  </button>
                  <button 
                    @click="moveMarkerDown(index)"
                    :disabled="index === sortedMarkers.length - 1"
                    class="btn-mini btn-move"
                    title="Move down in sequence"
                  >
                    ⬇️
                  </button>
                </div>
              </div>
              <div class="marker-coordinates">
                {{ marker.coordinates.latitude.toFixed(4) }}°, 
                {{ marker.coordinates.longitude.toFixed(4) }}°, 
                {{ marker.coordinates.elevation.toFixed(1) }}m
              </div>
              <div class="marker-wait-time">
                <label class="wait-label">Wait time:</label>
                <input
                  type="number"
                  v-model.number="marker.waitTime"
                  min="0"
                  max="60"
                  step="0.5"
                  class="wait-input"
                  @input="updateTotalDuration"
                />
                <span class="wait-unit">seconds</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Options -->
      <div class="form-group">
        <label class="form-label">⚙️ Flythrough Settings</label>
        <div class="settings-grid">
          <div class="setting-item">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="enableSmoothing"
                class="form-checkbox"
              />
              Enable smooth camera transitions
            </label>
          </div>
          <div class="setting-item">
            <label class="setting-label">Preview duration:</label>
            <input
              type="number"
              v-model.number="previewDuration"
              min="0.5"
              max="10"
              step="0.5"
              class="setting-input"
            />
            <span class="setting-unit">seconds</span>
          </div>
        </div>
      </div>

      <!-- Summary Information -->
      <div class="form-group">
        <div class="summary-info">
          <div class="summary-item">
            <span class="summary-label">Total waypoints:</span>
            <span class="summary-value">{{ markers.length }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Estimated duration:</span>
            <span class="summary-value">{{ calculatedDuration.toFixed(1) }}s</span>
          </div>
        </div>
      </div>
    </div>

    <div class="popup-actions">
      <button @click="handleStartFlythrough" class="btn btn-primary action-btn">
        🚀 Start Flythrough
      </button>
      <button @click="handleCancel" class="btn btn-secondary action-btn">
        Cancel
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "MarkerSequencePopup",
  props: {
    // Marker data and configuration
    markers: {
      type: Array,
      required: true,
      default: () => []
    },
    totalDuration: {
      type: Number,
      default: 0
    },
    enableSmoothing: {
      type: Boolean,
      default: true
    },
    previewDuration: {
      type: Number,
      default: 2.0
    },
    // Callbacks from PopupService
    onStart: {
      type: Function,
      required: true,
    },
    onPreview: {
      type: Function,
      required: true,
    },
    onCancel: {
      type: Function,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      localMarkers: [],
      selectedMarkerId: null,
      enableSmoothing: this.enableSmoothing,
      previewDuration: this.previewDuration,
    };
  },
  computed: {
    sortedMarkers() {
      return [...this.localMarkers].sort((a, b) => a.order - b.order);
    },
    calculatedDuration() {
      return this.localMarkers.reduce((sum, marker) => sum + (marker.waitTime || 0), 0);
    }
  },
  methods: {
    initializeMarkers() {
      // Deep copy markers to allow local modifications
      this.localMarkers = this.markers.map(marker => ({
        ...marker,
        waitTime: marker.waitTime || 3.0,
        order: marker.order || marker.id
      }));
    },
    
    previewMarker(markerId) {
      console.log("MarkerSequencePopup: Preview marker:", markerId);
      this.selectedMarkerId = markerId;
      this.onPreview(markerId);
    },
    
    moveMarkerUp(index) {
      if (index > 0) {
        const sorted = this.sortedMarkers;
        const temp = sorted[index].order;
        sorted[index].order = sorted[index - 1].order;
        sorted[index - 1].order = temp;
        this.$forceUpdate(); // Force reactivity update
      }
    },
    
    moveMarkerDown(index) {
      if (index < this.sortedMarkers.length - 1) {
        const sorted = this.sortedMarkers;
        const temp = sorted[index].order;
        sorted[index].order = sorted[index + 1].order;
        sorted[index + 1].order = temp;
        this.$forceUpdate(); // Force reactivity update
      }
    },
    
    updateTotalDuration() {
      // Reactively update duration when wait times change
      this.$forceUpdate();
    },
    
    handleStartFlythrough() {
      console.log("MarkerSequencePopup: Starting flythrough with configuration");
      
      const configuredData = {
        markers: this.localMarkers.map(marker => ({
          id: marker.id,
          order: marker.order,
          waitTime: marker.waitTime,
          coordinates: marker.coordinates
        })),
        enableSmoothing: this.enableSmoothing,
        previewDuration: this.previewDuration,
        totalDuration: this.calculatedDuration
      };
      
      this.onStart(configuredData);
      this.onClose();
    },
    
    handleCancel() {
      console.log("MarkerSequencePopup: Cancelled by user");
      this.onCancel();
      this.onClose();
    },
  },
  mounted() {
    this.initializeMarkers();
    console.log("MarkerSequencePopup: Mounted with", this.markers.length, "markers");
  }
};
</script>

<style scoped>
.marker-sequence-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 10px 0;
  max-height: 60vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 15px;
}

.form-label {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  margin-bottom: 8px;
  font-weight: 500;
  display: block;
}

/* Marker List Styles */
.marker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
}

.marker-item {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 10px;
  background: rgba(45, 45, 45, 0.6);
  transition: all 0.2s ease;
}

.marker-item:hover {
  background: rgba(55, 55, 55, 0.8);
  border-color: rgba(255, 255, 255, 0.3);
}

.marker-selected {
  border-color: #007bff !important;
  background: rgba(0, 123, 255, 0.1) !important;
}

.marker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.marker-number {
  background: #007bff;
  color: white;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  font-weight: bold;
}

.marker-title {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex-grow: 1;
  margin-left: 10px;
}

.marker-actions {
  display: flex;
  gap: 4px;
}

.btn-mini {
  padding: 4px 6px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8em;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.1);
}

.btn-mini:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.btn-mini:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-preview {
  background: rgba(0, 123, 255, 0.3);
}

.btn-move {
  background: rgba(108, 117, 125, 0.3);
}

.marker-coordinates {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
  font-family: monospace;
  margin-bottom: 8px;
}

.marker-wait-time {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wait-label {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.8);
}

.wait-input {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 0.8em;
}

.wait-unit {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.6);
}

/* Settings Styles */
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.form-checkbox {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background-color: rgba(0, 0, 0, 0.3);
  cursor: pointer;
}

.form-checkbox:checked {
  background-color: #007bff;
  border-color: #007bff;
}

.setting-label {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.8);
  min-width: 100px;
}

.setting-input {
  width: 60px;
  padding: 4px 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 0.8em;
}

.setting-unit {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.6);
}

/* Summary Styles */
.summary-info {
  display: flex;
  justify-content: space-between;
  padding: 10px;
  background: rgba(0, 123, 255, 0.1);
  border: 1px solid rgba(0, 123, 255, 0.3);
  border-radius: 6px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.summary-label {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
}

.summary-value {
  font-size: 1.1em;
  font-weight: bold;
  color: #007bff;
}

/* Action Button Styles */
.popup-actions {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  gap: 15px;
}

.action-btn {
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 120px;
  border: none;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 123, 255, 0.3);
}

.btn-secondary {
  background-color: rgba(45, 45, 45, 0.8);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background-color: rgba(60, 60, 60, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* Scrollbar Styles */
.marker-list::-webkit-scrollbar,
.marker-sequence-content::-webkit-scrollbar {
  width: 6px;
}

.marker-list::-webkit-scrollbar-track,
.marker-sequence-content::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.marker-list::-webkit-scrollbar-thumb,
.marker-sequence-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
}

.marker-list::-webkit-scrollbar-thumb:hover,
.marker-sequence-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.5);
}
</style>
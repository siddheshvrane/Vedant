<template>
  <div>
    <div class="marker-sequence-content popup-content">
      <div class="form-group">
        <label class="form-label">
          <i class="fas fa-map-marker-alt me-2"></i>Waypoint Sequence ({{ markers.length }} markers)
        </label>
        <div class="marker-list">
          <li
            v-for="(marker, index) in sortedMarkers"
            :key="marker.id"
            class="layer-item marker-item"
            :class="{ 'marker-selected': selectedMarkerId === marker.id }"
          >
            <div class="marker-info">
              <div class="marker-header">
                <span class="marker-number">{{ index + 1 }}</span>
                <span class="marker-title">Marker {{ marker.id }}</span>
                <div class="layer-actions-group marker-actions">
                  <button
                    @click="moveMarkerUp(index)"
                    :disabled="index === 0"
                    class="btn btn-sm btn-link move-up-icon"
                    title="Move up in sequence"
                  >
                    <i class="fas fa-arrow-up"></i>
                  </button>
                  <button
                    @click="moveMarkerDown(index)"
                    :disabled="index === sortedMarkers.length - 1"
                    class="btn btn-sm btn-link move-down-icon"
                    title="Move down in sequence"
                  >
                    <i class="fas fa-arrow-down"></i>
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
          </li>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">
          <i class="fas fa-cogs me-2"></i>Flythrough Settings
        </label>
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
        <i class="fas fa-play me-2"></i>Start Flythrough
      </button>
      <button @click="handleCancel" class="btn btn-secondary action-btn">
        <i class="fas fa-times me-2"></i>Cancel
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
      // Ensure that 'order' property exists for consistent sorting
      return [...this.localMarkers].sort((a, b) => a.order - b.order);
    },
    calculatedDuration() {
      return this.localMarkers.reduce((sum, marker) => sum + (marker.waitTime || 0), 0);
    }
  },
  methods: {
    initializeMarkers() {
      // Deep copy markers to allow local modifications and ensure 'waitTime' and 'order'
      this.localMarkers = this.markers.map(marker => ({
        ...marker,
        waitTime: marker.waitTime !== undefined ? marker.waitTime : 3.0, // Use existing waitTime or default
        order: marker.order !== undefined ? marker.order : marker.id // Use existing order or default to ID
      }));
    },

    previewMarker(markerId) {
      console.log("MarkerSequencePopup: Preview marker:", markerId);
      this.selectedMarkerId = markerId;
      this.onPreview(markerId);
    },

    moveMarkerUp(index) {
      if (index > 0) {
        const currentMarker = this.sortedMarkers[index];
        const prevMarker = this.sortedMarkers[index - 1];

        // Swap the 'order' property
        const tempOrder = currentMarker.order;
        currentMarker.order = prevMarker.order;
        prevMarker.order = tempOrder;

        // Force re-sort the localMarkers array based on the updated 'order'
        this.localMarkers.sort((a, b) => a.order - b.order);
        this.$forceUpdate(); // Force reactivity update
      }
    },

    moveMarkerDown(index) {
      if (index < this.sortedMarkers.length - 1) {
        const currentMarker = this.sortedMarkers[index];
        const nextMarker = this.sortedMarkers[index + 1];

        // Swap the 'order' property
        const tempOrder = currentMarker.order;
        currentMarker.order = nextMarker.order;
        nextMarker.order = tempOrder;

        // Force re-sort the localMarkers array based on the updated 'order'
        this.localMarkers.sort((a, b) => a.order - b.order);
        this.$forceUpdate(); // Force reactivity update
      }
    },

    updateTotalDuration() {
      // Reactively update duration when wait times change
      // No explicit $forceUpdate needed here if `calculatedDuration` is a computed property
      // that depends on `localMarkers` which is already reactive.
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
/* Inherit base layer-item style for marker list items */
.layer-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* Lighter divider for items */
  font-size: 0.95em;
  background: none; /* Override existing marker-item background */
  border: none; /* Override existing marker-item border */
  border-radius: 0; /* Remove existing marker-item border-radius */
  padding: 0; /* Remove default padding as it's set by layer-item padding */
  transition: none; /* Remove transition as it's defined by layer-item */
}

/* Specific adjustments for .marker-item */
.marker-item {
  padding: 10px; /* Re-add padding that was removed by .layer-item's override */
  border: 1px solid rgba(255, 255, 255, 0.1); /* Keep a subtle border for individual items */
  border-radius: 6px;
  background: rgba(45, 45, 45, 0.6);
  transition: all 0.2s ease;
}

.marker-item:last-child {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1); /* Ensure last item still has a border */
}

.marker-item:hover {
  background: rgba(55, 55, 55, 0.8);
  border-color: rgba(255, 255, 255, 0.3);
}

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
  display: flex; /* Added flex to align icon and text */
  align-items: center; /* Vertically center icon and text */
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
  flex-shrink: 0; /* Prevent it from shrinking */
}

.marker-title {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  flex-grow: 1;
  margin-left: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Inherit general action button styles from LayerListItem */
.layer-actions-group {
  display: flex;
  align-items: center;
  margin-left: auto; /* Pushes the group to the right */
  gap: 5px; /* Spacing between buttons */
}

.btn-link {
  background: none;
  border: none;
  padding: 5px 8px; /* Consistent padding for clickable area */
  cursor: pointer;
  transition: transform 0.1s ease, color 0.2s ease; /* Smooth transitions for hover effects */
  display: flex; /* Use flex to center icon within the button */
  align-items: center;
  justify-content: center;
  font-size: 1.2em; /* Consistent icon size */
  text-decoration: none; /* Removes underline */
  color: rgba(255, 255, 255, 0.7);
}

.btn-link:hover {
  transform: scale(1.1); /* Subtle grow effect on hover */
  text-decoration: none; /* Removes underline on hover */
  color: white;
}

/* Specific icon styles for MarkerSequenceForm */
.preview-icon {
  color: rgba(0, 123, 255, 0.7); /* Similar to edit-icon in LayerListItem */
}
.preview-icon:hover {
  color: #007bff;
}

.move-up-icon, .move-down-icon {
    color: rgb(255, 255, 255); /* White, similar to LayerListItem */
}
.move-up-icon:hover:not(:disabled), .move-down-icon:hover:not(:disabled) {
    color: #dbdbdb; /* Lighter white/gray on hover */
}
.move-up-icon:disabled, .move-down-icon:disabled {
    opacity: 1; /* Match LayerListItem disabled opacity */
    cursor: not-allowed;
    color: rgba(255, 255, 255, 0.3); /* Dimmed color for disabled arrow */
}


.marker-coordinates {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
  font-family: monospace;
  margin-left: calc(24px + 10px); /* Align with marker title: marker-number width + margin-left */
  margin-bottom: 8px;
}

.marker-wait-time {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: calc(24px + 10px); /* Align with marker title */
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
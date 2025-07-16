<template>
  <div class="measurement-history poppins-font mt-3">
    <h5 class="history-title">Measurement History</h5>
    <ul class="list-unstyled history-list">
      <li v-if="measurements.length === 0" class="text-center text-muted no-measurements">
        No measurements yet.
      </li>
      <li
        v-for="measurement in measurements"
        :key="measurement.id"
        class="history-item d-flex align-items-center p-2 mb-2 rounded"
      >
        <div class="measurement-info d-flex flex-column flex-grow-1 me-2">
          <span class="tool-operation-title">
            {{ measurement.toolName }} #{{ measurement.operationNumber }}
          </span>
          <span class="measurement-value mt-1">{{ measurement.value }}</span>
        </div>
        <div class="measurement-actions d-flex align-items-center">
          <button
            @click="toggleEnabled(measurement.id)"
            class="btn btn-sm action-btn me-2"
            :title="measurement.isEnabled ? 'Hide on Globe' : 'Show on Globe'"
          >
            <i :class="measurement.isEnabled ? 'fas fa-eye' : 'fas fa-eye-slash'"
               :style="{ color: measurement.isEnabled ? 'white' : 'white' }"
            ></i>
          </button>

          <button
            @click="deleteMeasurement(measurement.id)"
            class="btn btn-sm action-btn delete-btn"
            title="Delete Measurement"
          >
            <i class="fas fa-trash" style="color: #FF6600;"></i>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import { ToolManagementService } from '../../../../services/ToolManagementService'; // Adjust path based on your project structure

export default {
  name: 'MeasurementHistory',
  data() {
    return {
      measurements: [],
      historySubscription: null,
    };
  },
  mounted() {
    // Subscribe to measurement history changes from ToolManagementService
    this.historySubscription = ToolManagementService.measurementHistory$.subscribe(history => {
      this.measurements = history;
    });
  },
  beforeUnmount() {
    // Unsubscribe to prevent memory leaks when component is destroyed
    if (this.historySubscription) {
      this.historySubscription.unsubscribe();
    }
  },
  methods: {
    /**
     * Toggles the visibility (enabled/disabled state) of a specific measurement on the globe.
     * @param {string} id - The unique ID of the measurement to toggle.
     */
    toggleEnabled(id) {
      ToolManagementService.toggleMeasurementEnabled(id);
    },
    /**
     * Deletes a measurement completely from the history and the globe.
     * A confirmation dialog is shown before deletion.
     * @param {string} id - The unique ID of the measurement to delete.
     */
    deleteMeasurement(id) {
      // Use a more modern confirmation approach or a custom modal for better UX
      if (confirm('Are you sure you want to delete this measurement? This action cannot be undone.')) {
        ToolManagementService.removeMeasurement(id);
      }
    },
  },
};
</script>

<style scoped>
/* Ensure Poppins font is available globally or imported here if needed */
/* @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'); */

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.measurement-history {
  /* Mimic SceneInfo.vue container styles */
  background-color: transparent; /* Make background transparent */
  color: white;
  padding: 0; /* Remove padding */
  border-radius: 10px;
  box-shadow: none; /* Remove box shadow */
  backdrop-filter: none; /* Remove backdrop filter */
  -webkit-backdrop-filter: none; /* Remove webkit backdrop filter */
  /* Allow height to be determined by content or parent */
  height: 100%; /* Important: Make it take full height of its parent */
  display: flex;
  flex-direction: column; /* Arrange children in a column */
}

.history-title {
  /* Mimic SceneInfo.vue .info-title */
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff; /* Primary accent color for consistency */
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
  text-align: left; /* Align left like SceneInfo */
}

.history-list {
  /* Remove max-height to allow it to grow */
  /* max-height: 250px; */
  overflow-y: auto;
  padding-right: 5px; /* For scrollbar space */
  flex-grow: 1; /* Allow the list to take up available vertical space */
}

/* Custom scrollbar for better aesthetics */
.history-list::-webkit-scrollbar {
  width: 8px;
}

.history-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05); /* Lighter track */
  border-radius: 4px;
}

.history-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 123, 255, 0.5); /* Semi-transparent blue thumb */
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 123, 255, 0.7);
}


.no-measurements {
  padding: 10px;
  font-style: italic;
  color: rgba(255, 255, 255, 0.6); /* Softer color for no items text */
  font-size: 0.9em;
}

.history-item {
  /* Mimic SceneInfo.vue .info-item, but for a list item */
  background-color: rgba(45, 45, 45, 0.8); /* Slightly lighter background than container */
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px; /* Slightly less rounded than container for nested feel */
  transition: all 0.2s ease-in-out; /* Smooth transitions for hover and disable */
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15); /* Subtle shadow for items */
  min-height: 60px; /* Ensure consistent height for items */
}

.history-item:hover {
  background-color: rgba(60, 60, 60, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px); /* Slight lift on hover */
}

/* Removed item-disabled class styling for the whole li */
/* The visual "disabled" state will now only be handled by the icon */

.measurement-info {
  flex-grow: 1; /* Allows info to take available space */
  justify-content: center; /* Vertically center content */
}

.tool-operation-title {
  font-weight: 500; /* Consistent with info-label */
  color: rgba(255, 255, 255, 0.9); /* Brighter for main title */
  font-size: 0.95em; /* Slightly larger for main title */
}

.measurement-value {
  color: rgba(255, 255, 255, 0.7); /* Slightly subdued for value */
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px; /* Small separation from title */
}

.action-btn {
  background: none;
  border: none;
  /* Removed default color here, as it's now set inline for icons */
  font-size: 1.2em; /* Slightly larger icons */
  padding: 5px 8px; /* More generous padding for clickable area */
  cursor: pointer;
  transition: transform 0.1s ease; /* Only transform, color handled by inline style */
  display: flex; /* Use flex to center icon if needed */
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  /* color: #007bff; /* Brighter accent on hover */
  transform: scale(1.1); /* Subtle grow effect */
}

/* Specific hover effects for icons will be needed if you want color change on hover */
.action-btn i {
    transition: color 0.2s ease; /* Smooth color transition for icons */
}

.action-btn:hover i {
    color: #007bff !important; /* Brighter blue on hover for eye icon */
}

.delete-btn:hover i {
    color: #FF9933 !important; /* Lighter orange on hover for trash icon */
}
</style>
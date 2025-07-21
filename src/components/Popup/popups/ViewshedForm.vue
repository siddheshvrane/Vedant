<template>
  <div>
    <div class="viewshed-form-content popup-content">
      <label class="form-label">Observer Height (m):</label>
      <input
        type="number"
        v-model.number="internalViewshedOptions.observerHeight"
        min="1"
        max="100"
        class="form-input"
      />

      <label class="form-label">View Distance (m):</label>
      <input
        type="number"
        v-model.number="internalViewshedOptions.viewDistance"
        min="100"
        max="10000"
        step="100"
        class="form-input"
      />

      <label class="form-label">Resolution (number of rays):</label>
      <select v-model.number="internalViewshedOptions.rayCount" class="form-select">
        <option :value="16">Low (16)</option>
        <option :value="32">Medium (32)</option>
        <option :value="64">High (64)</option>
      </select>
    </div>

    <div class="popup-actions">
      <button @click="handleStart" class="btn btn-primary action-btn">
        Start Analysis
      </button>
      <button @click="handleCancel" class="btn btn-secondary action-btn">
        Cancel
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "ViewshedForm",
  props: {
    // These props will receive the initial values from PopupService.popupContent$.data
    observerHeight: {
      type: Number,
      default: 1.75,
    },
    viewDistance: {
      type: Number,
      default: 5000,
    },
    rayCount: {
      type: Number,
      default: 32,
    },
    // Callback functions from PopupService to initiate/cancel the analysis
    onStart: {
      type: Function,
      required: true,
    },
    onCancel: {
      type: Function,
      required: true,
    },
    onClose: { // Prop to tell the parent (Popup.vue) to hide itself
        type: Function,
        required: true,
    }
  },
  data() {
    return {
      // Use internal data properties to allow v-model to work
      internalViewshedOptions: {
        observerHeight: this.observerHeight,
        viewDistance: this.viewDistance,
        rayCount: this.rayCount,
      },
    };
  },
  watch: {
    // Watch for changes in props and update internal data
    observerHeight(newVal) {
      this.internalViewshedOptions.observerHeight = newVal;
    },
    viewDistance(newVal) {
      this.internalViewshedOptions.viewDistance = newVal;
    },
    rayCount(newVal) {
      this.internalViewshedOptions.rayCount = newVal;
    },
  },
  methods: {
    handleStart() {
      // Call the onStart prop, passing the current form values
      this.onStart(this.internalViewshedOptions);
      this.onClose(); // Hide the popup after starting
    },
    handleCancel() {
      // Call the onCancel prop
      this.onCancel();
      this.onClose(); // Hide the popup after canceling
    },
  },
};
</script>

<style scoped>
/* Styles specific to the viewshed form elements - moved from Popup.vue */
.viewshed-form-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.form-label {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  margin-bottom: 2px;
  font-weight: 500;
}

.form-input,
.form-select {
  width: 100%;
  padding: 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 1em;
  box-sizing: border-box;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-select option {
  background-color: #333;
  color: white;
}

/* Common button styles that were also specific to viewshed form's actions */
.popup-actions {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  gap: 20px;
}

.action-btn {
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
  border: 1px solid #007bff;
}

.btn-primary:hover {
  background-color: #0056b3;
  border-color: #0056b3;
  transform: translateY(-2px);
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
</style>
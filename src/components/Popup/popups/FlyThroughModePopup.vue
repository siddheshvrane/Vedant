<template>
  <div>
    <div class="flythrough-mode-content popup-content">
      <div class="form-group">
        <label class="form-label">Select Fly-Through Mode:</label>
        <div class="radio-group">
          <label class="radio-label">
            <input
              type="radio"
              value="path"
              v-model="selectedMode"
              @change="applyFlyThroughLogic"
              class="form-radio"
            />
            Path Mode
          </label>
          <label class="radio-label">
            <input
              type="radio"
              value="marker"
              v-model="selectedMode"
              @change="applyFlyThroughLogic"
              class="form-radio"
            />
            Marker Mode
          </label>
          <label class="radio-label">
            <input
              type="radio"
              value="flight"
              v-model="selectedMode"
              @change="applyFlyThroughLogic"
              class="form-radio"
            />
            Flight Mode
          </label>
        </div>
      </div>
    </div>

    <div class="popup-actions">
      <button @click="handleSelectMode" class="btn btn-primary action-btn">
        Select Mode
      </button>
      <button @click="handleCancel" class="btn btn-secondary action-btn">
        Cancel
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "FlyThroughModePopup",
  props: {
    // Callbacks from PopupService (required to interact with the parent service)
    onSelect: { // Changed from onStart to onSelect for clarity
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
      selectedMode: "path", // Default selected mode
    };
  },
  methods: {
    /**
     * This method is called when a radio button for fly-through mode is selected.
     * You can implement any immediate logic here (e.g., updating a global state,
     * or preparing your application for the selected mode, even before the
     * "Select Mode" button is clicked).
     */
    applyFlyThroughLogic() {
      console.log(`Fly-Through Mode selected in popup: ${this.selectedMode}`);
      // This is where you would trigger any immediate side effects or state updates
      // based on the mode selection, if needed. For example:
      // this.$emit('mode-changed', this.selectedMode);
    },
    handleSelectMode() {
      console.log("FlyThroughModePopup: Mode selected:", this.selectedMode);
      // Call the onSelect prop, passing the chosen mode
      this.onSelect(this.selectedMode);
      this.onClose(); // Hide the popup after selection
    },
    handleCancel() {
      console.log("FlyThroughModePopup: Cancelled by user");
      // Call the onCancel prop
      this.onCancel();
      this.onClose(); // Hide the popup after canceling
    },
  },
  mounted() {
    // Optionally, apply initial logic based on the default selected mode
    this.applyFlyThroughLogic();
  }
};
</script>

<style scoped>
/* Reusing styles for consistent popup appearance */
.flythrough-mode-content {
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

/* Common button styles from your original popup */
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

/* Styles for radio buttons (retained from previous example) */
.form-group {
  margin-bottom: 15px;
}

.radio-group {
  display: flex;
  flex-direction: column; /* Stack radio buttons vertically */
  gap: 8px; /* Space between radio buttons */
  margin-top: 5px;
}

.radio-label {
  display: flex;
  align-items: center;
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.form-radio {
  margin-right: 8px;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background-color: rgba(0, 0, 0, 0.3);
  outline: none;
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.form-radio:checked {
  background-color: #007bff;
  border-color: #007bff;
}

.form-radio:checked::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: white;
  display: block;
}

.form-radio:focus {
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}
</style>
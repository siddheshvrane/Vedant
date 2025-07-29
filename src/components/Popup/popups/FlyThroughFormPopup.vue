<template>
  <div>
    <div class="flythrough-form-content popup-content">

      <label class="form-label" for="cameraHeight">Camera Height (m):</label>
      <input
        type="number"
        id="cameraHeight"
        v-model.number="internalFlyThroughOptions.height"
        min="0.1"
        step="1"
        class="form-input"
      />
      <p v-if="heightError" class="error-message">{{ heightError }}</p>

      <label class="form-label" for="cameraTilt">Camera Tilt Angle (°):</label>
      <input
        type="number"
        id="cameraTilt"
        v-model.number="internalFlyThroughOptions.tilt"
        min="0"
        max="180"
        step="1"
        class="form-input"
        placeholder="0 = straight down, 90 = horizontal, 180 = straight up"
      />
      <p v-if="tiltError" class="error-message">{{ tiltError }}</p>

      <label class="form-label" for="cameraSpeed">Camera Speed (m/s):</label>
      <input
        type="number"
        id="cameraSpeed"
        v-model.number="internalFlyThroughOptions.speed"
        min="0.1"
        step="0.5"
        class="form-input"
      />
      <p v-if="speedError" class="error-message">{{ speedError }}</p>

      <label class="form-label" for="duration">Animation Duration (s):</label>
      <input
        type="number"
        id="duration"
        v-model.number="internalFlyThroughOptions.duration"
        min="1"
        step="1"
        class="form-input"
        placeholder="Leave blank to auto-calculate based on speed"
      />
      <p v-if="durationError" class="error-message">{{ durationError }}</p>

    </div>

    <div class="popup-actions">
      <button @click="handleStart" class="btn btn-primary action-btn">
        Start Fly-Through
      </button>
      <button @click="handleCancel" class="btn btn-secondary action-btn">
        Cancel
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "FlyThroughPopup",
  props: {
    // Initial values for the form fields
    height: {
      type: Number,
    },
    tilt: {
      type: Number,
    },
    speed: {
      type: Number,
    },
    duration: {
      type: Number,
      default: null, // Optional: duration of the animation in seconds
    },
    loop: {
      type: Boolean,
      default: false, // Whether the animation should loop
    },
    // Callbacks from PopupService (required to interact with the parent service)
    onStart: {
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
      internalFlyThroughOptions: {
        height: this.height,
        tilt: this.tilt,
        speed: this.speed,
        duration: this.duration,
        loop: this.loop,
      },
      heightError: "",
      tiltError: "",
      speedError: "",
      durationError: "",
    };
  },
  watch: {
    // Watch for changes in props and update internal data if props can change dynamically
    height(newVal) {
      this.internalFlyThroughOptions.height = newVal;
    },
    tilt(newVal) {
      this.internalFlyThroughOptions.tilt = newVal;
    },
    speed(newVal) {
      this.internalFlyThroughOptions.speed = newVal;
    },
    duration(newVal) {
      this.internalFlyThroughOptions.duration = newVal;
    },
    loop(newVal) {
      this.internalFlyThroughOptions.loop = newVal;
    },
  },
  methods: {
    validateForm() {
      this.heightError = "";
      this.tiltError = "";
      this.speedError = "";
      this.durationError = "";
      let isValid = true;

      // Validate Camera Height
      if (
        typeof this.internalFlyThroughOptions.height !== "number" ||
        isNaN(this.internalFlyThroughOptions.height) ||
        this.internalFlyThroughOptions.height <= 0
      ) {
        this.heightError = "Height is required and must be a positive number.";
        isValid = false;
      }

      // Validate Camera Tilt - Updated for 0°-180° system
      if (
        typeof this.internalFlyThroughOptions.tilt !== "number" ||
        isNaN(this.internalFlyThroughOptions.tilt) ||
        this.internalFlyThroughOptions.tilt < 0 ||
        this.internalFlyThroughOptions.tilt > 180
      ) {
        this.tiltError = "Tilt must be a number between 0° (straight down) and 180° (straight up).";
        isValid = false;
      }

      // Validate Camera Speed
      if (
        typeof this.internalFlyThroughOptions.speed !== "number" ||
        isNaN(this.internalFlyThroughOptions.speed) ||
        this.internalFlyThroughOptions.speed <= 0
      ) {
        this.speedError = "Speed is required and must be a positive number.";
        isValid = false;
      }

      // Validate Duration (if provided) - Updated to allow null/undefined for auto-calculation
      if (
        this.internalFlyThroughOptions.duration !== null &&
        this.internalFlyThroughOptions.duration !== undefined &&
        (
          typeof this.internalFlyThroughOptions.duration !== "number" ||
          isNaN(this.internalFlyThroughOptions.duration) ||
          this.internalFlyThroughOptions.duration <= 0
        )
      ) {
        this.durationError = "Duration must be a positive number or left blank for auto-calculation.";
        isValid = false;
      }

      return isValid;
    },
    handleStart() {
      if (!this.validateForm()) {
        console.warn("Validation failed for Fly-Through form. Please check inputs.");
        return; // Stop if validation fails
      }

      // Clean up the options before passing to the tool
      const cleanedOptions = { ...this.internalFlyThroughOptions };
      
      // If duration is empty/null, remove it so the tool can auto-calculate
      if (cleanedOptions.duration === null || cleanedOptions.duration === undefined || cleanedOptions.duration === "") {
        delete cleanedOptions.duration;
      }

      console.log("FlyThroughPopup: Starting with options:", cleanedOptions);

      // Call the onStart prop, passing the current form values
      this.onStart(cleanedOptions);
      this.onClose(); // Hide the popup after the action
    },
    handleCancel() {
      console.log("FlyThroughPopup: Cancelled by user");
      // Call the onCancel prop
      this.onCancel();
      this.onClose(); // Hide the popup after canceling
    },
  },
};
</script>

<style scoped>
/* Reusing styles from ThreeDModelPopup.vue for visual consistency */
.flythrough-form-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.form-description {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-bottom: 10px;
}

.form-label {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.9);
  text-align: left;
  margin-bottom: 2px;
  font-weight: 500;
}

.form-input {
  width: 100%;
  padding: 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(0, 0, 0, 0.3);
  color: white;
  font-size: 1em;
  box-sizing: border-box;
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-checkbox {
  margin-top: 5px;
  margin-left: 0; /* Align with other inputs */
  width: auto; /* Allow checkbox to take its natural width */
}

.error-message {
  color: #ff6b6b; /* A light red for error messages */
  font-size: 0.8em;
  margin-top: -8px; /* Pull it closer to the input it's related to */
  margin-bottom: 5px;
  text-align: left;
}

/* Common button styles from Popup.vue / ViewshedForm.vue */
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
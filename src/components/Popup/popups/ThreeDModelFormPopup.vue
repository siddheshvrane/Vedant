<template>
  <div>
    <div class="model-form-content popup-content">
      <p v-if="file" class="file-name-display">
        Adding Model: <strong>{{ file.name }}</strong>
      </p>

      <label class="form-label" for="modelLongitude">Longitude:</label>
      <input
        type="number"
        id="modelLongitude"
        v-model.number="internalModelOptions.longitude"
        min="-180"
        max="180"
        step="0.000001"
        class="form-input"
      />
      <p v-if="longitudeError" class="error-message">{{ longitudeError }}</p>

      <label class="form-label" for="modelLatitude">Latitude:</label>
      <input
        type="number"
        id="modelLatitude"
        v-model.number="internalModelOptions.latitude"
        min="-90"
        max="90"
        step="0.000001"
        class="form-input"
      />
      <p v-if="latitudeError" class="error-message">{{ latitudeError }}</p>

      <label class="form-label" for="modelScale">Scale:</label>
      <input
        type="number"
        id="modelScale"
        v-model.number="internalModelOptions.scale"
        min="0.01"
        step="0.1"
        class="form-input"
      />
      <label class="form-label" for="modelMinPixelSize">Min Pixel Size:</label>
      <input
        type="number"
        id="modelMinPixelSize"
        v-model.number="internalModelOptions.minimumPixelSize"
        min="0"
        step="1"
        class="form-input"
      />
      <label class="form-label" for="modelMaxScale">Maximum Scale:</label>
      <input
        type="number"
        id="modelMaxScale"
        v-model.number="internalModelOptions.maximumScale"
        min="0"
        step="1000"
        class="form-input"
      />
    </div>

    <div class="popup-actions">
      <button @click="handleStart" class="btn btn-primary action-btn">
        Add Model
      </button>
      <button @click="handleCancel" class="btn btn-secondary action-btn">
        Cancel
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "ThreeDModelFormPopup",
  props: {
    // We only need the file object if we want to preview it here,
    // otherwise, its existence is already managed by AddDataSidebar.
    // However, it's good practice to pass it if available.
    file: {
      type: File,
      required: false,
    },
    // Initial values for the form fields
    // Default values reflect Ahmedabad, Gujarat, India (current location context)
    longitude: {
      type: Number,
      default: 72.5714, // Ahmedabad, India
    },
    latitude: {
      type: Number,
      default: 23.0225, // Ahmedabad, India
    },
    scale: {
      type: Number,
      default: 1.0,
    },
    minimumPixelSize: {
      type: Number,
      default: 128,
    },
    maximumScale: {
      type: Number,
      default: 20000,
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
      // Prop to tell the parent (Popup.vue) to hide itself
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      internalModelOptions: {
        longitude: this.longitude,
        latitude: this.latitude,
        scale: this.scale,
        minimumPixelSize: this.minimumPixelSize,
        maximumScale: this.maximumScale,
        elevation: 0, // Placeholder, Cesium will clamp to ground by default if not provided explicitly
      },
      longitudeError: "",
      latitudeError: "",
    };
  },
  watch: {
    // Watch for changes in props and update internal data (if props can change dynamically)
    longitude(newVal) {
      this.internalModelOptions.longitude = newVal;
    },
    latitude(newVal) {
      this.internalModelOptions.latitude = newVal;
    },
    scale(newVal) {
      this.internalModelOptions.scale = newVal;
    },
    minimumPixelSize(newVal) {
      this.internalModelOptions.minimumPixelSize = newVal;
    },
    maximumScale(newVal) {
      this.internalModelOptions.maximumScale = newVal;
    },
  },
  methods: {
    validateForm() {
      this.longitudeError = "";
      this.latitudeError = "";
      let isValid = true;

      // Validate Longitude
      if (typeof this.internalModelOptions.longitude !== 'number' || isNaN(this.internalModelOptions.longitude)) {
        this.longitudeError = "Longitude is required and must be a number.";
        isValid = false;
      } else if (this.internalModelOptions.longitude < -180 || this.internalModelOptions.longitude > 180) {
        this.longitudeError = "Longitude must be between -180 and 180.";
        isValid = false;
      }

      // Validate Latitude
      if (typeof this.internalModelOptions.latitude !== 'number' || isNaN(this.internalModelOptions.latitude)) {
        this.latitudeError = "Latitude is required and must be a number.";
        isValid = false;
      } else if (this.internalModelOptions.latitude < -90 || this.internalModelOptions.latitude > 90) {
        this.latitudeError = "Latitude must be between -90 and 90.";
        isValid = false;
      }

      return isValid;
    },
    handleStart() {
      if (!this.validateForm()) {
        console.warn("Validation failed for 3D model form. Please check inputs.");
        return; // Stop if validation fails
      }

      // Call the onStart prop, passing the current form values
      this.onStart(this.internalModelOptions);
      this.onClose(); // Hide the popup after the action
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
/* Reuse styles from ViewshedForm.vue for consistency */
.model-form-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

/* Optional: Style for displaying the file name */
.file-name-display {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  margin-bottom: 5px;
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

.form-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
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
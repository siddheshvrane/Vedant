<template>
  <div class="geo-spatial-form">
    <div class="form-group mb-3">
      <div class="d-flex justify-content-center align-items-center mb-3">
        <div class="form-check form-check-inline">
          <input
            class="form-check-input"
            type="radio"
            id="addDataTypeData"
            value="data"
            :checked="selectedOption === 'data'"
            @change="$emit('update:selectedOption', 'data')" />
          <label class="form-check-label" for="addDataTypeData">Add Data</label>
        </div>
        <div class="form-check form-check-inline">
          <input
            class="form-check-input"
            type="radio"
            id="addDataTypeService"
            value="service"
            :checked="selectedOption === 'service'"
            @change="$emit('update:selectedOption', 'service')" />
          <label class="form-check-label" for="addDataTypeService"
            >Add Service</label
          >
        </div>
      </div>
    </div>

    <div class="form-group mb-3">
      <label for="contentName" class="form-label"
        >{{ selectedOption === "data" ? "Data Name" : "Service Name" }}:</label
      >
      <input
        type="text"
        id="contentName"
        class="form-control"
        :placeholder="
          selectedOption === 'data' ? 'Enter data name' : 'Enter service name'
        "
        :value="contentName"
        @input="$emit('update:contentName', $event.target.value)" />
    </div>

    <div v-if="selectedOption === 'data'" class="form-group mb-3">
      <label for="dataType" class="form-label">Data Type:</label>
      <div class="select-wrapper">
        <select
          id="dataType"
          class="form-select"
          :value="contentType"
          @change="$emit('update:contentType', $event.target.value)">
          <option value="geojson">GeoJSON</option>
          <option value="kml">KML</option>
          <option value="czml">CZML</option>
          <option value="3dtile">3D Tile</option>
          <option value="3dmodel">3D Model</option>
        </select>
        <i class="fas fa-chevron-down dropdown-icon"></i>
      </div>
    </div>

    <div v-if="selectedOption === 'service'" class="form-group mb-3">
      <label for="serviceType" class="form-label">Service Type:</label>
      <div class="select-wrapper">
        <select
          id="serviceType"
          class="form-select"
          :value="contentType"
          @change="$emit('update:contentType', $event.target.value)">
          <option value="wms">WMS</option>
          <option value="wmts">WMTS</option>
        </select>
        <i class="fas fa-chevron-down dropdown-icon"></i>
      </div>
    </div>

    <div v-if="selectedOption === 'service'" class="form-group mb-3">
      <label for="baseUrl" class="form-label">Base URL:</label>
      <input
        type="text"
        id="baseUrl"
        class="form-control"
        placeholder="e.g., WMS/WMTS service URL"
        :value="baseUrl"
        @input="$emit('update:baseUrl', $event.target.value)" />
    </div>

    <div v-if="selectedOption === 'service'" class="form-group mb-3">
      <label for="argsInput" class="form-label">Arguments:</label>
      <textarea
        id="argsInput"
        class="form-control"
        rows="6"
        placeholder='Enter key-value pairs (e.g., "key: value" or "key - value")'
        :value="argsInput"
        @input="$emit('update:argsInput', $event.target.value)"></textarea>
    </div>

    <div v-if="selectedOption === 'service'" class="form-group mb-3">
      <label for="legendOptionsInput" class="form-label">Legend Options:</label>
      <textarea
        id="legendOptionsInput"
        class="form-control"
        rows="4"
        placeholder='Enter legend details (e.g., "title: My Title")'
        :value="legendOptionsInput"
        @input="
          $emit('update:legendOptionsInput', $event.target.value)
        "></textarea>
    </div>

    <div
      v-if="
        selectedOption === 'data' &&
        ['geojson', 'kml', 'czml', '3dmodel'].includes(contentType)
      "
      class="form-group mb-3">
      <label for="fileUpload" class="form-label">Upload File:</label>
      <input
        type="file"
        id="fileUpload"
        class="form-control"
        :accept="getFileAccepts(contentType)"
        @change="handleFileUpload"
        ref="fileInput" />
    </div>

    <div
      v-if="selectedOption === 'data' && contentType === '3dtile'"
      class="form-group mb-3">
      <label for="tileUrl" class="form-label">3D Tile URL:</label>
      <input
        type="text"
        id="tileUrl"
        class="form-control"
        placeholder="Enter 3D Tile service URL"
        :value="baseUrl"
        @input="$emit('update:baseUrl', $event.target.value)" />
    </div>

    <button
      @click="submitForm"
      class="btn btn-primary w-100 mt-3"
      :disabled="!isFormValid">
      <i class="fas fa-plus me-2"></i>
      {{ selectedOption === "data" ? "Add Data" : "Add Service" }}
    </button>
  </div>
</template>

<script>
export default {
  name: "GeoSpatialForm",
  props: {
    selectedOption: {
      type: String,
      required: true,
    },
    contentName: {
      type: String,
      required: true,
    },
    contentType: {
      type: String,
      required: true,
    },
    baseUrl: {
      type: String,
      default: "",
    },
    argsInput: {
      type: String,
      default: "",
    },
    legendOptionsInput: {
      type: String,
      default: "",
    },
  },
  emits: [
    "update:selectedOption",
    "update:contentName",
    "update:contentType",
    "update:baseUrl",
    "update:argsInput",
    "update:legendOptionsInput",
    "submit-form",
    "file-selected",
    "open-three-d-model-form",
  ],
  data() {
    return {
      fileSelected: null,
    };
  },
  computed: {
    isFormValid() {
      if (!this.contentName) return false;
      if (this.selectedOption === "data") {
        if (this.contentType === "3dtile") {
          return !!this.baseUrl;
        } else if (
          ["geojson", "kml", "czml", "3dmodel"].includes(this.contentType)
        ) {
          return !!this.fileSelected;
        }
      }
      return true;
    },
  },
  watch: {
    selectedOption(newVal) {
      if (newVal === "service" && !["wms", "wmts"].includes(this.contentType)) {
        this.$emit("update:contentType", "wms");
      } else if (
        newVal === "data" &&
        !["geojson", "kml", "czml", "3dtile", "3dmodel"].includes(
          this.contentType
        )
      ) {
        this.$emit("update:contentType", "geojson");
      }
      this.clearFileSelection();
    },
    contentType() {
      this.clearFileSelection();
    },
  },
  methods: {
    handleFileUpload(event) {
      this.fileSelected = event.target.files[0];
      this.$emit("file-selected", this.fileSelected);
    },
    submitForm() {
      // ========================================================================
      // 1. ADD THIS DEBUGGING LINE
      // This will tell us the exact state when you click the button.
      // ========================================================================
      console.log(
        `DEBUG: Submitting form with contentType = '${this.contentType}'`
      );

      if (!this.isFormValid) {
        console.warn("Form is not valid. Cannot submit.");
        return;
      }

      // ========================================================================
      // 2. THIS IS THE CRITICAL FIX
      // This logic now explicitly checks for the 3D model type and handles
      // everything else separately, preventing the wrong event from being sent.
      // ========================================================================
      if (this.selectedOption === "data" && this.contentType === "3dmodel") {
        // Path for 3D models (triggers the popup)
        console.log("Triggering 3D model popup workflow.");
        this.$emit("open-three-d-model-form", {
          contentName: this.contentName,
          file: this.fileSelected,
        });
      } else {
        // Path for ALL other types (KML, GeoJSON, services, etc.)
        console.log("Triggering standard data/service submission workflow.");
        const payload = {
          selectedOption: this.selectedOption,
          contentName: this.contentName,
          contentType: this.contentType,
          baseUrl:
            this.selectedOption === "service" || this.contentType === "3dtile"
              ? this.baseUrl
              : "",
          argsInput: this.argsInput,
          legendOptionsInput: this.legendOptionsInput,
        };
        this.$emit("submit-form", payload);
      }
    },
    getFileAccepts(contentType) {
      switch (contentType) {
        case "geojson":
          return ".geojson,.json";
        case "kml":
          return ".kml,.kmz";
        case "czml":
          return ".czml,.json";
        case "3dmodel":
          return ".gltf,.glb,.zip";
        default:
          return "";
      }
    },
    clearFileSelection() {
      this.fileSelected = null;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = null;
      }
      this.$emit("file-selected", null);
    },
  },
};
</script>

<style scoped>
/* Your existing styles remain here */
.form-label {
  color: #fff;
  margin-bottom: 5px;
  display: block;
}

.form-control,
.form-select {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.form-control::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.form-select option {
  background-color: #333;
  color: #fff;
}

.btn-primary {
  background-color: #007bff;
  border-color: #007bff;
}

.btn-primary:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

/* Removed .btn-info styling as that button is no longer present */

.btn:disabled {
  background-color: #6c757d;
  border-color: #6c757d;
  cursor: not-allowed;
}

/* Styles for radio buttons */
.form-check-label {
  color: #fff;
  margin-left: 5px;
}

.form-check-input {
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.form-check-input:checked {
  background-color: #007bff;
  border-color: #007bff;
}

/* --- STYLES TO MAINTAIN TRANSLUCENT SHADE FOR INPUTS --- */
.form-control:focus {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: none !important;
}

input.form-control:-webkit-autofill,
input.form-control:-webkit-autofill:hover,
input.form-control:-webkit-autofill:focus,
input.form-control:-webkit-autofill:active {
  -webkit-box-shadow: 0 0 0px 1000px rgba(30, 30, 30, 0.7) inset !important;
  -webkit-text-fill-color: #fff !important;
  transition: background-color 5000s ease-in-out 0s;
}

/* --- STYLES FOR CUSTOM DROPDOWN ICON --- */
.select-wrapper {
  position: relative;
  display: block;
}

.form-select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: none;
  padding-right: 2.5rem;
}

.dropdown-icon {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: rgba(255, 255, 255, 0.7);
  pointer-events: none;
  font-size: 0.8em;
}

/* For select fields on focus (ensure custom icon is not affected) */
.form-select:focus {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: #fff !important;
  border-color: rgba(255, 255, 255, 0.3) !important;
  box-shadow: none !important;
}

/* Ensure placeholder text is visible and consistent */
.form-control::placeholder {
  color: rgba(255, 255, 255, 0.5);
  opacity: 1;
}
</style>

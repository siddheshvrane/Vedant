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
            @change="$emit('update:selectedOption', 'data')"
          />
          <label class="form-check-label" for="addDataTypeData">Add Data</label>
        </div>
        <div class="form-check form-check-inline">
          <input
            class="form-check-input"
            type="radio"
            id="addDataTypeService"
            value="service"
            :checked="selectedOption === 'service'"
            @change="$emit('update:selectedOption', 'service')"
          />
          <label class="form-check-label" for="addDataTypeService">Add Service</label>
        </div>
      </div>
    </div>

    <div class="form-group mb-3">
      <label for="contentName" class="form-label">{{ selectedOption === 'data' ? 'Data Name' : 'Service Name' }}:</label>
      <input
        type="text"
        id="contentName"
        class="form-control"
        :placeholder="selectedOption === 'data' ? 'Enter data name' : 'Enter service name'"
        :value="contentName"
        @input="$emit('update:contentName', $event.target.value)"
      />
    </div>

    <div v-if="selectedOption === 'data'" class="form-group mb-3">
      <label for="dataType" class="form-label">Data Type:</label>
      <div class="select-wrapper">
        <select
          id="dataType"
          class="form-select"
          :value="contentType"
          @change="$emit('update:contentType', $event.target.value)"
        >
          <option value="geojson">GeoJSON</option>
          <option value="kml">KML</option>
          <option value="shapefile">Shapefile</option>
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
          @change="$emit('update:contentType', $event.target.value)"
        >
          <option value="wms">WMS</option>
          <option value="wmts">WMTS</option>
        </select>
        <i class="fas fa-chevron-down dropdown-icon"></i>
      </div>
    </div>

    <div class="form-group mb-3">
      <label for="baseUrl" class="form-label">Base URL:</label>
      <input
        type="text"
        id="baseUrl"
        class="form-control"
        placeholder="e.g., https://example.com/data.geojson or WMS/WMTS service URL"
        :value="baseUrl"
        @input="$emit('update:baseUrl', $event.target.value)"
      />
    </div>

    <div class="form-group mb-3">
      <label for="argsInput" class="form-label">Args (JSON):</label>
      <textarea
        id="argsInput"
        class="form-control"
        rows="4"
        placeholder='Enter JSON for arguments, e.g., {"layers": "layer_name"}'
        :value="argsInput"
        @input="$emit('update:argsInput', $event.target.value)"
      ></textarea>
    </div>

    <div class="form-group mb-3">
      <label for="legendOptionsInput" class="form-label">Legend Options (JSON):</label>
      <textarea
        id="legendOptionsInput"
        class="form-control"
        rows="4"
        placeholder='Enter JSON for legend options, e.g., {"title": "My Legend"}'
        :value="legendOptionsInput"
        @input="$emit('update:legendOptionsInput', $event.target.value)"
      ></textarea>
    </div>

    <div v-if="selectedOption === 'data' && contentType === 'geojson'" class="form-group mb-3">
      <label class="form-label">GeoJSON Source:</label>
      <div class="d-flex justify-content-center align-items-center mb-3">
        <div class="form-check form-check-inline">
          <input
            class="form-check-input"
            type="radio"
            id="geojsonSourceText"
            value="text"
            :checked="selectedJsonSource === 'text'"
            @change="selectedJsonSource = 'text'; uploadedJsonFile = null"
          />
          <label class="form-check-label" for="geojsonSourceText">Enter Text</label>
        </div>
        <div class="form-check form-check-inline">
          <input
            class="form-check-input"
            type="radio"
            id="geojsonSourceFile"
            value="file"
            :checked="selectedJsonSource === 'file'"
            @change="selectedJsonSource = 'file'; $emit('update:jsonTextInput', '')"
          />
          <label class="form-check-label" for="geojsonSourceFile">Upload File</label>
        </div>
      </div>

      <div v-if="selectedJsonSource === 'text'">
        <label for="jsonTextInput" class="form-label">GeoJSON Text:</label>
        <textarea
          id="jsonTextInput"
          class="form-control"
          rows="8"
          placeholder='Enter GeoJSON content here, e.g., {"type": "Feature", ...}'
          :value="jsonTextInput"
          @input="$emit('update:jsonTextInput', $event.target.value)"
        ></textarea>
      </div>

      <div v-if="selectedJsonSource === 'file'">
        <label for="jsonFileUpload" class="form-label">Upload GeoJSON File:</label>
        <input
          type="file"
          id="jsonFileUpload"
          class="form-control"
          accept=".geojson,.json"
          @change="handleJsonFileUpload"
        />
      </div>
    </div>

    <button
      @click="submitForm"
      class="btn btn-primary w-100 mt-3"
      :disabled="!contentName"
    >
      <i class="fas fa-plus me-2"></i>
      {{ selectedOption === 'data' ? 'Add Data' : 'Add Service' }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'GeoSpatialForm',
  props: {
    selectedOption: {
      type: String,
      required: true
    },
    contentName: {
      type: String,
      required: true
    },
    contentType: {
      type: String,
      required: true
    },
    baseUrl: { // New prop
      type: String,
      default: ''
    },
    argsInput: { // New prop for Args JSON text
      type: String,
      default: ''
    },
    legendOptionsInput: { // New prop for Legend Options JSON text
      type: String,
      default: ''
    },
    jsonTextInput: { // New prop for direct GeoJSON text input
      type: String,
      default: ''
    }
  },
  emits: [
    'update:selectedOption',
    'update:contentName',
    'update:contentType',
    'update:baseUrl', // New emit
    'update:argsInput', // New emit
    'update:legendOptionsInput', // New emit
    'update:jsonTextInput', // New emit
    'submit-data',
    'submit-service'
  ],
  data() {
    return {
      selectedJsonSource: 'none', // 'none', 'text', 'file'
      uploadedJsonFile: null // To hold the File object
    };
  },
  methods: {
    handleJsonFileUpload(event) {
      this.uploadedJsonFile = event.target.files[0];
    },
    parseJson(jsonString, fieldName) {
      if (!jsonString) {
        return {};
      }
      try {
        return JSON.parse(jsonString);
      } catch (e) {
        console.error(`Error parsing ${fieldName} JSON:`, e);
        alert(`Invalid JSON in ${fieldName}. Please check the syntax.`);
        return null; // Return null to indicate parsing error
      }
    },
    submitForm() {
      // Basic validation
      if (!this.contentName) {
        alert('Please enter a name for the content.');
        return;
      }

      const parsedArgs = this.parseJson(this.argsInput, 'Args');
      if (parsedArgs === null) return; // Stop if parsing failed

      const parsedLegendOptions = this.parseJson(this.legendOptionsInput, 'Legend Options');
      if (parsedLegendOptions === null) return; // Stop if parsing failed

      const payload = {
        name: this.contentName,
        type: this.contentType,
        baseUrl: this.baseUrl, // Include base URL
        args: parsedArgs,      // Include parsed args
        legOpts: parsedLegendOptions // Include parsed legend options
      };

      if (this.selectedOption === 'data') {
        if (this.contentType === 'geojson') {
          if (this.selectedJsonSource === 'text') {
            const parsedJsonText = this.parseJson(this.jsonTextInput, 'GeoJSON Text');
            if (parsedJsonText === null) return; // Stop if parsing failed
            payload.jsonContent = parsedJsonText; // Add parsed GeoJSON content
          } else if (this.selectedJsonSource === 'file') {
            if (!this.uploadedJsonFile) {
              alert('Please select a GeoJSON file.');
              return;
            }
            payload.jsonFile = this.uploadedJsonFile; // Add the File object
            // Note: File content needs to be read asynchronously by the parent component
            // or a service that receives this payload. This component only passes the File object.
          } else {
            alert('Please specify a GeoJSON source (text or file).');
            return;
          }
        }
        this.$emit('submit-data', payload);
      } else { // Service
        this.$emit('submit-service', payload);
      }
    }
  }
};
</script>

<style scoped>
/* Your existing styles remain here */
.form-label {
  color: #fff;
  margin-bottom: 5px;
  display: block;
}

.form-control, .form-select {
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
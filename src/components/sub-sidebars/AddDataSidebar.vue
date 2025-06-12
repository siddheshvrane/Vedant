<template>
  <BaseSubSidebar title="Add Geo-Spatial Content">
    <div class="form-group mb-3">
      <div class="form-check form-check-inline">
        <input
          class="form-check-input"
          type="radio"
          id="radioAddData"
          value="data"
          v-model="selectedOption"
        >
        <label class="form-check-label" for="radioAddData">Add Data</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          class="form-check-input"
          type="radio"
          id="radioAddService"
          value="service"
          v-model="selectedOption"
        >
        <label class="form-check-label" for="radioAddService">Add Service</label>
      </div>
    </div>

    <hr class="sidebar-divider mb-4">
    <div v-if="selectedOption === 'data'">
      <div class="form-group mb-3">
        <label for="dataNameInput">Name:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="dataNameInput"
          placeholder="city points"
          v-model="dataName"
        >
      </div>
      <div class="form-group mb-4">
        <label for="dataTypeSelect">Data Type:</label>
        <select class="form-control custom-select" id="dataTypeSelect" v-model="selectedDataType">
          <option value="geojson">GeoJSON</option>
          <option value="kmlkmz">KML/KMZ</option>
          <option value="shapefile">Shapefile</option>
          <option value="geopackage">GeoPackage</option>
        </select>
      </div>
      <button class="btn btn-primary w-100" @click="addGeoSpatialData">
        <i class="fas fa-plus me-2"></i> Add Data
      </button>
    </div>

    <div v-else-if="selectedOption === 'service'">
      <div class="form-group mb-3">
        <label for="serviceNameInput">Name:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="serviceNameInput"
          v-model="serviceName"
        >
      </div>
      <div class="form-group mb-4">
        <label for="serviceTypeSelect">Service Type:</label>
        <select class="form-control custom-select" id="serviceTypeSelect" v-model="selectedServiceType">
          <option value="ridam">RIDaM</option>
          <option value="geoEntityStats">Geo Entity Stats System</option>
        </select>
      </div>

      <hr class="sidebar-divider mb-4">
      <h6 class="text-white mb-3">Service Details</h6>

      <div class="form-group mb-3">
        <label for="baseUrlInput">Base URL:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="baseUrlInput"
          v-model="baseUrl"
          placeholder="e.g., https://example.com/geoservice"
        >
      </div>
      <div class="form-group mb-3">
        <label for="argsInput">Args:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="argsInput"
          v-model="args"
          placeholder="e.g., layer=roads&format=png"
        >
      </div>
      <div class="form-group mb-4">
        <label for="legendOptionsInput">Legend Options:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="legendOptionsInput"
          v-model="legendOptions"
          placeholder="e.g., { 'title': 'Road Types' }"
        >
      </div>

      <button class="btn btn-primary w-100" @click="addGeoSpatialService">
        <i class="fas fa-plus me-2"></i> Add Service
      </button>
    </div>
  </BaseSubSidebar>
</template>

<script>
// Corrected import path for BaseSubSidebar.vue
import BaseSubSidebar from '../utils/BaseSubSidebar.vue';

export default {
  name: 'AddDataSidebar',
  components: {
    BaseSubSidebar,
  },
  data() {
    return {
      selectedOption: 'data',
      dataName: '',
      selectedDataType: 'geojson',
      serviceName: '',
      selectedServiceType: 'ridam',
      baseUrl: '',
      args: '',
      legendOptions: '',
    };
  },
  methods: {
    addGeoSpatialData() {
      console.log('Adding Data:', {
        name: this.dataName,
        type: this.selectedDataType,
      });
      alert(`Adding Data: ${this.dataName || 'N/A'} (${this.selectedDataType})`);
    },
    addGeoSpatialService() {
      console.log('Adding Service:', {
        name: this.serviceName,
        type: this.selectedServiceType,
        baseUrl: this.baseUrl,
        args: this.args,
        legendOptions: this.legendOptions,
      });
      alert(`Adding Service: ${this.serviceName || 'N/A'} (${this.selectedServiceType})\nBase URL: ${this.baseUrl}\nArgs: ${this.args}\nLegend Options: ${this.legendOptions}`);
    },
  },
};
</script>

<style scoped>
/* All styles that are specific to AddDataSidebar's content should remain here.
   Common sub-sidebar panel styles should be in BaseSubSidebar.vue's style section. */

.sub-sidebar-body label {
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 5px;
}

/* Custom styles for input fields */
.sub-sidebar-body .custom-input {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.sub-sidebar-body .custom-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.sub-sidebar-body .custom-input:focus {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.25);
}

/* Custom styles for select dropdowns */
.sub-sidebar-body .custom-select {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 16px 12px;
}

.sub-sidebar-body .custom-select:focus {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.25);
  outline: 0;
}

/* Styling for dropdown options (when the select is opened) */
.sub-sidebar-body .custom-select option {
  background-color: rgba(30, 30, 30, 0.95);
  color: white;
}

/* Important: Overriding Bootstrap's default form-control focus styles */
.sub-sidebar-body .form-control:focus {
  color: white;
}

.sub-sidebar-body .btn-primary {
  background-color: #007bff;
  border-color: #007bff;
  color: white;
}
.sub-sidebar-body .btn-primary:hover {
  background-color: #0056b3;
  border-color: #004085;
}

/* Custom style for the horizontal rule */
.sidebar-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

/* Adjustments for inline radio buttons to look better */
.form-check-inline {
  margin-right: 1.5rem;
}
.form-check-label {
  color: rgba(255, 255, 255, 0.9);
}
</style>
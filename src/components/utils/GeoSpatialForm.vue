<template>
  <div>
    <div class="form-group mb-3">
      <div class="form-check form-check-inline">
        <input
          class="form-check-input"
          type="radio"
          id="radioAddData"
          value="data"
          :checked="selectedOption === 'data'"
          @change="$emit('update:selectedOption', 'data')"
        >
        <label class="form-check-label" for="radioAddData">Add Data</label>
      </div>
      <div class="form-check form-check-inline">
        <input
          class="form-check-input"
          type="radio"
          id="radioAddService"
          value="service"
          :checked="selectedOption === 'service'"
          @change="$emit('update:selectedOption', 'service')"
        >
        <label class="form-check-label" for="radioAddService">Add Service</label>
      </div>
    </div>

    <hr class="sidebar-divider mb-4">

    <div class="form-group mb-3">
      <label :for="`${selectedOption}NameInput`">Name:</label>
      <input
        type="text"
        class="form-control custom-input"
        :id="`${selectedOption}NameInput`"
        :placeholder="selectedOption === 'data' ? 'city points' : ''"
        :value="contentName"
        @input="$emit('update:contentName', $event.target.value)"
      >
    </div>

    <div class="form-group mb-4">
      <label :for="`${selectedOption}TypeSelect`">{{ selectedOption === 'data' ? 'Data Type:' : 'Service Type:' }}</label>
      <select
        class="form-control custom-select"
        :id="`${selectedOption}TypeSelect`"
        :value="contentType"
        @change="$emit('update:contentType', $event.target.value)"
      >
        <option v-if="selectedOption === 'data'" value="geojson">GeoJSON</option>
        <option v-if="selectedOption === 'data'" value="kmlkmz">KML/KMZ</option>
        <option v-if="selectedOption === 'data'" value="shapefile">Shapefile</option>
        <option v-if="selectedOption === 'data'" value="geopackage">GeoPackage</option>

        <option v-if="selectedOption === 'service'" value="ridam">RIDaM</option>
        <option v-if="selectedOption === 'service'" value="geoEntityStats">Geo Entity Stats System</option>
      </select>
    </div>

    <slot></slot>

    <button
      class="btn btn-primary w-100"
      @click="$emit(selectedOption === 'data' ? 'add-data' : 'add-service')"
    >
      <i class="fas fa-plus me-2"></i> {{ selectedOption === 'data' ? 'Add Data' : 'Add Service' }}
    </button>
  </div>
</template>

<script>
export default {
  name: 'GeoSpatialForm',
  props: {
    selectedOption: {
      type: String,
      default: 'data' // 'data' or 'service'
    },
    contentName: {
      type: String,
      default: ''
    },
    contentType: {
      type: String,
      default: '' // default for data 'geojson', for service 'ridam'
    }
  },
  emits: ['update:selectedOption', 'update:contentName', 'update:contentType', 'add-data', 'add-service'],
  // No internal data needed, as props are managed by v-model from parent
};
</script>

<style scoped>
/* Common styles from AddDataSidebar.vue that apply to form elements */
.sub-sidebar-body label {
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 5px;
}
.sub-sidebar-body .custom-input,
.sub-sidebar-body .custom-select {
  background-color: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}
.sub-sidebar-body .custom-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}
.sub-sidebar-body .custom-input:focus,
.sub-sidebar-body .custom-select:focus {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.4);
  box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.25);
  outline: 0;
}
.sub-sidebar-body .custom-select {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2 5l6 6 6-6'/%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 16px 12px;
}
.sub-sidebar-body .custom-select option {
  background-color: rgba(30, 30, 30, 0.95);
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
.sidebar-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}
.form-check-inline {
  margin-right: 1.5rem;
}
.form-check-label {
  color: rgba(255, 255, 255, 0.9);
}
</style>
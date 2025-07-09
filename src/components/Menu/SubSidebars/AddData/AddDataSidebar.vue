<template>
  <BaseSubSidebar title="Add Geo-Spatial Content">
    <GeoSpatialForm
      v-model:selectedOption="selectedOption"
      v-model:contentName="currentName"
      v-model:contentType="currentType"
      v-model:baseUrl="currentBaseUrl"
      v-model:argsInput="currentArgsInput"
      v-model:legendOptionsInput="currentLegendOptionsInput"
      @submit-form="handleSubmitForm"
      @file-selected="handleFileSelected"
    />
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../SubSidebar.vue';
import GeoSpatialForm from './GeoSpatialForm.vue';
import { DataAddService } from '../../../../services/controller.js'; // Import DataAddService

export default {
  name: 'AddDataSidebar',
  components: {
    BaseSubSidebar,
    GeoSpatialForm,
  },
  data() {
    return {
      selectedOption: 'data',
      currentName: '',
      currentType: 'geojson',
      currentBaseUrl: '',
      currentArgsInput: '',
      currentLegendOptionsInput: '',
      selectedFile: null,
    };
  },
  watch: {
    selectedOption(newVal) {
      // Reset relevant fields when switching options
      this.currentName = '';
      this.currentBaseUrl = '';
      this.currentArgsInput = '';
      this.currentLegendOptionsInput = '';
      this.selectedFile = null;

      if (newVal === 'data') {
        this.currentType = 'geojson';
      } else { // service
        this.currentType = 'wms';
      }
      // Reset validation errors if you're using them
      // this.validationErrors = {};
    }
  },
  created() {
    // Subscribe to success and error events from DataAddService
    this.successSubscription = DataAddService.submissionSuccess$.subscribe(message => {
      alert(message); // Using alert for simplicity, replace with a proper notification system
      this.resetForm();
    });

    this.errorSubscription = DataAddService.submissionError$.subscribe(errorMessage => {
      alert(`Submission Error: ${errorMessage}`); // Using alert, replace as needed
      // You could also populate specific validationErrors here
    });
  },
  beforeUnmount() {
    // Unsubscribe to prevent memory leaks
    if (this.successSubscription) {
      this.successSubscription.unsubscribe();
    }
    if (this.errorSubscription) {
      this.errorSubscription.unsubscribe();
    }
  },
  methods: {
    handleFileSelected(file) {
      this.selectedFile = file;
    },
    async handleSubmitForm(payload) {
      // Pass the raw payload and file directly to the DataAddService
      // The service will handle all processing, validation, and file reading
      DataAddService.processGeoSpatialSubmission(payload, this.selectedFile);
    },
    resetForm() {
      // Reset form fields after successful submission
      this.currentName = '';
      this.currentBaseUrl = '';
      this.currentArgsInput = '';
      this.currentLegendOptionsInput = '';
      this.selectedFile = null;
      // this.validationErrors = {};
      this.selectedOption = 'data'; // Reset to default tab
      this.currentType = 'geojson'; // Reset to default type for data
    }
  },
};
</script>

<style scoped>
/* Any styles specific to the AddDataSidebar container if needed */
</style>
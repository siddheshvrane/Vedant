<template>
  <BaseSubSidebar title="Add Geo-Spatial Content">
    <GeoSpatialForm
      v-model:selectedOption="selectedOption"
      v-model:contentName="currentName"
      v-model:contentType="currentType"
      @submit-data="handleAddData"
      @submit-service="handleAddService"
    />
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../SubSidebar.vue';
import GeoSpatialForm from './GeoSpatialForm.vue';
// Import services and data models
import { DataAddService } from '../../../../services/controller.js'; // 
import Data from '../../../../datamodels/Data.js'; // 
import Service from '../../../../datamodels/Service.js'; // 

export default {
  name: 'AddDataSidebar', // Matches class diagram 
  components: {
    BaseSubSidebar,
    GeoSpatialForm,
  },
  data() {
    return {
      selectedOption: 'data', // 'data' or 'service' [cite: 2]
      currentName: '', // Holds dataName or serviceName
      currentType: 'geojson', // Holds selectedDataType or selectedServiceType
    };
  },
  watch: {
    selectedOption(newVal) {
      // Reset name and type when switching options
      this.currentName = '';
      this.currentType = newVal === 'data' ? 'geojson' : 'ridam';
      // oselect() functionality, if it involved more complex logic. [cite: 3]
    }
  },
  methods: {
    /**
     * Handles the submission of new data.
     * Corresponds to oprocessInput() logic for Data. [cite: 3]
     * @param {object} payload - Data from the form.
     */
    handleAddData(payload) {
      // Create a Data model instance 
      const dataModel = new Data(
        `data-${Date.now()}`, // Simple unique ID
        payload.name,
        payload.type,
        payload.srcInfo
      );
      // Call the DataAddService to process the data 
      DataAddService.addData(dataModel);
      // oShowSuccess() is handled by DataAddService calling PopupService [cite: 3]
    },
    
    /**
     * Handles the submission of a new service.
     * Corresponds to oprocessInput() logic for Service. [cite: 3]
     * @param {object} payload - Service details from the form.
     */
    handleAddService(payload) {
      // Create a Service model instance 
      const serviceModel = new Service(
        `service-${Date.now()}`, // Simple unique ID
        payload.name,
        payload.type,
        // Assuming baseUrl, args, legOpts would come from more detailed service form fields
        // For now, using placeholders from payload
        'http://example.com/service', // Placeholder [cite: 21]
        payload.args, // [cite: 22]
        payload.legOpts // [cite: 23]
      );
      // Call the DataAddService to process the service 
      DataAddService.addService(serviceModel);
      // oShowSuccess() is handled by DataAddService calling PopupService [cite: 3]
    },

    // odisplayForm() is implicitly handled by rendering GeoSpatialForm.vue [cite: 3]
  },
};
</script>

<style scoped>
/* Any styles specific to the AddDataSidebar container if needed */
</style>
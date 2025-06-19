<template>
  <BaseSubSidebar title="Add Geo-Spatial Content">
    <GeoSpatialForm
      v-model:selectedOption="selectedOption"
      v-model:contentName="currentName"
      v-model:contentType="currentType"
      @add-data="addGeoSpatialData"
      @add-service="addGeoSpatialService"
    >
      <div v-if="selectedOption === 'service'">
        <p class="text-white-50 mt-3">Service details are temporarily commented out.</p>
      </div>
    </GeoSpatialForm>
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../utils/BaseSubSidebar.vue';
import GeoSpatialForm from '../utils/GeoSpatialForm.vue'; // Adjust path as needed

export default {
  name: 'AddDataSidebar',
  components: {
    BaseSubSidebar,
    GeoSpatialForm,
  },
  data() {
    return {
      selectedOption: 'data', // 'data' or 'service'
      currentName: '', // Holds dataName or serviceName
      currentType: 'geojson', // Holds selectedDataType or selectedServiceType, default to 'geojson'
      // baseUrl: '', // Commented out as requested
      // args: '', // Commented out as requested
      // legendOptions: '', // Commented out as requested
    };
  },
  watch: {
    selectedOption(newVal) {
      // Reset name and type when switching options
      this.currentName = '';
      this.currentType = newVal === 'data' ? 'geojson' : 'ridam';
    }
  },
  methods: {
    addGeoSpatialData() {
      console.log('Adding Data:', {
        name: this.currentName,
        type: this.currentType,
      });
      alert(`Adding Data: ${this.currentName || 'N/A'} (${this.currentType})`);
    },
    addGeoSpatialService() {
      console.log('Adding Service (details commented out):', {
        name: this.currentName,
        type: this.currentType,
        // baseUrl: this.baseUrl, // Commented out as requested
        // args: this.args, // Commented out as requested
        // legendOptions: this.legendOptions, // Commented out as requested
      });
      alert(`Adding Service: ${this.currentName || 'N/A'} (${this.currentType})\n(Details commented out)`);
    },
  },
};
</script>

<style scoped>
/* All styles that are specific to AddDataSidebar's container or unique elements should remain here.
   Common form styles are now in GeoSpatialForm.vue */
</style>
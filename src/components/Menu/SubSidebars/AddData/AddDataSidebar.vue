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
      @open-three-d-model-form="handleOpenThreeDModelForm" />
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../SubSidebar.vue';
import GeoSpatialForm from './GeoSpatialForm.vue';
import { DataAddService } from '../../../../controller.js'; // Import DataAddService
import { PopupService } from '../../../../services/PopupService.js'; // Assuming named export for PopupService
import ThreeDModelFormPopup from '../../../Popup/popups/ThreeDModelFormPopup.vue'; // Import ThreeDModelFormPopup

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
      selectedFile: null, // This will hold the File object for file uploads
    };
  },
  watch: {
    selectedOption(newVal) {
      // Reset relevant fields when switching options
      this.currentName = '';
      this.currentBaseUrl = '';
      this.currentArgsInput = '';
      this.currentLegendOptionsInput = '';
      this.selectedFile = null; // Clear selected file when switching main option

      if (newVal === 'data') {
        this.currentType = 'geojson';
      } else { // service
        this.currentType = 'wms';
      }
    },
    // Watch currentType to clear baseUrl if switching from 3dtile to a file type and vice-versa
    currentType(newVal, oldVal) {
      if ((newVal === '3dtile' && ['geojson', 'kml', 'czml', '3dmodel'].includes(oldVal)) ||
          (['geojson', 'kml', 'czml', '3dmodel'].includes(newVal) && oldVal === '3dtile')) {
        this.currentBaseUrl = '';
      }
      // If switching from '3dmodel' to another type, clear the selected file
      if (oldVal === '3dmodel' && newVal !== '3dmodel') {
        this.selectedFile = null; // Clear selected file when switching data type
      }
    }
  },
  created() {
    // Subscribe to success and error events from DataAddService
    this.successSubscription = DataAddService.submissionSuccess$.subscribe(message => {
      this.resetForm();
      // Optionally show a success notification here
      console.log("Data added successfully:", message);
    });

    this.errorSubscription = DataAddService.submissionError$.subscribe(errorMessage => {
      // Handle error message, e.g., show a toast notification
      console.error("Submission Error:", errorMessage);
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
      // This method now handles non-3dmodel data types and services.
      // 3D model specific submission is handled after the popup.
      // If it's a 3D model, it should have been handled by handleOpenThreeDModelForm
      // If it's a 3D model *and* there's no file, it means it's a URL-based 3D model
      if (payload.contentType === '3dmodel' && !this.selectedFile) {
        // This case would be for direct URL input for 3D models without a file upload.
        // The GeoSpatialForm should emit 'open-three-d-model-form' even for URL-based models
        // if you want the popup for coordinates/scale. If not, you'd handle it here directly.
        // For consistency, we'll assume the popup is always used for 3D models.
        console.warn("3D Model submission without file selected or open-three-d-model-form not triggered. Check logic.");
        // If you had a direct URL input for 3D models without the popup, you'd process it here:
        // DataAddService.processGeoSpatialSubmission(payload, null); // Pass null for file
        return; // Prevent double-processing if handleOpenThreeDModelForm will be called
      }

      DataAddService.processGeoSpatialSubmission(payload, this.selectedFile);
    },
    // Method to handle the event emitted by GeoSpatialForm for 3D model configuration
    handleOpenThreeDModelForm(payload) {
      const { contentName, file } = payload; // 'file' here is the specific file selected for the 3D model

      // IMPORTANT: Ensure 'this.selectedFile' is set from the GeoSpatialForm's file input
      // This is crucial because handleOpenThreeDModelForm might be called directly,
      // or if GeoSpatialForm emits file-selected separately.
      // Assuming file-selected event always fires first, this.selectedFile should be up-to-date.
      // If not, you might want to re-check the `file` param vs `this.selectedFile`.
      // For this update, we'll use the `file` param directly since it's passed from the form.
      const fileToProcess = file || this.selectedFile; // Use payload.file first, fallback to this.selectedFile

      console.log("Attempting to open 3D Model Form Popup for:", contentName, "with file:", fileToProcess);

      // Trigger the PopupService to show the ThreeDModelFormPopup
      PopupService.showThreeDModelForm({
        component: ThreeDModelFormPopup, // Explicitly tell PopupService which component to use
        // Pass contentName and the actual file object to the popup
        contentName: contentName,
        file: fileToProcess, // <--- IMPORTANT: Pass the actual File object here

        // Pass initial values for positioning and scaling.
        // These can be user-defined defaults or smart guesses.
        // Using current location (Ahmedabad) as default:
        longitude: 72.5714,
        latitude: 23.0225,
        scale: 1.0,
        minimumPixelSize: 128,
        maximumScale: 20000,
        // Callbacks for when the user interacts with the popup
        onStart: (modelOptions) => {
          // This is called when the user clicks "Add Model" in the ThreeDModelFormPopup
          console.log("Model options received from popup:", modelOptions);

          // Construct the final payload for DataAddService
          const fullPayload = {
            selectedOption: 'data',
            contentName: contentName, // Use the name from GeoSpatialForm
            contentType: '3dmodel',
            modelOptions: modelOptions, // The configuration (lat, lon, scale, etc.) from the popup
          };

          // <--- IMPORTANT: Pass the original file as the second argument to processGeoSpatialSubmission
          DataAddService.processGeoSpatialSubmission(fullPayload, fileToProcess);
          // The form should typically reset after a successful submission,
          // which is handled by the subscription in `created()`.
        },
        onCancel: () => {
          console.log("3D Model configuration cancelled.");
          this.selectedFile = null; // Clear the selected file in parent state if the user cancels
          // You might also want to tell GeoSpatialForm to clear its file input if it holds its own state.
          // This is typically done by emitting an event from here to GeoSpatialForm if `selectedFile` isn't
          // directly tied to its input via v-model.
        }
      });
    },
    resetForm() {
      // Reset all form fields after successful submission or explicit cancellation
      this.currentName = '';
      this.currentBaseUrl = '';
      this.currentArgsInput = '';
      this.currentLegendOptionsInput = '';
      this.selectedFile = null; // Ensure file is cleared
      this.selectedOption = 'data'; // Reset to default tab
      this.currentType = 'geojson'; // Reset to default type for data
    }
  },
};
</script>

<style scoped>
/* Any styles specific to the AddDataSidebar container if needed */
</style>
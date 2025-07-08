<template>
  <div v-if="showPopup" class="service-added-popup-overlay">
    <div class="service-added-popup poppins-font">
      <h5 class="popup-title">Successfully added Service</h5>
      <div class="popup-content">
        <div class="popup-item">
          <span class="info-label">Layer:</span>
          <span class="info-value">{{ serviceParameters.layerName }}</span>
        </div>
        <div class="popup-item">
          <span class="info-label">SRS:</span>
          <span class="info-value">{{ serviceParameters.srs }}</span>
        </div>
        <div class="popup-item">
          <span class="info-label">Extent:</span>
          <span class="info-value">{{ serviceParameters.extent }}</span>
        </div>
      </div>
      <button @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
    </div>
  </div>
</template>

<script>
// Import PopupService from the centralized controller.js
import { PopupService } from '../../../../services/controller.js';

export default {
  name: 'AppPopup', 
  data() {
    return {
      showPopup: false,
      serviceParameters: {
        layerName: '',
        srs: '',
        extent: ''
      },
      visibilitySubscription: null,
      parametersSubscription: null,
    };
  },
  mounted() {
    // Subscribe to changes in the popup's visibility from PopupService [cite: 8, 10]
    this.visibilitySubscription = PopupService.isVisible$.subscribe(isVisible => {
      this.showPopup = isVisible;
    });

    // Subscribe to changes in the popup's parameters from PopupService [cite: 9]
    this.parametersSubscription = PopupService.parameters$.subscribe(params => {
      this.serviceParameters = params;
    });
  },
  beforeUnmount() {
    // Unsubscribe to prevent memory leaks when the component is destroyed
    if (this.visibilitySubscription) {
      this.visibilitySubscription.unsubscribe();
    }
    if (this.parametersSubscription) {
      this.parametersSubscription.unsubscribe();
    }
  },
  methods: {
    // Method to hide the popup by calling PopupService's hide method [cite: 10]
    hidePopup() {
      PopupService.hide();
    }
    // Note: ogetD() and osubmitForm() from Popup Form diagram [cite: 11, 12] are not on the display popup itself.
    // They are typically part of the form that provides data to the popup.
  },
};
</script>

<style scoped>
/* Scoped styles specific to this popup component */
.service-added-popup-overlay {
  position: fixed; /* Changed to fixed for consistency as a global overlay */
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Ensure it's above other elements */
}

.service-added-popup {
  /* Inherited from SceneInfo styles for visual consistency */
  background-color: rgba(30, 30, 30, 0.7); /* Semi-transparent dark background */
  color: white; /* White text color */
  padding: 15px 20px; /* Padding inside the container */
  border-radius: 10px; /* Rounded corners */
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3); /* Subtle shadow for depth */
  backdrop-filter: blur(5px); /* Blurs content behind the element */
  -webkit-backdrop-filter: blur(5px); /* Safari support for backdrop-filter */

  /* Original popup specific styles */
  width: 300px;
  text-align: left;
  font-family: 'Poppins', sans-serif; /* Consistent font */
}

.popup-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff; /* Blue title color, consistent with SceneInfo */
  border-bottom: 1px solid rgba(255, 255, 255, 0.2); /* Light separator line */
  padding-bottom: 8px;
}

.popup-content {
  margin-bottom: 15px; /* Add some space before the button */
}

.popup-item {
  display: flex; /* Uses flexbox for label and value alignment */
  justify-content: space-between; /* Pushes label to left, value to right */
  margin-bottom: 5px;
  font-size: 0.95em; /* Consistent with SceneInfo info-item */
}

.info-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8); /* Slightly transparent white for labels */
}

.info-value {
  color: rgba(255, 255, 255, 0.95); /* Nearly opaque white for values */
  text-align: right;
  word-break: break-word; /* Ensure long values wrap */
}

.close-popup-btn {
  margin-top: 20px;
  width: 100%;
}
</style>
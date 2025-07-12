<template>
  <div v-if="showPopup" class="unified-popup-overlay">
    <div class="unified-popup poppins-font">

      <template v-if="currentPopupType === 'serviceAdded'">
        <h5 class="popup-title">Successfully added Service</h5>
        <div class="popup-content">
          <div class="popup-item">
            <span class="info-label">Layer:</span>
            <span class="info-value">{{ popupData.layerName }}</span>
          </div>
          <div class="popup-item">
            <span class="info-label">SRS:</span>
            <span class="info-value">{{ popupData.srs }}</span>
          </div>
          <div class="popup-item">
            <span class="info-label">Extent:</span>
            <span class="info-value">{{ popupData.extent }}</span>
          </div>
        </div>
        <button @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
      </template>

      <template v-else-if="currentPopupType === 'toolInstruction'">
        <h5 class="popup-title">{{ popupData.title || 'Tool Instructions' }}</h5>
        <div class="popup-content">
          <p>{{ popupData.message }}</p>
        </div>
        <button v-if="popupData.showDismissButton !== false" @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
      </template>

      <template v-else>
        <h5 class="popup-title">Information</h5>
        <div class="popup-content">
          <p>No specific popup content defined for this type.</p>
        </div>
        <button @click="hidePopup" class="btn btn-primary close-popup-btn">OK</button>
      </template>

    </div>
  </div>
</template>

<script>
// Adjust this path if your Popup.vue is not directly in src/components/
import { PopupService } from '../../services/PopupService.js';

export default {
  name: 'AppPopup', // Your component is named 'Popup' in App.vue import, 'AppPopup' internally. That's fine.
  data() {
    return {
      showPopup: false,
      currentPopupType: null,
      popupData: {},
      visibilitySubscription: null,
      contentSubscription: null,
    };
  },
  mounted() {
    this.visibilitySubscription = PopupService.isVisible$.subscribe(isVisible => {
      this.showPopup = isVisible;
    });

    this.contentSubscription = PopupService.popupContent$.subscribe(content => {
      console.log('AppPopup received popupContent:', content); // KEEP THIS FOR DEBUGGING!
      this.currentPopupType = content.type;
      this.popupData = content.data;
    });
  },
  beforeUnmount() {
    if (this.visibilitySubscription) {
      this.visibilitySubscription.unsubscribe();
    }
    if (this.contentSubscription) {
      this.contentSubscription.unsubscribe();
    }
  },
  methods: {
    hidePopup() {
      PopupService.hide();
    }
  },
};
</script>

<style scoped>
/* Unified styles for both types of popups */
.unified-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.unified-popup {
  background-color: rgba(30, 30, 30, 0.7);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  width: 350px;
  text-align: center;
  font-family: 'Poppins', sans-serif;
}

.popup-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
}

.popup-content {
  margin-bottom: 15px;
}

.popup-content p {
  font-size: 1em;
  line-height: 1.5;
}

.popup-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.95em;
  text-align: left;
}

.info-label {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.info-value {
  color: rgba(255, 255, 255, 0.95);
  text-align: right;
  word-break: break-word;
}

.close-popup-btn {
  margin-top: 10px;
  width: 100%;
}
</style>
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

      <template v-else-if="currentPopupType === 'confirmation'">
        <h5 class="popup-title">{{ popupData.title || 'Confirm Action' }}</h5>
        <div class="popup-content">
          <p>{{ popupData.message }}</p>
        </div>
        <div class="popup-actions">
          <button @click="confirm(false)" class="btn btn-secondary action-btn">
            {{ popupData.cancelText || 'Cancel' }}
          </button>
          <button @click="confirm(true)" class="btn btn-danger action-btn">
            {{ popupData.confirmText || 'Confirm' }}
          </button>
        </div>
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
import { PopupService } from '../../services/PopupService.js'; // Ensure correct path based on your project structure

export default {
  name: 'AppPopup',
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
      console.log('AppPopup received popupContent:', content);
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
    },
    // Method to handle confirmation button clicks, which resolves the promise in PopupService
    confirm(result) {
      PopupService.resolveConfirmation(result);
    }
  },
};
</script>

<style scoped>
/* Ensure Poppins font is available globally or imported here if needed */
/* @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap'); */

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

/* Unified styles for all popups */
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
  z-index: 2000; /* Ensure popup is on top */
}

.unified-popup {
  background-color: rgba(30, 30, 30, 0.7);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  width: 350px; /* Fixed width for consistency */
  text-align: center;
  font-family: 'Poppins', sans-serif;
}

.popup-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff; /* Primary accent color */
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

/* Updated Styles for confirmation buttons */
.popup-actions {
  margin-top: 15px; /* Added more space above buttons */
  display: flex;
  justify-content: center; /* Centered the buttons */
  gap: 20px; /* Increased gap for better visual separation */
}

.action-btn {
  padding: 8px 18px; /* Slightly more padding for better size */
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.95em; /* Slightly larger font */
  font-weight: 500; /* Bolder text for clarity */
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px; /* Ensures consistent button width */
}

.btn-secondary {
  background-color: #555;
  color: white;
  border: 1px solid #666;
}

.btn-secondary:hover {
  background-color: #666;
  border-color: #777;
}

/* --- CHANGED: btn-danger to consistent orange for delete actions --- */
.btn-danger {
  background-color: #FF6600; /* Consistent orange for delete actions */
  color: white;
  border: 1px solid #FF6600;
}

.btn-danger:hover {
  background-color: #FF9933; /* Lighter orange on hover */
  border-color: #FF9933;
}

.close-popup-btn {
  margin-top: 10px;
  width: 100%;
}
</style>
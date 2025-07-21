<template>
  <div class="service-added-popup-content popup-content">
    <div class="popup-item">
      <span class="info-label">Layer:</span>
      <span class="info-value">{{ layerName }}</span>
    </div>
    <div class="popup-item">
      <span class="info-label">SRS:</span>
      <span class="info-value">{{ srs }}</span>
    </div>
    <div class="popup-item">
      <span class="info-label">Extent:</span>
      <span class="info-value">{{ extent }}</span>
    </div>
    <button @click="onClose" class="btn btn-primary close-popup-btn">
      OK
    </button>
  </div>
</template>

<script>
export default {
  name: "ServiceAddedPopup",
  props: {
    layerName: {
      type: String,
      required: true,
    },
    srs: {
      type: String,
      required: true,
    },
    extent: {
      type: String,
      required: true,
    },
    onClose: {
      type: Function,
      required: true,
    },
  },
};
</script>

<style scoped>
/* You can either include the relevant styles directly here or rely on global styles */
/* For simplicity, if these styles are truly generic and used by many popups,
   you might keep them in a shared CSS file or in Popup.vue's style block.
   However, if they are specific to this layout, put them here. */

.service-added-popup-content {
  /* Inherits .popup-content styles from Popup.vue via unified-popup */
  text-align: left;
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
  background-color: #007bff;
  color: white;
  border: 1px solid #007bff;
}

.close-popup-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
  transform: translateY(-2px);
}
</style>
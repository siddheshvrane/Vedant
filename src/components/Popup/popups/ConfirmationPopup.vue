<template>
  <div class="unified-popup poppins-font">
    <div class="popup-header-common" @mousedown="startDrag">
      <h5 class="popup-title">{{ title || "Confirm Action" }}</h5>
      <button @click="cancel" class="close-btn" title="Close">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="popup-content">
      <p>{{ message }}</p>
    </div>

    <div class="popup-actions">
      <button @click="cancel" class="btn btn-secondary action-btn">
        {{ cancelText || "Cancel" }}
      </button>
      <button @click="confirm" class="btn btn-danger action-btn">
        {{ confirmText || "Confirm" }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: "ConfirmationPopup",
  props: {
    // Data for the confirmation popup
    title: {
      type: String,
      default: "Confirm Action",
    },
    message: {
      type: String,
      required: true,
    },
    confirmText: {
      type: String,
      default: "Confirm",
    },
    cancelText: {
      type: String,
      default: "Cancel",
    },
    // Callback functions for actions
    onConfirm: {
      type: Function,
      required: true,
    },
    onCancel: {
      type: Function,
      required: true,
    },
  },
  data() {
    return {
      popupPosition: { x: 0, y: 0 },
      dragOffset: { x: 0, y: 0 },
      dragging: false,
    };
  },
  methods: {
    confirm() {
      this.onConfirm();
    },
    cancel() {
      this.onCancel();
    },
    startDrag(event) {
      this.dragging = true;
      this.dragOffset = {
        x: event.clientX - this.popupPosition.x,
        y: event.clientY - this.popupPosition.y,
      };
      document.addEventListener("mousemove", this.onDrag);
      document.addEventListener("mouseup", this.stopDrag);
    },
    onDrag(event) {
      if (!this.dragging) return;
      this.popupPosition = {
        x: event.clientX - this.dragOffset.x,
        y: event.clientY - this.dragOffset.y,
      };
    },
    stopDrag() {
      this.dragging = false;
      document.removeEventListener("mousemove", this.onDrag);
      document.removeEventListener("mouseup", this.stopDrag);
    },
  },
};
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap");

.poppins-font {
  font-family: "Poppins", sans-serif;
}

.unified-popup {
  background-color: rgba(30, 30, 30, 0.9);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  width: 380px;
  text-align: center;
  font-family: "Poppins", sans-serif;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.15);
  /* Added for positioning consistency with how Popup.vue centers popups */
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  cursor: grab; /* Indicate draggable */
}

/* Common header styling for all popups - Mimicking .history-title */
.popup-header-common {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
  position: sticky;
  top: 0;
  background-color: inherit;
  z-index: 10;
}

.popup-title {
  font-size: 1.2em;
  font-weight: 600;
  margin: 0;
  color: #007bff;
  flex-grow: 1;
  text-align: left;
}

/* --- ICON STYLING --- */

.close-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  padding: 5px 8px;
  cursor: pointer;
  transition: transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.close-btn:hover {
  transform: scale(1.1);
}

.close-btn i {
  color: white;
  transition: color 0.2s ease;
}

.close-btn:hover i {
  color: #007bff !important;
}

.popup-content {
  margin-bottom: 15px;
  text-align: left;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95em;
}

.popup-content p {
  font-size: 1em;
  line-height: 1.5;
  margin-bottom: 0;
}

.popup-actions {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  gap: 20px;
}

.action-btn {
  padding: 8px 18px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.95em;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 90px;
}

.btn-secondary {
  background-color: rgba(45, 45, 45, 0.8);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-secondary:hover {
  background-color: rgba(60, 60, 60, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.btn-danger {
  background-color: #ff6600;
  color: white;
  border: 1px solid #ff6600;
}

.btn-danger:hover {
  background-color: #ff9933;
  border-color: #ff9933;
  transform: translateY(-2px);
}
</style>
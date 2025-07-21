<template>
  <div>
    <div class="popup-content">
      <p>{{ message }}</p>
    </div>
    <button
      v-if="showDismissButton !== false"
      @click="handleDismiss"
      class="btn btn-primary close-popup-btn"
    >
      OK
    </button>
  </div>
</template>

<script>
export default {
  name: "ToolInstructionPopup",
  props: {
    message: {
      type: String,
      required: true,
    },
    // The title is handled by the parent Popup.vue's getTitleForCurrentPopup computed property
    // title: {
    //   type: String,
    //   default: "Tool Instructions",
    // },
    showDismissButton: {
      type: Boolean,
      default: true,
    },
    onClose: { // Prop to tell the parent (Popup.vue) to hide itself
        type: Function,
        required: true,
    }
  },
  methods: {
    handleDismiss() {
      this.onClose(); // Call the onClose prop to hide the parent popup
    },
  },
};
</script>

<style scoped>
/* Styles specific to the tool instruction popup content and button - moved from Popup.vue */
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
<template>
  <div v-if="showInstructionPopup" class="tool-instruction-popup-overlay">
    <div class="tool-instruction-popup poppins-font">
      <h5 class="popup-title">{{ instructionTitle }}</h5>
      <div class="popup-content">
        <p>{{ instructionMessage }}</p>
      </div>
      <button v-if="showDismissButton" @click="hideInstructionPopup" class="btn btn-primary close-popup-btn">OK</button>
    </div>
  </div>
</template>

<script>
// Assuming you have a centralized service like PopupService.js for this.
// Let's create one if you don't.
import { ToolInstructionService } from '../../services/tool-instruction-controller.js';

export default {
  name: 'ToolInstructionPopup',
  data() {
    return {
      showInstructionPopup: false,
      instructionTitle: 'Tool Instructions',
      instructionMessage: '',
      showDismissButton: true, // Option to show/hide dismiss button
      visibilitySubscription: null,
      messageSubscription: null,
    };
  },
  mounted() {
    this.visibilitySubscription = ToolInstructionService.isVisible$.subscribe(isVisible => {
      this.showInstructionPopup = isVisible;
    });

    this.messageSubscription = ToolInstructionService.message$.subscribe(params => {
      this.instructionTitle = params.title || 'Tool Instructions'; // Default title
      this.instructionMessage = params.message;
      this.showDismissButton = typeof params.showDismissButton === 'boolean' ? params.showDismissButton : true;
    });
  },
  beforeUnmount() {
    if (this.visibilitySubscription) {
      this.visibilitySubscription.unsubscribe();
    }
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  },
  methods: {
    hideInstructionPopup() {
      ToolInstructionService.hide();
    }
  },
};
</script>

<style scoped>
/* You can largely reuse styles from your service-added-popup here,
   just change class names and adjust minor details. */

.tool-instruction-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000; /* Ensure it's above everything else */
}

.tool-instruction-popup {
  background-color: rgba(30, 30, 30, 0.7);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  width: 350px; /* Adjust width as needed */
  text-align: center; /* Center the text for instructions */
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

.popup-content p {
  font-size: 1em;
  margin-bottom: 15px;
  line-height: 1.5;
}

.close-popup-btn {
  margin-top: 10px; /* Adjust spacing */
  width: 100%;
}
</style>
<template>
  <div>
    <div class="loading-screen" v-if="localLoading">
      <img :src="vedantLogoSrc" alt="Vedant Logo" class="vedant-logo-img-loading fade-in" />
      <img :src="spaceImageSrc" alt="Space Background" class="space-image" />
    </div>

    <div
      id="vedantLogo"
      v-show="!localLoading"
      :class="{ 'vedant-logo-container-final-pos': localGlobeLogoFinalPosition }"
    >
      <img :src="vedantLogoSrc" alt="Vedant Logo" class="vedant-logo-img-globe" />
      <div class="copyright-text" :class="{ 'copyright-text-final': localGlobeLogoFinalPosition }">
        Copyright © 2024 - VEDAS, SAC, ISRO.
      </div>
    </div>
  </div>
</template>

<script>
import vedantLogo from '../assets/vedant_Logo_white.png';
import spaceImage from '../assets/space.jpg';
import { UserInterfaceService } from '../services/controller.js'; // Import the service

export default {
  name: 'ProjectLogo',
  data() {
    return {
      vedantLogoSrc: vedantLogo,
      spaceImageSrc: spaceImage,
      localLoading: true, // Manages the loading screen visibility
      localGlobeLogoFinalPosition: false, // Manages the logo's final position transition
    };
  },
  mounted() {
    // First timeout: Controls the duration of the overall loading screen
    setTimeout(() => {
      this.localLoading = false; // Hide the loading screen

      // *** IMPORTANT CHANGE HERE ***
      // Instead of emitting, call the UserInterfaceService method
      UserInterfaceService.notifyProjectLogoReady(); // Signal to the service that ProjectLogo is done

      // Second timeout: Allows a small delay before the logo transitions to its final position
      // This is wrapped in $nextTick to ensure DOM updates for v-show are processed
      this.$nextTick(() => {
        setTimeout(() => {
          this.localGlobeLogoFinalPosition = true; // Trigger the logo's final position CSS transition
        }, 100); // Small delay to allow CSS transitions to look smooth
      });
    }, 3000); // The loading screen will show for 3 seconds
  },
};
</script>

<style scoped>
/* Styles for the loading screen and logo animation */
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999; /* Ensures it's above everything during loading */
  overflow: hidden;
}

.vedant-logo-img-loading {
  width: 400px;
  height: auto;
  object-fit: contain;
  margin-bottom: 20px;
  opacity: 0;
  animation: fadeIn 2s forwards;
  animation-delay: 0.5s;
}

.space-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: -1; /* Ensures it's behind the logo */
  opacity: 0.7;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Styles for the logo's final position on the globe */
#vedantLogo {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(1);
  width: 400px;
  height: auto;
  opacity: 1;
  z-index: 1000; /* Ensure it's above the globe */
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  transition: all 1.2s ease-out; /* Smooth transition for final position */
}

#vedantLogo.vedant-logo-container-final-pos {
  top: 100%;
  left: 100%;
  transform: translate(calc(-100% - 5px), calc(-100% - 5px)) scale(0.7); /* Adjusted scale and position */
  width: 280px; /* Final width of the logo */
}

.vedant-logo-img-globe {
  width: 100%;
  height: auto;
  object-fit: contain;
  margin-bottom: 0;
}

.copyright-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 1em;
  text-shadow: 0 0 3px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  opacity: 0; /* Initially hidden */
  transition: opacity 0.8s ease-out 0.4s; /* Fade in with a delay */
}

.copyright-text.copyright-text-final {
  opacity: 1; /* Fully visible in final position */
}
</style>
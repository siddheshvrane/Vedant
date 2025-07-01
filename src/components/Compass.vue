<template>
  <div id="northArrow" @click="onClick" v-show="isVisible">
    <img :src="compassSrc" alt="North Arrow" class="north-arrow-img" :style="{ transform: `rotate(${angle}deg)` }" />
  </div>
</template>

<script>
import * as Cesium from 'cesium'; // Needed for Cesium.Math and camera properties
import { MapService } from '../services.js';
import compassImage from '../assets/compass.png';

export default {
  name: 'Compass',
  props: {
    // Globe component will pass its Cesium viewer instance here
    viewer: {
      type: Object, // Cesium.Viewer instance
      required: true
    },
    // The v-show binding from Globe.vue can be passed as a prop
    isVisible: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      compassSrc: compassImage,
      angle: 0.0, // Corresponds to 'angle: float' in diagram [cite: 161]
      mapViewSubscription: null,
      postRenderListener: null,
    };
  },
  mounted() {
    // Corresponds to 'onGlobeViewUpdate' handler in diagram [cite: 164]
    // The compass needs to react to view updates to rotate
    this.mapViewSubscription = MapService.updateView$.subscribe(this.onGlobeViewUpdate);

    // Additionally, subscribe to Cesium's postRender for smooth, continuous rotation updates
    // This is more direct than relying solely on MapService.updateView$ if it's less frequent.
    if (this.viewer) {
      this.postRenderListener = () => {
        const heading = this.viewer.camera.heading;
        // Convert radians to degrees and negate for correct CSS rotation
        // Cesium heading is clockwise, CSS rotate() is counter-clockwise for positive values.
        this.angle = -Cesium.Math.toDegrees(heading);
      };
      this.viewer.scene.postRender.addEventListener(this.postRenderListener);
      // Set initial angle immediately after mounting if viewer is available
      this.angle = -Cesium.Math.toDegrees(this.viewer.camera.heading);
    }
  },
  beforeUnmount() {
    // Unsubscribe from RxJS observable
    if (this.mapViewSubscription) {
      this.mapViewSubscription.unsubscribe();
    }
    // Remove Cesium postRender event listener
    if (this.viewer && this.postRenderListener) {
      this.viewer.scene.postRender.removeEventListener(this.postRenderListener);
    }
  },
  methods: {
    // Corresponds to 'onClick(): void' in diagram [cite: 163]
    onClick() {
      // Triggers MapService: Redirect Globe [cite: 163] (implemented as orientToNorth in MapService)
      MapService.orientToNorth();
    },
    // Corresponds to 'onGlobeViewUpdate(viewData: any): void' in diagram [cite: 164]
    onGlobeViewUpdate(viewData) {
      // Update the angle based on the viewData from MapService
      // This is an alternative/redundant update path if `postRender` listener is used directly
      // However, keeping it as it directly matches the class diagram.
      if (viewData && typeof viewData.angle === 'number') {
        // Use the angle from viewData (which should be in degrees)
        this.angle = -viewData.angle; // Negate for CSS rotation
      }
    },
    // Corresponds to 'displayArrow(): void' in diagram [cite: 162]
    // In Vue, this is implicitly handled by the template's v-show and :style binding.
    // We don't need a separate method for 'displayArrow' unless it involves more complex logic.
  }
};
</script>

<style scoped>
/* Styles specific to the Compass component */
#northArrow {
  position: absolute;
  top: 80px;
  right: 20px;
  width: 80px;
  height: 80px;
  z-index: 1000;
  cursor: pointer;
  /* transition on transform is now handled directly by the angle property for smoother updates via Cesium events */
}
#northArrow .north-arrow-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
</style>
<template>
  <div id="northArrow" @click="onClick" v-show="isVisible">
    <img :src="compassSrc" alt="North Arrow" class="north-arrow-img" :style="{ transform: `rotate(${angle}deg)` }" />
  </div>
</template>

<script>
import * as Cesium from 'cesium'; // Required for Cesium.Math and accessing viewer camera properties.
import { MapService } from '../services.js'; // Imports the singleton MapService for communication.
import compassImage from '../assets/compass.png'; // Path to the compass image asset.

export default {
  name: 'Compass',
  props: {
    // Receives the Cesium Viewer instance from the parent (Globe.vue).
    // This is crucial for interacting with the globe's camera.
    viewer: {
      type: Object, // Expects a Cesium.Viewer object.
      required: true
    },
    // Controls the visibility of the compass component, typically bound to Globe's `isGlobeReady`.
    isVisible: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {
      compassSrc: compassImage,
      angle: 0.0, // Current rotation angle of the compass arrow in degrees.
      mapViewSubscription: null, // Holds the subscription to MapService.updateView$ for cleanup.
      postRenderListener: null,  // Holds the Cesium event listener for cleanup.
    };
  },
  /**
   * @Lifecycle Hook: mounted
   * Subscribes to map view updates and Cesium's `postRender` event to keep the compass oriented.
   */
  mounted() {
    // Subscribe to MapService for general view updates. This is one way to receive camera info.
    this.mapViewSubscription = MapService.updateView$.subscribe(this.onGlobeViewUpdate);

    // Additionally, subscribe directly to Cesium's `postRender` event.
    // This provides very frequent updates (every frame), ensuring smooth and immediate compass rotation
    // as the user interacts with the globe. It directly updates `this.angle` based on camera heading.
    if (this.viewer) {
      this.postRenderListener = () => {
        const heading = this.viewer.camera.heading;
        // Convert Cesium's radian heading to degrees and negate for CSS rotation property.
        this.angle = -Cesium.Math.toDegrees(heading);
      };
      this.viewer.scene.postRender.addEventListener(this.postRenderListener);
      // Set initial angle immediately after mounting.
      this.angle = -Cesium.Math.toDegrees(this.viewer.camera.heading);
    }
  },
  /**
   * @Lifecycle Hook: beforeUnmount
   * Important for preventing memory leaks by unsubscribing from RxJS observables
   * and removing Cesium event listeners before the component is destroyed.
   */
  beforeUnmount() {
    if (this.mapViewSubscription) {
      this.mapViewSubscription.unsubscribe();
    }
    if (this.viewer && this.postRenderListener) {
      this.viewer.scene.postRender.removeEventListener(this.postRenderListener);
    }
  },
  methods: {
    /**
     * @method onClick
     * Triggered when the compass component is clicked.
     * Emits an event via MapService to orient the globe to North.
     */
    onClick() {
      MapService.orientToNorth();
    },
    /**
     * @method onGlobeViewUpdate
     * Callback for `MapService.updateView$` subscription.
     * Updates the compass angle based on the `viewData` provided by MapService.
     * While `postRenderListener` handles continuous updates, this method ensures
     * consistency if updates also come through the MapService channel.
     * @param {Object} viewData - Contains `angle` property (in degrees) representing camera heading.
     */
    onGlobeViewUpdate(viewData) {
      if (viewData && typeof viewData.angle === 'number') {
        this.angle = -viewData.angle; // Negate for CSS rotation.
      }
    },
  }
};
</script>

<style scoped>
/* Scoped styles ensure these CSS rules only apply to this component. */
#northArrow {
  position: absolute; /* Positions the compass relative to its parent (#mapWrapper). */
  top: 80px;         /* Distance from the top of the parent. */
  right: 20px;       /* Distance from the right of the parent. */
  width: 80px;
  height: 80px;
  z-index: 1000;     /* Ensures the compass is above other map elements. */
  cursor: pointer;   /* Indicates the element is clickable. */
}
#northArrow .north-arrow-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain; /* Ensures the image fits within its container without distortion. */
}
</style>
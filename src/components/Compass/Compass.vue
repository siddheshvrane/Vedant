<template>
  <div id="northArrow" @click="onClick" v-show="isVisible">
    <img :src="compassSrc" alt="North Arrow" class="north-arrow-img" :style="{ transform: `rotate(${angle}deg)` }" />
  </div>
</template>

<script>
import * as Cesium from 'cesium';
import { MapService } from '../../controller.js'; // Imports the singleton MapService for communication.
import compassImage from '../../assets/compass.png'; // Corrected path to the compass image asset.

export default {
  name: 'Compass',
  props: {
    viewer: { // Keeping for App.vue's v-if, but not relying on it directly.
      type: Object,
      required: false,
      default: null
    },
    // Controls the visibility of the compass component, typically bound to App.vue's `globeIsReady`.
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
      globeViewerSubscription: null, // Subscription to get the Cesium viewer instance
      internalViewer: null,      // To store the Cesium viewer instance received from the service
    };
  },
  /**
   * @Lifecycle Hook: mounted
   * Subscribes to MapService observables to get the Cesium viewer and view updates.
   */
  mounted() {
    // Subscribe to MapService to get the Cesium viewer instance
    this.globeViewerSubscription = MapService.globeViewer$.subscribe(viewer => {
      this.internalViewer = viewer; // Store the viewer instance

      if (this.internalViewer) {
        // If viewer is available, attach the postRender listener
        if (this.postRenderListener) {
            this.internalViewer.scene.postRender.removeEventListener(this.postRenderListener);
        }
        this.postRenderListener = () => {
          const heading = this.internalViewer.camera.heading;
          this.angle = -Cesium.Math.toDegrees(heading);
        };
        this.internalViewer.scene.postRender.addEventListener(this.postRenderListener);
        this.angle = -Cesium.Math.toDegrees(this.internalViewer.camera.heading); // Set initial angle
      } else if (this.postRenderListener) {
        // If viewer becomes null (e.g., globe destroyed), remove listener
        if (this.internalViewer) {
          this.internalViewer.scene.postRender.removeEventListener(this.postRenderListener);
        }
        this.postRenderListener = null;
      }
    });

    // Subscribe to MapService for general view updates
    this.mapViewSubscription = MapService.updateView$.subscribe(this.onGlobeViewUpdate);
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
    if (this.globeViewerSubscription) {
      this.globeViewerSubscription.unsubscribe();
    }
    if (this.internalViewer && this.postRenderListener) {
      this.internalViewer.scene.postRender.removeEventListener(this.postRenderListener);
    }
  },
  methods: {
    /**
     * @method onClick
     * Triggered when the compass component is clicked.
     * UPDATED: Now directly implements the orientToNorth functionality
     */
    onClick() {
      console.log('Compass: Orient to North clicked');
      
      // Send signal via MapService (in case other components need to know)
      MapService.orientToNorth();
      
      // Direct implementation for immediate functionality
      if (this.internalViewer) {
        const currentCameraPosition = this.internalViewer.camera.positionCartographic;
        const longitude = Cesium.Math.toDegrees(currentCameraPosition.longitude);
        const latitude = Cesium.Math.toDegrees(currentCameraPosition.latitude);
        const height = currentCameraPosition.height;
        const currentPitch = this.internalViewer.camera.pitch;
        const currentRoll = this.internalViewer.camera.roll;

        console.log('Compass: Orienting camera to North');
        this.internalViewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
          orientation: {
            heading: Cesium.Math.toRadians(0.0), // North is 0 degrees
            pitch: currentPitch,
            roll: currentRoll
          },
          duration: 1.5
        });
      } else {
        console.warn('Compass: No viewer available for orient to North operation');
      }
    },
    /**
     * @method onGlobeViewUpdate
     * Callback for `MapService.updateView$` subscription.
     * Updates the compass angle based on the `viewData` provided by MapService.
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
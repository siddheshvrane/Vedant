<template>
  <!-- Standalone plugin popup window (no overlay) -->
  <template v-if="isPluginPopup && popupComponent">
    <div
      class="plugin-popup-wrapper"
      :style="pluginPopupStyle"
      @mousedown="startPluginDrag($event)">
      <component :is="popupComponent" v-bind="popupData" />
      <div class="resize-handle" @mousedown="startPluginResize"></div>
    </div>
  </template>

  <!-- Normal popups with overlay -->
  <div v-else-if="showPopup" class="unified-popup-overlay">
    <template v-if="currentPopupType === 'confirmation'">
      <ConfirmationPopup
        :title="popupData.title"
        :message="popupData.message"
        :confirmText="popupData.confirmText"
        :cancelText="popupData.cancelText"
        :onConfirm="popupData.onConfirm"
        :onCancel="popupData.onCancel" />
    </template>

    <div
      v-else
      class="unified-popup poppins-font"
      :style="
        ['terrainProfileStats'].includes(currentPopupType) ? popupStyle : {}
      ">
      <!-- HEADER (only for non-plugin popups) -->
      <div
        v-if="!isPluginPopup"
        class="popup-header-common"
        @mousedown="startDrag($event)">
        <h5 class="popup-title">{{ getTitleForCurrentPopup }}</h5>
        <button @click="hidePopup" class="close-btn" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <!-- COMPONENT-BASED POPUP -->
      <template v-if="popupComponent">
        <component :is="popupComponent" v-bind="popupData" />
      </template>

      <!-- TYPE-BASED POPUPS -->
      <template v-else-if="currentPopupType === 'serviceAdded'">
        <ServiceAddedPopup
          :layerName="popupData.layerName"
          :srs="popupData.srs"
          :extent="popupData.extent"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'toolInstruction'">
        <ToolInstructionPopup
          :message="popupData.message"
          :title="popupData.title"
          :showDismissButton="popupData.showDismissButton"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'viewshedForm'">
        <ViewshedForm
          :observerHeight="popupData.observerHeight"
          :viewDistance="popupData.viewDistance"
          :rayCount="popupData.rayCount"
          :onStart="popupData.onStart"
          :onCancel="popupData.onCancel"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'terrainProfileStats'">
        <TerrainProfileStats
          :profile="popupData.profile"
          :terrainProfileEntity="popupData.entity"
          :onRemoveProfile="handleRemoveProfile"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'threeDModelForm'">
        <ThreeDModelFormPopup
          :url="popupData.url"
          :longitude="popupData.longitude"
          :latitude="popupData.latitude"
          :scale="popupData.scale"
          :minimumPixelSize="popupData.minimumPixelSize"
          :maximumScale="popupData.maximumScale"
          :onStart="popupData.onStart"
          :onCancel="popupData.onCancel"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'flyThroughMode'">
        <FlyThroughModePopup
          :onSelect="popupData.onSelect"
          :onCancel="popupData.onCancel"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'flyThroughForm'">
        <FlyThroughFormPopup
          :height="popupData.height"
          :tilt="popupData.tilt"
          :speed="popupData.speed"
          :duration="popupData.duration"
          :loop="popupData.loop"
          :onStart="popupData.onStart"
          :onCancel="popupData.onCancel"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="dynamicPopupComponent">
        <component
          :is="dynamicPopupComponent"
          v-bind="popupData"
          :onClose="hidePopup" />
      </template>

      <template v-else-if="currentPopupType === 'recordingConfig'">
        <RecordingConfigPopup
          :audioDevices="popupData.audioDevices"
          :currentConfig="popupData.currentConfig"
          :onStart="popupData.onStart"
          :onCancel="popupData.onCancel"
          :onClose="hidePopup"
        />
      </template>

      <template v-else>
        <div class="popup-content">
          <p>No specific popup content defined for this type.</p>
        </div>
        <button @click="hidePopup" class="btn btn-primary close-popup-btn">
          OK
        </button>
      </template>
    </div>
  </div>
</template>

<script>
import { PopupService } from "../../services/PopupService.js";
import ConfirmationPopup from "./popups/ConfirmationPopup.vue";
import ServiceAddedPopup from "./popups/ServiceAddedPopup.vue";
import TerrainProfileStats from "./popups/TerrainProfileStats.vue";
import ViewshedForm from "./popups/ViewshedForm.vue";
import ToolInstructionPopup from "./popups/ToolInstructionPopup.vue";
import ThreeDModelFormPopup from "./popups/ThreeDModelFormPopup.vue";
import FlyThroughModePopup from "./popups/FlyThroughModePopup.vue";
import FlyThroughFormPopup from "./popups/FlyThroughFormPopup.vue";
import RecordingConfigPopup from "./popups/RecordingConfigPopup.vue";
import AudioDeviceSelectionPopup from './popups/AudioDeviceSelectionPopup.vue';
import DownloadRecordingPopup from './popups/DownloadRecordingPopup.vue';

export default {
  name: "AppPopup",
  components: {
    ConfirmationPopup,
    ServiceAddedPopup,
    TerrainProfileStats,
    ViewshedForm,
    ToolInstructionPopup,
    ThreeDModelFormPopup,
    FlyThroughModePopup,
    FlyThroughFormPopup,
    RecordingConfigPopup,
    AudioDeviceSelectionPopup,
    DownloadRecordingPopup,
  },
  data() {
    return {
      showPopup: false,
      currentPopupType: null,
      popupComponent: null, // NEW: For component-based popups
      popupData: {},
      visibilitySubscription: null,
      contentSubscription: null,
      popupPosition: { x: 0, y: 0 },
      dragOffset: { x: 0, y: 0 },
      dragging: false,
      pluginPopupPosition: { x: 150, y: 150 },
      pluginPopupSize: { width: 800, height: 500 },
      pluginDragging: false,
      pluginResizing: false,
      pluginDragOffset: { x: 0, y: 0 },
      pluginResizeStart: {},
    };
  },
  computed: {
    pluginPopupStyle() {
      return {
        position: "fixed", // change to fixed so it stays in viewport
        top: this.pluginPopupPosition.y + "px",
        left: this.pluginPopupPosition.x + "px",
        width: this.pluginPopupSize.width + "px",
        height: this.pluginPopupSize.height + "px",
        background: "rgba(30,30,30,0.95)",
        border: "1px solid rgba(255,255,255,0.2)",
        zIndex: 3000,
      };
    },
    isPluginPopup() {
      return this.popupData?.tabs !== undefined; // tabs array means it's a plugin popup
    },
    dynamicPopupComponent() {
      if (typeof window === "undefined") return null;
      const registry = window.__popupRegistry || {};
      return registry[this.currentPopupType] || null;
    },
    popupStyle() {
      if (!["terrainProfileStats"].includes(this.currentPopupType)) {
        return {};
      }

      const popupWidth = 1200;
      const defaultX = (window.innerWidth - popupWidth) / 2;
      const defaultY = (window.innerHeight - 750) / 2;

      const left = this.popupPosition.x === 0 ? defaultX : this.popupPosition.x;
      const top = this.popupPosition.y === 0 ? defaultY : this.popupPosition.y;

      return {
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popupWidth}px`,
        cursor: this.dragging ? "grabbing" : "grab",
      };
    },
    getTitleForCurrentPopup() {
      // NEW: Handle title from component-based popups
      if (this.popupComponent && this.popupData.title) {
        return this.popupData.title;
      }

      // EXISTING: Handle titles for type-based popups
      switch (this.currentPopupType) {
        case "serviceAdded":
          return "Successfully Added Service";
        case "toolInstruction":
          return this.popupData.title || "Tool Instructions";
        case "viewshedForm":
          return "Viewshed Parameters";
        case "terrainProfileStats":
          return "Terrain Profile";
        case "threeDModelForm":
          return "Add 3D Model";
        case "flyThroughMode":
          return "Select Fly-Through Mode";
        case "flyThroughForm":
          return "Fly-Through Configuration";
        case "recordingConfig":
          return "Configure Screen Recording";
        default:
          return "Information";
      }
    },
  },
  mounted() {
    this.visibilitySubscription = PopupService.isVisible$.subscribe(
      (isVisible) => {
        this.showPopup = isVisible;
      }
    );

    this.contentSubscription = PopupService.popupContent$.subscribe(
      (content) => {
        console.log("AppPopup received popupContent:", content);

        // NEW: Handle component-based popups
        if (content.component) {
          this.popupComponent = content.component;
          this.currentPopupType = null; // Clear type-based popup
          this.popupData = content.props || {};
        } else {
          // EXISTING: Handle type-based popups
          this.popupComponent = null; // Clear component-based popup
          this.currentPopupType = content.type;
          this.popupData = content.props || content.data || {}; // Support both props and data
        }

        // Reset position for non-draggable popups or calculate for draggable ones
        if (["terrainProfileStats"].includes(content.type)) {
          const popupWidth = 1200;
          const popupHeight = 700;
          this.popupPosition = {
            x: (window.innerWidth - popupWidth) / 2,
            y: (window.innerHeight - popupHeight) / 2,
          };
        } else {
          this.popupPosition = { x: 0, y: 0 };
        }
      }
    );

    window.addEventListener(
      "terrain-profile-ready",
      this.handleTerrainProfileReady
    );
  },
  beforeUnmount() {
    if (this.visibilitySubscription) {
      this.visibilitySubscription.unsubscribe();
    }
    if (this.contentSubscription) {
      this.contentSubscription.unsubscribe();
    }
    window.removeEventListener(
      "terrain-profile-ready",
      this.handleTerrainProfileReady
    );
  },
  methods: {
    startPluginDrag(e) {
      if (!this.isPluginPopup) return;
      this.pluginDragging = true;
      this.pluginDragOffset.x = e.clientX - this.pluginPopupPosition.x;
      this.pluginDragOffset.y = e.clientY - this.pluginPopupPosition.y;
      document.addEventListener("mousemove", this.onPluginDrag);
      document.addEventListener("mouseup", this.stopPluginDrag);
    },
    onPluginDrag(e) {
      if (!this.pluginDragging) return;
      this.pluginPopupPosition.x = e.clientX - this.pluginDragOffset.x;
      this.pluginPopupPosition.y = e.clientY - this.pluginDragOffset.y;
    },
    stopPluginDrag() {
      this.pluginDragging = false;
      document.removeEventListener("mousemove", this.onPluginDrag);
      document.removeEventListener("mouseup", this.stopPluginDrag);
    },
    startPluginResize(e) {
      if (!this.isPluginPopup) return;
      this.pluginResizing = true;
      this.pluginResizeStart = {
        x: e.clientX,
        y: e.clientY,
        width: this.pluginPopupSize.width,
        height: this.pluginPopupSize.height,
      };
      document.addEventListener("mousemove", this.onPluginResize);
      document.addEventListener("mouseup", this.stopPluginResize);
    },
    onPluginResize(e) {
      if (!this.pluginResizing) return;
      this.pluginPopupSize.width =
        this.pluginResizeStart.width + (e.clientX - this.pluginResizeStart.x);
      this.pluginPopupSize.height =
        this.pluginResizeStart.height + (e.clientY - this.pluginResizeStart.y);
    },
    stopPluginResize() {
      this.pluginResizing = false;
      document.removeEventListener("mousemove", this.onPluginResize);
      document.removeEventListener("mouseup", this.stopPluginResize);
    },

    startDrag(event) {
      if (!["terrainProfileStats"].includes(this.currentPopupType)) return;
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

    hidePopup() {
      PopupService.hide();
    },
    confirm(result) {
      PopupService.resolveConfirmation(result);
    },
    handleRemoveProfile() {
      this.hidePopup();
    },
    handleTerrainProfileReady(e) {
      PopupService._showInternalTypeBasedPopup("terrainProfileStats", {
        profile: e.detail.profile || [],
        entity: e.detail.entity || null,
        onRemove: () => {
          console.log("Terrain profile removal confirmed by Popup.vue");
        },
      });
      console.log("Popup.vue: Received terrain-profile-ready event.");
    },
  },
};
</script>

<style scoped>
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap");

.poppins-font {
  font-family: "Poppins", sans-serif;
}

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
  background-color: rgba(30, 30, 30, 0.9);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  width: auto;
  min-width: 380px;
  max-width: 90vw;
  text-align: center;
  font-family: "Poppins", sans-serif;
  max-height: 90vh;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.non-blocking {
  pointer-events: none; /* allow clicks to go through overlay */
  background-color: transparent !important;
}

.non-blocking .unified-popup {
  pointer-events: auto; /* still allow interaction with popup itself */
}

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

.plugin-popup-wrapper {
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  overflow: hidden;
}
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  background: rgba(255, 255, 255, 0.3);
  cursor: se-resize;
}

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

.unified-popup::-webkit-scrollbar {
  width: 8px;
}

.unified-popup::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.unified-popup::-webkit-scrollbar-thumb {
  background-color: rgba(0, 123, 255, 0.5);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.unified-popup::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 123, 255, 0.7);
}

.popup-notification {
  padding: 0;
}

.notification-content {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  border-radius: 8px;
  color: white;
}

.notification-content.error {
  background: rgba(220, 53, 69, 0.2);
  border-color: rgba(220, 53, 69, 0.4);
}

.notification-icon {
  font-size: 20px;
  margin-right: 12px;
  margin-top: 2px;
}

.notification-content .notification-icon {
  color: #007bff;
}

.notification-content.error .notification-icon {
  color: #dc3545;
}

.notification-message {
  flex: 1;
}

.notification-message p {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  margin-left: 12px;
  border-radius: 4px;
  transition: background 0.3s ease;
}

.notification-close:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>

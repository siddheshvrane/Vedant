<template>
  <div v-if="showPopup" class="unified-popup-overlay">
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
      :style="currentPopupType === 'terrainProfileStats' ? popupStyle : {}">
      <div class="popup-header-common" @mousedown="startDrag">
        <h5 class="popup-title">{{ getTitleForCurrentPopup }}</h5>
        <button @click="hidePopup" class="close-btn" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>

      <template v-if="currentPopupType === 'serviceAdded'">
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
import { getToolState } from "../../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js";
import ConfirmationPopup from "./popups/ConfirmationPopup.vue";
import ServiceAddedPopup from "./popups/ServiceAddedPopup.vue";
import TerrainProfileStats from "./popups/TerrainProfileStats.vue";
import ViewshedForm from "./popups/ViewshedForm.vue";
import ToolInstructionPopup from "./popups/ToolInstructionPopup.vue";

export default {
  name: "AppPopup",
  components: {
    ConfirmationPopup,
    ServiceAddedPopup,
    TerrainProfileStats,
    ViewshedForm,
    ToolInstructionPopup,
  },
  data() {
    return {
      showPopup: false,
      currentPopupType: null,
      popupData: {},
      visibilitySubscription: null,
      contentSubscription: null,
      popupPosition: { x: 0, y: 0 },
      dragOffset: { x: 0, y: 0 },
      dragging: false,
    };
  },
  computed: {
    popupStyle() {
      if (this.currentPopupType !== "terrainProfileStats") return {};

      const remBase = 16;
      const popupWidth = 75 * remBase;
      const popupHeight = 43.75 * remBase;
      const defaultX = (window.innerWidth - popupWidth) / 2;
      const defaultY = (window.innerHeight - popupHeight) / 2;

      const left = this.popupPosition.x === 0 ? defaultX : this.popupPosition.x;
      const top = this.popupPosition.y === 0 ? defaultY : this.popupPosition.y;

      return {
        position: "absolute",
        left: `${left / remBase}rem`,
        top: `${top / remBase}rem`,
        width: `75rem`,
        cursor: this.dragging ? "grabbing" : "grab",
      };
    },
    getTitleForCurrentPopup() {
      switch (this.currentPopupType) {
        case "serviceAdded":
          return "Successfully Added Service";
        case "toolInstruction":
          return this.popupData.title || "Tool Instructions";
        case "viewshedForm":
          return "Viewshed Parameters";
        case "terrainProfileStats":
          return "Terrain Profile";
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
        this.currentPopupType = content.type;
        this.popupData = content.data;

        if (content.type === "terrainProfileStats") {
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
    if (this.visibilitySubscription) this.visibilitySubscription.unsubscribe();
    if (this.contentSubscription) this.contentSubscription.unsubscribe();
    window.removeEventListener(
      "terrain-profile-ready",
      this.handleTerrainProfileReady
    );
  },
  methods: {
    startDrag(event) {
      if (this.currentPopupType !== "terrainProfileStats") return;
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
      PopupService.show({
        type: "terrainProfileStats",
        data: {
          profile: e.detail.profile || [],
          entity: e.detail.entity || null,
          onRemove: () => {
            console.log("Terrain profile removal confirmed by Popup.vue");
          },
        },
      });
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
  padding: 0.9375rem 1.25rem;
  border-radius: 0.625rem;
  box-shadow: 0 0.25rem 0.9375rem rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(0.5rem);
  -webkit-backdrop-filter: blur(0.5rem);
  width: auto;
  min-width: 23.75rem;
  max-width: 90vw;
  text-align: center;
  font-family: "Poppins", sans-serif;
  max-height: 90vh;
  overflow-y: auto;
  border: 0.0625rem solid rgba(255, 255, 255, 0.15);
}

.popup-header-common {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.625rem;
  border-bottom: 0.0625rem solid rgba(255, 255, 255, 0.2);
  padding-bottom: 0.5rem;
  position: sticky;
  top: 0;
  background-color: inherit;
  z-index: 10;
}

.popup-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin: 0;
  color: #007bff;
  flex-grow: 1;
  text-align: left;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  padding: 0.3125rem 0.5rem;
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
  margin-top: 0.9375rem;
  display: flex;
  justify-content: center;
  gap: 1.25rem;
}

.action-btn {
  padding: 0.5rem 1.125rem;
  border-radius: 0.3125rem;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 5.625rem;
}

.unified-popup::-webkit-scrollbar {
  width: 0.5rem;
}

.unified-popup::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 0.25rem;
}

.unified-popup::-webkit-scrollbar-thumb {
  background-color: rgba(0, 123, 255, 0.5);
  border-radius: 0.25rem;
  border: 0.0625rem solid rgba(255, 255, 255, 0.1);
}

.unified-popup::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 123, 255, 0.7);
}
</style>

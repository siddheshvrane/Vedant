import {
  setupRooftopSolarInsulationTool,
  clearRooftopSolarInsulation,
  updateShadowTime,
} from "./src/RooftopSolarInsulationCore.js";

import RooftopPopup from "./src/Rooftop.vue";
import { MapService } from "../../../../../../services/MapService.js"; // Used if needed for viewer etc.

/** @type {import('@/types/plugin.types').Plugin} */
export default {
  name: "rooftop-solar-insulation",
  title: "Rooftop Solar Insulation",
  subtitle: "Displays seasonal solar insulation for rooftop buildings.",
  pfpUrl: "https://vedas.sac.gov.in/vapps/lama/assets/theme_pics/cityModel.png",
  popupComponent: RooftopPopup,

  enable({ PopupService }) {
    this._context = {
      PopupService,
      defaultOptions: {
        selectedSeason: "average",
        shadowTime: 12,
      },
    };

    // Register popup for type-based rendering
    if (this.popupComponent && typeof window !== "undefined") {
      const registry = (window.__popupRegistry ||= {});
      registry[this.name] = this.popupComponent; // "rooftop-solar-insulation"
      registry["rooftop"] = this.popupComponent; // Optional alias
    }

    console.log("[Rooftop Plugin] Enabled");
  },

  disable() {
    this.close(); // Always clears buildings
    this._context = null;
    console.log("[Rooftop Plugin] Disabled");
  },

  open() {
    try {
      this._context?.PopupService.show({
        isPlugin: true,
        pluginId: this.name,
        tabTitle: "Rooftop Solar Insulation",
        component: this.popupComponent,
        props: {
          selectedSeason: this._context.defaultOptions.selectedSeason,
          shadowTime: this._context.defaultOptions.shadowTime,
        },
      });
      console.log("[Rooftop Plugin] Opened popup");
    } catch (err) {
      console.error("[Rooftop Plugin] Failed to open popup:", err);
    }
  },

  close() {
    try {
      clearRooftopSolarInsulation(); // Removes all buildings
      console.log("[Rooftop Plugin] Closed");
    } catch (e) {
      console.error("[Rooftop Plugin] Failed to close:", e);
    }
  },

  updateShadowTime,
};

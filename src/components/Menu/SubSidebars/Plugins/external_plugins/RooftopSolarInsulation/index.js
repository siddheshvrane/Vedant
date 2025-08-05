import {
  setupRooftopSolarInsulationTool,
  clearRooftopSolarInsulation,
  updateShadowTime,
} from "./RooftopSolarInsulationCore.js";

import RooftopPopup from "./Rooftop.vue";
import { MapService } from "../../../../../../services/MapService.js"; // Used if needed for viewer etc.

/** @type {import('@/types/plugin.types').Plugin} */
export default {
  name: "rooftop-solar-insulation",
  title: "Rooftop Solar Insulation",
  subtitle: "Displays seasonal solar insulation for rooftop buildings.",
  pfpUrl: "https://placehold.co/60x60/ff9900/ffffff?text=☀️",
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
      this._context?.PopupService._showInternalTypeBasedPopup("rooftop", {
        title: "Rooftop Solar Insulation",
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

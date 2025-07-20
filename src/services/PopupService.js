// src/services/PopupService.js
import { BehaviorSubject } from "rxjs";

/**
 * PopupService: Manages the display and data for *all* application-wide popups.
 * This service differentiates popups by a 'type' property.
 */
class PopupServiceClass {
  // Controls overall visibility of the single popup component
  isVisible$ = new BehaviorSubject(false);

  // Holds the data for the *currently active* popup, including its type
  popupContent$ = new BehaviorSubject({
    type: null, // 'serviceAdded', 'toolInstruction', 'confirmation', 'viewshedForm', 'terrainProfileStats'
    data: {}, // Specific data for the active type
  });

  // Resolvers for the confirmation promise
  _confirmationResolver = null;
  _confirmationRejecter = null;

  /**
   * Shows a popup with given type and parameters.
   * @param {string} type - The type of popup to show ('serviceAdded', 'toolInstruction', 'confirmation', 'viewshedForm', 'terrainProfileStats').
   * @param {object} data - The parameters specific to that popup type.
   * - For 'serviceAdded': { layerName: string, srs: string, extent: string }
   * - For 'toolInstruction': { message: string, title?: string, showDismissButton?: boolean }
   * - For 'confirmation': { message: string, title?: string, confirmText?: string, cancelText?: string }
   * - For 'viewshedForm': { observerHeight: number, viewDistance: number, rayCount: number, onStart: Function, onCancel: Function }
   * - For 'terrainProfileStats': { profile: Array, entity: Cesium.Entity }
   */
  show(type, data) {
    if (!type) {
      console.error("PopupService.show: 'type' parameter is required.");
      return;
    }
    this.popupContent$.next({ type, data });
    this.isVisible$.next(true);
  }

  /**
   * Hides the currently displayed popup.
   * If a confirmation is pending, it implicitly cancels it.
   */
  hide() {
    this.isVisible$.next(false);
    // Reset the content after hiding
    this.popupContent$.next({
      type: null,
      data: {},
    });
    // If a confirmation was pending, reject it as it's being dismissed without explicit action
    if (this._confirmationRejecter) {
      this._confirmationRejecter(
        new Error("Confirmation dismissed by user or system.")
      );
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
    }
  }

  /**
   * Convenience method to show the 'serviceAdded' popup.
   * @param {object} params - { layerName: string, srs: string, extent: string }
   */
  showServiceAdded(params) {
    this.show("serviceAdded", params);
  }

  /**
   * Convenience method to show the 'toolInstruction' popup.
   * @param {string} message - The instruction message.
   * @param {string} [title='Tool Instructions'] - Optional title.
   * @param {boolean} [showDismissButton=true] - Optional flag for dismiss button.
   */
  showToolInstruction(
    message,
    title = "Tool Instructions",
    showDismissButton = true
  ) {
    this.show("toolInstruction", { message, title, showDismissButton });
  }

  /**
   * Shows a confirmation dialog and returns a Promise that resolves with true (confirmed) or false (canceled).
   * @param {string} message - The confirmation message.
   * @param {string} [title='Confirm Action'] - Optional title for the confirmation dialog.
   * @param {string} [confirmText='Confirm'] - Text for the confirmation button.
   * @param {string} [cancelText='Cancel'] - Text for the cancel button.
   * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false if canceled.
   */
  showConfirmation(
    message,
    title = "Confirm Action",
    confirmText = "Confirm",
    cancelText = "Cancel"
  ) {
    // If a confirmation is already active, reject the previous one
    if (this._confirmationRejecter) {
      this._confirmationRejecter(
        new Error(
          "New confirmation dialog opened before previous one was resolved."
        )
      );
    }

    return new Promise((resolve, reject) => {
      this._confirmationResolver = resolve;
      this._confirmationRejecter = reject;

      this.show("confirmation", {
        message,
        title,
        confirmText,
        cancelText,
      });
    });
  }

  /**
   * Convenience method to show the 'viewshedForm' popup.
   * @param {object} params - { observerHeight: number, viewDistance: number, rayCount: number, onStart: Function, onCancel: Function }
   */
  showViewshedForm(params) {
    this.show("viewshedForm", params);
  }

  /**
   * NEW: Convenience method to show the 'terrainProfileStats' popup.
   * @param {object} params - { profile: Array, entity: Cesium.Entity }
   */
  showTerrainProfileStats(params) {
    this.show("terrainProfileStats", params);
  }

  /**
   * Resolves the pending confirmation promise. Called by the Popup component.
   * @param {boolean} result - True for confirmed, false for canceled.
   */
  resolveConfirmation(result) {
    if (this._confirmationResolver) {
      this._confirmationResolver(result);
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
      this.hide(); // Hide the popup after action
    }
  }

  /**
   * Rejects the pending confirmation promise. Called by the Popup component (e.g., if dismissed externally).
   * @param {Error} error - The error to reject with.
   */
  rejectConfirmation(error) {
    if (this._confirmationRejecter) {
      this._confirmationRejecter(error);
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
      this.hide(); // Hide the popup after action
    }
  }
}

export const PopupService = new PopupServiceClass();

// src/services/PopupService.js
import { BehaviorSubject } from 'rxjs';

/**
 * PopupService: Manages the display and data for *all* application-wide popups.
 * This service differentiates popups by a 'type' property.
 */
class PopupServiceClass {
    // Controls overall visibility of the single popup component
    isVisible$ = new BehaviorSubject(false);

    // Holds the data for the *currently active* popup, including its type
    popupContent$ = new BehaviorSubject({
        type: null, // 'serviceAdded' or 'toolInstruction'
        data: {}    // Specific data for the active type
    });

    /**
     * Shows a popup with given type and parameters.
     * @param {string} type - The type of popup to show ('serviceAdded' or 'toolInstruction').
     * @param {object} data - The parameters specific to that popup type.
     * - For 'serviceAdded': { layerName: string, srs: string, extent: string }
     * - For 'toolInstruction': { message: string, title?: string, showDismissButton?: boolean }
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
     */
    hide() {
        this.isVisible$.next(false);
        // Reset the content after hiding, or keep it if you need its state temporarily
        this.popupContent$.next({
            type: null,
            data: {}
        });
    }

    // You can keep the specific showServiceAdded and showToolInstruction methods
    // as convenience wrappers, or just use the generic 'show' method directly.
    // I'll add them here for clarity and easy transition.

    /**
     * Convenience method to show the 'serviceAdded' popup.
     * @param {object} params - { layerName: string, srs: string, extent: string }
     */
    showServiceAdded(params) {
        this.show('serviceAdded', params);
    }

    /**
     * Convenience method to show the 'toolInstruction' popup.
     * @param {string} message - The instruction message.
     * @param {string} [title='Tool Instructions'] - Optional title.
     * @param {boolean} [showDismissButton=true] - Optional flag for dismiss button.
     */
    showToolInstruction(message, title = 'Tool Instructions', showDismissButton = true) {
        this.show('toolInstruction', { message, title, showDismissButton });
    }
}

export const PopupService = new PopupServiceClass();
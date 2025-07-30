import { BehaviorSubject } from "rxjs";

class PopupServiceClass {
    // Controls overall visibility of the single popup component
    isVisible$ = new BehaviorSubject(false);

    // Holds the data for the *currently active* popup, including the component itself
    // and its props/callbacks.
    popupContent$ = new BehaviorSubject({
        component: null, // The Vue component to render
        title: "",       // Title for the popup header
        props: {},       // Props to pass to the component
        // Callbacks from the popup to the service/caller
        onSelect: null,  // Generic callback for selection/start action
        onCancel: null,  // Generic callback for cancel action
        onClose: null,   // Internal callback to hide the popup from within the component
    });

    // Resolvers for the confirmation promise
    _confirmationResolver = null;
    _confirmationRejecter = null;

    /**
     * Shows a generic popup with a specified Vue component and its props/callbacks.
     * @param {object} options - Options for the popup.
     * @param {import("vue").DefineComponent} options.component - The Vue component to render inside the popup.
     * @param {string} [options.title=''] - The title for the popup.
     * @param {object} [options.props={}] - Props to pass directly to the component.
     * @param {Function} [options.onSelect] - Callback when the component signals a "select" or "start" action.
     * @param {Function} [options.onCancel] - Callback when the component signals a "cancel" action.
     */
    show({ component, title = "", props = {}, onSelect = null, onCancel = null }) {
        if (!component) {
            console.error("PopupService.show: 'component' parameter is required.");
            return;
        }

        // Ensure any previous confirmation is rejected if a new popup is opened
        if (this._confirmationRejecter) {
            this._confirmationRejecter(
                new Error("New popup opened before previous confirmation was resolved.")
            );
            this._confirmationResolver = null;
            this._confirmationRejecter = null;
        }

        // The onClose callback is passed to the component itself, allowing it to hide the popup
        // by calling this.onClose() internally.
        const onClose = () => this.hide();

        this.popupContent$.next({
            component,
            title,
            props: {
                ...props,
                onSelect, // Pass these down to the component so it can use them
                onCancel,
                onClose,  // Make sure the component can call onClose to hide itself
            },
            onSelect, // Also store them here for internal service logic if needed
            onCancel,
            onClose,
        });
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
            component: null,
            title: "",
            props: {},
            onSelect: null,
            onCancel: null,
            onClose: null,
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
            this._showInternalTypeBasedPopup("confirmation", {
                message,
                title,
                confirmText,
                cancelText,
                onConfirm: () => this.resolveConfirmation(true),
                onCancel: () => this.resolveConfirmation(false),
            });
        });
    }

    // Internal helper for popups that are still managed by a 'type' string
    // This assumes your main Popup.vue component reads `popupContent$.value.type`
    // and `popupContent$.value.data` to render specific internal sub-components.
    _showInternalTypeBasedPopup(type, data) {
        if (!type) {
            console.error("PopupService._showInternalTypeBasedPopup: 'type' parameter is required.");
            return;
        }
        this.popupContent$.next({
            component: null, // Set component to null for type-based popups
            title: data.title || "",
            props: data, // Pass data as props
            type: type, // Keep the type for backward compatibility with your main Popup.vue
            onSelect: data.onSelect,
            onCancel: data.onCancel,
            onClose: () => this.hide(),
        });
        this.isVisible$.next(true);
    }


    /**
     * Convenience method to show the 'serviceAdded' popup.
     * @param {object} params - { layerName: string, srs: string, extent: string }
     */
    showServiceAdded(params) {
        this._showInternalTypeBasedPopup("serviceAdded", params);
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
        this._showInternalTypeBasedPopup("toolInstruction", { message, title, showDismissButton });
    }

    /**
     * Convenience method to show the 'viewshedForm' popup.
     * @param {object} params - { observerHeight: number, viewDistance: number, rayCount: number, onStart: Function, onCancel: Function }
     */
    showViewshedForm(params) {
        this._showInternalTypeBasedPopup("viewshedForm", params);
    }

    /**
     * NEW: Convenience method to show the 'terrainProfileStats' popup.
     * @param {object} params - { profile: Array, entity: Cesium.Entity }
     */
    showTerrainProfileStats(params) {
        this._showInternalTypeBasedPopup("terrainProfileStats", params);
    }

    /**
     * NEW: Convenience method to show the 'threeDModelForm' popup.
     * @param {object} params - { url?: string, longitude?: number, latitude?: number, scale?: number, minimumPixelSize?: number, maximumScale?: number, onStart: Function, onCancel: Function }
     */
    showThreeDModelForm(params) {
        this._showInternalTypeBasedPopup("threeDModelForm", params);
    }

    /**
     *
     * @deprecated Use `PopupService.show({ component: FlyThroughModePopup, ... })` directly.
     * @param {object} params - { height?: number, tilt?: number, speed?: number, duration?: number, loop?: boolean, onStart: Function, onCancel: Function }
     */
    showFlyThroughForm(params) {
        console.warn("PopupService.showFlyThroughForm is deprecated. Use PopupService.show({ component: FlyThroughModePopup, ... }) directly.");
        this._showInternalTypeBasedPopup("flyThroughForm", params);
    }

    /**
     * NEW: Shows the marker sequence configuration form
     * @param {object} params - Marker configuration parameters
     * @param {Array} params.markers - Array of marker objects with id, order, waitTime, coordinates, description
     * @param {number} params.totalDuration - Total estimated duration
     * @param {boolean} params.enableSmoothing - Whether to enable camera smoothing
     * @param {number} params.previewDuration - Duration for marker preview
     * @param {Function} params.onStart - Callback when flythrough starts
     * @param {Function} params.onPreview - Callback when marker is previewed
     * @param {Function} params.onCancel - Callback when cancelled
     */
    showMarkerSequenceForm(params) {
        // Import MarkerSequencePopup dynamically to avoid circular dependencies
        // You might need to adjust this import path based on your project structure
        import('../components/Popup/popups/MarkerSequencePopup.vue').then(({ default: MarkerSequencePopup }) => {
            this.show({
                component: MarkerSequencePopup,
                title: "🎯 Configure Marker Flythrough",
                props: {
                    markers: params.markers || [],
                    totalDuration: params.totalDuration || 0,
                    enableSmoothing: params.enableSmoothing !== undefined ? params.enableSmoothing : true,
                    previewDuration: params.previewDuration || 2.0,
                    onStart: params.onStart,
                    onPreview: params.onPreview,
                    onCancel: params.onCancel,
                },
                onSelect: params.onStart,
                onCancel: params.onCancel,
            });
        }).catch(error => {
            console.error("Failed to load MarkerSequencePopup component:", error);
            // Fallback to a simple alert or instruction
            this.showToolInstruction(
                "Failed to load marker configuration popup. Please try again.",
                "Error",
                true
            );
        });
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
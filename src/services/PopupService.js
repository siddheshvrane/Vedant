// services/PopupService.js
import { BehaviorSubject } from "rxjs";

class PopupServiceClass {
  isVisible$ = new BehaviorSubject(false);
  popupContent$ = new BehaviorSubject({
    component: null,
    title: "",
    props: {},
    onSelect: null,
    onCancel: null,
    onClose: null,
    type: null,
  });

  _confirmationResolver = null;
  _confirmationRejecter = null;

  // Store plugin popup state per pluginId
  pluginPopups = new Map(); // pluginId -> { tabs: [ {id,title,component,props} ], activeTabIndex }

  /**
   * Shows a popup. For plugin tab behavior pass: isPlugin: true and pluginId: "yourPluginId".
   * Additional optional field: tabTitle (string).
   *
   * Backwards-compatible: existing calls without isPlugin still work.
   */
  show({
    component,
    title = "",
    props = {},
    onSelect = null,
    onCancel = null,
    // plugin-specific:
    isPlugin = false,
    pluginId = null,
    tabTitle = "",
  } = {}) {
    // plugin flow: append to plugin's tab list and render PluginPopupContainer
    if (isPlugin && pluginId) {
      let state = this.pluginPopups.get(pluginId);
      if (!state) {
        state = { tabs: [], activeTabIndex: 0 };
        this.pluginPopups.set(pluginId, state);
      }

      // Check if a tab with the same component AND title already exists to avoid duplicates
      const existingIndex = state.tabs.findIndex(
        (tab) =>
          tab.title === (tabTitle || title || "Tab") &&
          tab.component === component
      );

      if (existingIndex !== -1) {
        // Activate existing tab and update props if needed
        state.activeTabIndex = existingIndex;

        // Optionally update props of existing tab to latest
        state.tabs[existingIndex].props = {
          ...state.tabs[existingIndex].props,
          ...props,
          onSelect,
          onCancel,
          onClose: () => this._closePluginContainer(pluginId),
        };

        this._emitPluginContainer(pluginId);
        return;
      }

      // create the tab entry
      const tabEntry = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        title: tabTitle || title || "Tab",
        component,
        props: {
          ...props,
          onSelect,
          onCancel,
          // components inside plugin tab can call this to close the whole plugin container (or we wire their own close per-tab).
          onClose: () => this._closePluginContainer(pluginId),
        },
      };

      state.tabs.push(tabEntry);
      state.activeTabIndex = state.tabs.length - 1;

      // emit the plugin container (dynamic import to avoid circular deps)
      this._emitPluginContainer(pluginId);
      return;
    }

    // fallback: original behaviour for non-plugin popups
    if (!component) {
      console.error("PopupService.show: 'component' parameter is required.");
      return;
    }

    // ensure any pending confirmation is rejected
    if (this._confirmationRejecter) {
      this._confirmationRejecter(
        new Error("New popup opened before previous confirmation was resolved.")
      );
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
    }

    const onClose = () => this.hide();

    this.popupContent$.next({
      component,
      title,
      props: {
        ...props,
        onSelect,
        onCancel,
        onClose,
      },
      onSelect,
      onCancel,
      onClose,
      type: null,
    });
    this.isVisible$.next(true);
  }

  // INTERNAL: load and emit plugin container component with current plugin state
  _emitPluginContainer(pluginId) {
    const pluginState = this.pluginPopups.get(pluginId);
    if (!pluginState) return;

    import("../components/Menu/SubSidebars/Plugins/PluginPopupContainer.vue")
      .then(({ default: PluginPopupContainer }) => {
        this.popupContent$.next({
          component: PluginPopupContainer,
          title: pluginState.title || "",
          props: {
            pluginId,
            tabs: pluginState.tabs,
            activeTabIndex: pluginState.activeTabIndex,
            // Remove re-emitting on tab switch to prevent remounting
            onTabSwitch: (index) => {
              pluginState.activeTabIndex = index;
              // Do NOT call this._emitPluginContainer(pluginId) here
              // The PluginPopupContainer component should handle this internally
            },
            onTabClose: (index) => {
              if (!pluginState) return;
              pluginState.tabs.splice(index, 1);
              if (pluginState.activeTabIndex >= pluginState.tabs.length) {
                pluginState.activeTabIndex = pluginState.tabs.length - 1;
              }
              if (pluginState.tabs.length === 0) {
                this.pluginPopups.delete(pluginId);
                this.hide();
              } else {
                this._emitPluginContainer(pluginId);
              }
            },
            onCloseContainer: () => this._closePluginContainer(pluginId),
          },
          onClose: () => this._closePluginContainer(pluginId),
          type: null,
        });
        this.isVisible$.next(true);
      })
      .catch((err) => {
        console.error("Failed to load PluginPopupContainer.vue:", err);
        // fallback: show first tab's component directly if plugin container can't be loaded
        const fallbackTab = pluginState.tabs[pluginState.activeTabIndex];
        if (fallbackTab) {
          this.popupContent$.next({
            component: fallbackTab.component,
            title: fallbackTab.title || "",
            props: fallbackTab.props || {},
            onClose: () => this._closePluginContainer(pluginId),
            type: null,
          });
          this.isVisible$.next(true);
        }
      });
  }

  _closePluginContainer(pluginId) {
    this.pluginPopups.delete(pluginId);
    this.hide();
  }

  hide() {
    this.isVisible$.next(false);
    this.popupContent$.next({
      component: null,
      title: "",
      props: {},
      onSelect: null,
      onCancel: null,
      onClose: null,
      type: null,
    });
    if (this._confirmationRejecter) {
      this._confirmationRejecter(
        new Error("Confirmation dismissed by user or system.")
      );
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
    }
  }

  /**
   * NEW: Show notification messages (fixes the missing method error)
   */
  showNotification(message, isError = false, duration = 5000) {
    console.log(`${isError ? 'ERROR' : 'INFO'}: ${message}`);
    
    // Show as a popup notification
    this._showInternalTypeBasedPopup('notification', {
      message: typeof message === 'string' ? message : JSON.stringify(message),
      isError: isError,
      duration: duration,
      title: isError ? 'Error' : 'Notification'
    });
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        this.hide();
      }, duration);
    }
  }

  // --- existing type-based helpers untouched ---

  _showInternalTypeBasedPopup(type, data) {
    if (!type) {
      console.error(
        "PopupService._showInternalTypeBasedPopup: 'type' parameter is required."
      );
      return;
    }
    this.popupContent$.next({
      component: null,
      title: data.title || "",
      props: data,
      type: type,
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

  showToolInstruction(
    message,
    title = "Tool Instructions",
    showDismissButton = true
  ) {
    this._showInternalTypeBasedPopup("toolInstruction", {
      message,
      title,
      showDismissButton,
    });
  }

  showViewshedForm(params) {
    this._showInternalTypeBasedPopup("viewshedForm", params);
  }

  showTerrainProfileStats(params) {
    this._showInternalTypeBasedPopup("terrainProfileStats", params);
  }

  showThreeDModelForm(params) {
    this._showInternalTypeBasedPopup("threeDModelForm", params);
  }

  /**
   * @deprecated Use `PopupService.show({ component: FlyThroughModePopup, ... })` directly.
   * @param {object} params - { height?: number, tilt?: number, speed?: number, duration?: number, loop?: boolean, onStart: Function, onCancel: Function }
   */
  showFlyThroughForm(params) {
    console.warn("PopupService.showFlyThroughForm is deprecated. Use PopupService.show({ component: FlyThroughModePopup, ... }) directly.");
    this._showInternalTypeBasedPopup("flyThroughForm", params);
  }

  showMarkerSequenceForm(params) {
    import("../components/Popup/popups/MarkerSequencePopup.vue")
      .then(({ default: MarkerSequencePopup }) => {
        this.show({
          component: MarkerSequencePopup,
          title: "🎯 Configure Marker Flythrough",
          props: {
            markers: params.markers || [],
            totalDuration: params.totalDuration || 0,
            enableSmoothing:
              params.enableSmoothing !== undefined
                ? params.enableSmoothing
                : true,
            previewDuration: params.previewDuration || 2.0,
            onStart: params.onStart,
            onPreview: params.onPreview,
            onCancel: params.onCancel,
          },
          onSelect: params.onStart,
          onCancel: params.onCancel,
        });
      })
      .catch((error) => {
        console.error("Failed to load MarkerSequencePopup component:", error);
        this.showToolInstruction(
          "Failed to load marker configuration popup. Please try again.",
          "Error",
          true
        );
      });
  }

  showConfirmation(options) {
    // Handle both string message and object with message property
    let message, title, confirmText, cancelText, onConfirm, onCancel;
    
    if (typeof options === 'string') {
      // Legacy support for string-only message
      message = options;
      title = arguments[1] || "Confirm Action";
      confirmText = arguments[2] || "Confirm";
      cancelText = arguments[3] || "Cancel";
    } else if (typeof options === 'object') {
      // Handle object parameter
      message = options.message || options;
      if (typeof message === 'object') {
        // If message is still an object, extract or stringify it
        message = message.message || message.title || JSON.stringify(message);
      }
      title = options.title || "Confirm Action";
      confirmText = options.confirmText || "Confirm";
      cancelText = options.cancelText || "Cancel";
      onConfirm = options.onConfirm;
      onCancel = options.onCancel;
    }

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
        message: message,
        title: title,
        confirmText: confirmText,
        cancelText: cancelText,
        onConfirm: onConfirm || (() => this.resolveConfirmation(true)),
        onCancel: onCancel || (() => this.resolveConfirmation(false)),
      });
    });
  }

  resolveConfirmation(result) {
    if (this._confirmationResolver) {
      this._confirmationResolver(result);
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
      this.hide();
    }
  }

  rejectConfirmation(error) {
    if (this._confirmationRejecter) {
      this._confirmationRejecter(error);
      this._confirmationResolver = null;
      this._confirmationRejecter = null;
      this.hide();
    }
  }
}

export const PopupService = new PopupServiceClass();
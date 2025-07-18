<template>
  <li class="layer-item">
    <button @click="$emit('zoom-to-layer', layer.id)" class="btn btn-sm btn-link zoom-icon" title="Zoom to Layer">
      <i class="fas fa-search-plus"></i>
    </button>

    <button
      @click="toggleVisibility"
      class="btn btn-sm btn-link visibility-toggle-btn me-2"
      :title="internalIsVisible ? 'Hide Layer' : 'Show Layer'"
    >
      <i :class="internalIsVisible ? 'fas fa-eye' : 'fas fa-eye-slash'"></i>
    </button>

    <label class="layer-name ms-2">
      {{ layer.name }}
    </label>

    <div class="layer-actions-group">
      <button 
        @click="$emit('move-layer', layer.id, 'up')" 
        class="btn btn-sm btn-link move-up-icon"
        :disabled="isFirst"
        title="Move Layer Up"
      >
        <i class="fas fa-arrow-up"></i>
      </button>
      <button 
        @click="$emit('move-layer', layer.id, 'down')" 
        class="btn btn-sm btn-link move-down-icon"
        :disabled="isLast"
        title="Move Layer Down"
      >
        <i class="fas fa-arrow-down"></i>
      </button>
      <button @click="$emit('edit-layer', layer.id)" class="btn btn-sm btn-link edit-icon" title="Edit Layer">
        <i class="fas fa-edit"></i>
      </button>
      <button @click="handleRemoveLayer(layer.id, layer.name)" class="btn btn-sm btn-link remove-icon" title="Remove Layer">
        <i class="fas fa-trash" style="color: #FF6600;"></i> 
      </button>
    </div>
  </li>
</template>

<script>
// Ensure the import path for PopupService is correct relative to LayerListItem.vue
import { PopupService } from '../../../../services/PopupService.js'; 

export default {
  name: 'LayerListItem',
  props: {
    layer: {
      type: Object,
      required: true,
      validator: (value) => {
        return 'id' in value && 'name' in value && 'isVisible' in value;
      },
    },
    isFirst: {
      type: Boolean,
      default: false
    },
    isLast: {
      type: Boolean,
      default: false
    }
  },
  emits: ['zoom-to-layer', 'toggle-visibility', 'edit-layer', 'remove-layer', 'move-layer'],
  data() {
    return {
      internalIsVisible: this.layer.isVisible,
    };
  },
  watch: {
    'layer.isVisible'(newVal) {
      this.internalIsVisible = newVal;
    },
  },
  methods: {
    /**
     * Handles the remove layer action, prompting for confirmation before emitting.
     * @param {string} layerId - The ID of the layer to remove.
     * @param {string} layerName - The name of the layer to display in the confirmation.
     */
    async handleRemoveLayer(layerId, layerName) {
      try {
        const confirmed = await PopupService.showConfirmation(
          `Are you sure you want to remove the layer "${layerName}"? This action cannot be undone.`,
          'Remove Layer',
          'Remove',
          'Cancel'
        );

        if (confirmed) {
          this.$emit('remove-layer', layerId);
        }
      } catch (error) {
        // Log the error if the confirmation dialog itself fails or is dismissed unexpectedly
        console.error("LayerListItem: Confirmation dialog error:", error);
      }
    },
    /**
     * Toggles the internal visibility state and emits the change to the parent.
     */
    toggleVisibility() {
      this.internalIsVisible = !this.internalIsVisible;
      this.$emit('toggle-visibility', this.layer.id, this.internalIsVisible);
    }
  },
};
</script>

<style scoped>
/* Styles specific to a single layer item */
.layer-item {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* Lighter divider for items */
  font-size: 0.95em;
}

.layer-item:last-child {
  border-bottom: none; /* No border for the last item */
}

.layer-name {
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  cursor: default; /* Layer name itself is not a clickable action */
  margin-right: 10px; /* Space between name and action group */
}

/* Group for action icons */
.layer-actions-group {
    display: flex;
    align-items: center;
    margin-left: auto; /* Pushes the group to the right */
    gap: 5px; /* Spacing between buttons */
}

/* --- General Action Button Styles (Applies to all .btn-link within this component) --- */
.btn-link {
    background: none;
    border: none;
    padding: 5px 8px; /* Consistent padding for clickable area */
    cursor: pointer;
    transition: transform 0.1s ease, color 0.2s ease; /* Smooth transitions for hover effects */
    display: flex; /* Use flex to center icon within the button */
    align-items: center;
    justify-content: center;
    font-size: 1.2em; /* Consistent icon size */
    text-decoration: none; /* *** IMPORTANT: REMOVES UNDERLINE *** */
    /* Default color for icons, can be overridden by specific icon styles */
    color: rgba(255, 255, 255, 0.7); 
}

.btn-link:hover {
    transform: scale(1.1); /* Subtle grow effect on hover */
    text-decoration: none; /* *** IMPORTANT: REMOVES UNDERLINE ON HOVER *** */
    /* Default hover color for icons, can be overridden by specific icon styles */
    color: white; 
}

/* --- Specific Icon Color Overrides and Styling --- */

.zoom-icon {
    /* Inherits base .btn-link color and hover. No custom color needed. */
}

.edit-icon {
    color: rgba(0, 123, 255, 0.7); /* Bootstrap primary blue, slightly subdued */
}
.edit-icon:hover {
    color: #007bff; /* Brighter blue on hover */
}

/* Visibility Toggle Button (Eye Icon) */
.visibility-toggle-btn {
  flex-shrink: 0; /* Prevents button from shrinking */
}

.visibility-toggle-btn i {
  color: white; /* Always white regardless of state, matching MeasurementHistory */
  transition: color 0.2s ease; /* Smooth color transition for the icon */
}

.visibility-toggle-btn:hover i {
  color: white; /* Keeps white on hover for eye icon */
}

/* --- Delete Icon (Trash) - FULLY MATCHED to MeasurementHistory --- */
/* The base color is set inline in the template (style="color: #FF6600;") for highest specificity. */
/* We only need to define the hover effect here by targeting the <i> tag within the button. */
.remove-icon i {
    transition: color 0.2s ease; /* Ensure smooth color transition for the icon */
}
.remove-icon:hover i {
    color: #FF9933; /* Lighter orange on hover, directly matching MeasurementHistory */
}

/* Move icons styling */
.move-up-icon, .move-down-icon {
    color: rgba(108, 117, 125, 0.7); /* Neutral gray similar to Bootstrap secondary */
}
.move-up-icon:hover:not(:disabled), .move-down-icon:hover:not(:disabled) {
    color: #6c757d; /* Darker gray on hover */
}
.move-up-icon:disabled, .move-down-icon:disabled {
    opacity: 0.3; /* Visually indicate disabled state */
    cursor: not-allowed;
}
</style>
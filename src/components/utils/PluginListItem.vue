<template>
  <li class="plugin-item card mb-3">
    <div class="plugin-top-section d-flex align-items-start pb-3"> <div class="plugin-pfp-container me-3">
        <img :src="plugin.pfpUrl" :alt="plugin.title" class="plugin-pfp rounded-circle">
      </div>
      <div class="plugin-content d-flex flex-column flex-grow-1">
        <h6 class="plugin-title card-title text-light mb-0">{{ plugin.title }}</h6>
        <p class="plugin-subtitle card-subtitle text-muted">{{ plugin.subtitle }}</p>
      </div>
    </div>
    <div class="plugin-buttons-wrapper pt-3 border-top border-secondary"> <div class="plugin-actions d-flex justify-content-center">
        <button
          class="btn btn-sm action-button me-2" :class="installButtonClasses"
          @click="handleToggleInstall"
          :disabled="installButtonDisabled"
        >
          <span v-if="displayState === 'installing'">
            <i class="fas fa-spinner fa-spin me-1"></i> Installing...
          </span>
          <span v-else-if="displayState === 'installed-confirm'">
            <i class="fas fa-check me-1"></i> Installed
          </span>
          <span v-else-if="displayState === 'uninstall'">
            <i class="fas fa-trash-alt me-1"></i> Uninstall
          </span>
          <span v-else-if="displayState === 'uninstalling'">
            <i class="fas fa-spinner fa-spin me-1"></i> Uninstalling...
          </span>
          <span v-else>
            <i class="fas fa-download me-1"></i> Install
          </span>
        </button>
        <button class="btn btn-sm btn-outline-secondary action-button" @click="$emit('help-plugin', plugin.id)">
          <i class="fas fa-question-circle me-1"></i> Help
        </button>
      </div>
    </div>
  </li>
</template>

<script>
export default {
  name: 'PluginListItem',
  props: {
    plugin: {
      type: Object,
      required: true,
      validator: (value) => {
        return 'id' in value && 'title' in value && 'subtitle' in value && 'pfpUrl' in value && 'isInstalled' in value;
      },
    },
  },
  emits: ['toggle-install', 'help-plugin'],
  data() {
    return {
      // States: 'install', 'installing', 'installed-confirm', 'uninstall', 'uninstalling'
      displayState: this.plugin.isInstalled ? 'uninstall' : 'install',
      installButtonDisabled: false,
    };
  },
  computed: {
    installButtonClasses() {
      // Use Bootstrap's btn-outline-primary for 'install' state to match light outline,
      // and btn-primary for 'uninstall' for a filled button.
      if (this.displayState === 'install') {
        return 'btn-outline-primary';
      } else if (this.displayState === 'uninstall') {
        // You might want a 'btn-danger' for uninstall for clearer UX
        return 'btn-danger';
      } else {
        // installing, installed-confirm, uninstalling
        return 'btn-primary disabled'; // Use primary for active states, but disabled
      }
    }
  },
  watch: {
    'plugin.isInstalled': {
      handler(newVal) {
        if (newVal) {
          if (this.displayState === 'installing') {
              this.displayState = 'installed-confirm';
              this.installButtonDisabled = true;
              this.startConfirmTimer();
          } else if (this.displayState !== 'installed-confirm' && this.displayState !== 'uninstalling') {
              this.displayState = 'uninstall';
          }
        } else {
          if (this.displayState === 'uninstalling') {
              this.displayState = 'install';
              this.installButtonDisabled = false;
          } else if (this.displayState !== 'installing' && this.displayState !== 'installed-confirm') {
              this.displayState = 'install';
          }
        }
      },
      immediate: true,
    },
  },
  methods: {
    handleToggleInstall() {
      if (this.displayState === 'install') {
        this.displayState = 'installing';
        this.installButtonDisabled = true;
        this.$emit('toggle-install', this.plugin.id);
      } else if (this.displayState === 'uninstall') {
        this.displayState = 'uninstalling';
        this.installButtonDisabled = true;
        this.$emit('toggle-install', this.plugin.id);
      }
    },
    startConfirmTimer() {
      setTimeout(() => {
        this.displayState = 'uninstall';
        this.installButtonDisabled = false;
      }, 2000); // Display "Installed" for 2 seconds
    }
  },
  mounted() {
    if (this.plugin.isInstalled && this.displayState !== 'uninstall') {
        this.displayState = 'uninstall';
    }
  }
};
</script>

<style scoped>
/*
  Using Bootstrap variables where possible is ideal, but here we define custom
  variables for transparency and specific shades not directly in Bootstrap's palette.
*/
:root {
  --card-bg: rgba(246, 246, 246, ); /* Increased opacity */
  --border-color: rgba(60, 60, 60, 0.7);
  --text-color: #e0e0e0; /* Light gray for general text */
  --muted-text-color: #a0a0a0; /* Even lighter gray for muted text */
  /* Using Bootstrap's built-in variables for primary/secondary/danger if available,
     otherwise defining them to match Bootstrap's defaults. */
  --bs-primary: #0d6efd; /* Official Bootstrap 5 primary blue */
  --bs-primary-rgb: 13,110,253;
  --bs-secondary: #6c757d; /* Official Bootstrap 5 secondary gray */
  --bs-danger: #dc3545; /* Official Bootstrap 5 danger red */
}

.plugin-item {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color); /* Custom border due to transparency */
  border-radius: 10px; /* Custom radius */
  padding: 18px 20px; /* Custom padding */
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Custom shadow for effect */
  transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  min-height: 150px; /* Ensure a good minimum height for card */
  display: flex; /* Bootstrap d-flex handles this */
  flex-direction: column; /* Bootstrap flex-column handles this */
}

.plugin-item:hover {
  background-color: rgba(55, 55, 55, 0.95); /* Custom hover background for transparency */
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.plugin-top-section {
  flex-grow: 1; /* Allows this section to take available height */
  /* Removed explicit margin-bottom as pb-3 and pt-3 on button wrapper create spacing */
}

.plugin-pfp-container {
  width: 70px;
  height: 70px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex; /* For centering content within */
  align-items: center;
  justify-content: center;
}

.plugin-pfp {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid var(--bs-primary); /* Using Bootstrap primary color */
  box-shadow: 0 0 0 2px rgba(var(--bs-primary-rgb),.3); /* Using Bootstrap primary RGB for shadow */
}

.plugin-title {
  color: var(--text-color); /* Custom text color for specific shade */
  font-size: 1em; /* Custom font size */
  font-weight: 500; /* Custom font weight */
  line-height: 1.2;
}

.plugin-subtitle {
  color: var(--muted-text-color); /* Custom muted text color */
  font-size: 0.9em; /* Custom font size */
  line-height: 1.4;
  /* Removed padding-right: 10px; if Bootstrap's flex-grow handles width well */
}

.plugin-buttons-wrapper {
  /* width: 100%; is implicit with flex-direction: column on parent and d-flex on content */
  /* Replaced custom margin-top with Bootstrap pt-3 */
  border-top: 1px solid rgba(var(--bs-secondary-rgb), .5); /* Using Bootstrap secondary with opacity */
  padding-top: var(--bs-spacer-3); /* Using Bootstrap's spacing variable */
}

.plugin-actions {
  /* d-flex, justify-content-center are already in template */
  flex-wrap: nowrap; /* Keep on one line */
}

.action-button {
  font-size: 0.85em; /* Custom font size */
  padding: 8px 15px; /* Custom padding, could try Bootstrap's p-2 or px-3 py-2 */
  border-radius: 6px; /* Custom border-radius */
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
  display: inline-flex; /* Bootstrap d-inline-flex could be used here too */
  align-items: center; /* Bootstrap align-items-center could be used */
  justify-content: center; /* Bootstrap justify-content-center could be used */
}

/* Specific button styles - mostly using Bootstrap classes now */
/* btn-primary, btn-outline-secondary, btn-danger are Bootstrap classes */
/* Custom hover states are still here to preserve transparent effect */

.btn-outline-primary { /* Changed from btn-outline-light for better Bootstrap alignment */
  color: var(--bs-primary);
  border-color: var(--bs-primary);
  background-color: transparent;
}

.btn-outline-primary:hover:not(:disabled) {
  background-color: var(--bs-primary);
  color: white;
  box-shadow: 0 2px 5px rgba(var(--bs-primary-rgb), 0.4);
}

.btn-outline-secondary {
  color: var(--muted-text-color); /* Still using custom muted for specific shade */
  border-color: rgba(var(--bs-secondary-rgb), 0.5); /* Using Bootstrap secondary RGB */
  background-color: transparent;
}

.btn-outline-secondary:hover:not(:disabled) {
  background-color: rgba(var(--bs-secondary-rgb), 0.15); /* Using Bootstrap secondary RGB */
  color: var(--text-color); /* Custom text color */
  border-color: var(--bs-secondary);
}

/* Disabled state - simplified to use Bootstrap's .disabled */
.action-button.disabled {
  opacity: 0.65; /* Bootstrap's default disabled opacity */
  cursor: not-allowed;
  /* Removed custom background/border/color as Bootstrap's .disabled class handles this */
}

/* Spinner icon styling */
.fa-spinner {
  animation: fa-spin 1s infinite linear;
}
</style>
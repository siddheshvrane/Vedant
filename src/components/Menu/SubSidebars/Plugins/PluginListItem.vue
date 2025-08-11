<template>
  <li class="plugin-item card mb-3">
    <div class="plugin-top-section d-flex align-items-start pb-3">
      <div class="plugin-pfp-container me-3">
        <img
          :src="plugin.pfpUrl"
          :alt="plugin.title"
          class="plugin-pfp rounded-circle" />
      </div>
      <div class="plugin-content d-flex flex-column flex-grow-1">
        <h6 class="plugin-title card-title text-light mb-0">
          {{ plugin.title }}
        </h6>
        <p class="plugin-subtitle card-subtitle">
          {{ plugin.subtitle }}
        </p>
      </div>
    </div>

    <div class="plugin-buttons-wrapper pt-3 border-top border-secondary">
      <div class="plugin-actions d-flex justify-content-center">
        <button
          class="btn btn-sm action-button me-2"
          :class="isEnabled ? 'btn-danger' : 'btn-outline-primary'"
          :disabled="loading"
          @click="togglePlugin">
          <span>
            <i v-if="loading" class="fas fa-spinner fa-spin me-1"></i>
            <i
              v-else
              :class="isEnabled ? 'fas fa-times' : 'fas fa-play'"
              class="me-1"></i>
            {{ isEnabled ? "Disable" : "Enable" }}
          </span>
        </button>

        <button
          class="btn btn-sm btn-outline-secondary action-button me-2"
          @click="openPlugin"
          :disabled="!isEnabled || loading">
          <i v-if="loading" class="fas fa-spinner fa-spin me-1"></i>
          <i v-else class="fas fa-folder-open me-1"></i>
          Open
        </button>
      </div>
    </div>
  </li>
</template>

<script setup>
import { ref, computed } from "vue";
import { PluginManager } from "../../../../services/PluginManagerService";

const props = defineProps({
  plugin: {
    type: Object,
    required: true,
  },
});

const loading = ref(false);

const isEnabled = computed(() => props.plugin.isEnabled);

function togglePlugin() {
  loading.value = true;
  if (isEnabled.value) {
    PluginManager.disablePlugin(props.plugin);
  } else {
    PluginManager.enablePlugin(props.plugin);
  }
  setTimeout(() => (loading.value = false), 400);
}

function openPlugin() {
  loading.value = true;
  PluginManager.openPlugin(props.plugin);
  setTimeout(() => (loading.value = false), 400);
}
</script>

<style scoped>
:root {
  --card-bg: rgba(246, 246, 246);
  --border-color: rgba(60, 60, 60, 0.7);
  --text-color: #e0e0e0;
  --muted-text-color: #58a6ff; /* changed subtitle color to light blue */
  --bs-primary: #0d6efd;
  --bs-primary-rgb: 13, 110, 253;
  --bs-secondary: #6c757d;
  --bs-danger: #dc3545;
}

.plugin-item {
  background-color: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 18px 20px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  transition: background-color 0.2s ease, transform 0.2s ease,
    box-shadow 0.2s ease;
  min-height: 150px;
  display: flex;
  flex-direction: column;
}

.plugin-item:hover {
  background-color: rgba(55, 55, 55, 0.95);
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
}

.plugin-top-section {
  flex-grow: 1;
}

.plugin-pfp-container {
  width: 70px;
  height: 70px;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plugin-pfp {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  border: 2px solid var(--bs-primary);
  box-shadow: 0 0 0 2px rgba(var(--bs-primary-rgb), 0.3);
}

.plugin-title {
  color: var(--text-color);
  font-size: 1em;
  font-weight: 500;
  line-height: 1.2;
}

.plugin-subtitle {
  color: #a0a0a0 !important; /* or your desired color */
  font-size: 0.9em;
  line-height: 1.4;
}

.plugin-buttons-wrapper {
  border-top: 1px solid rgba(var(--bs-secondary-rgb), 0.5);
  padding-top: var(--bs-spacer-3);
}

.plugin-actions {
  flex-wrap: nowrap;
}

.action-button {
  font-size: 0.85em;
  padding: 8px 15px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.3s ease, opacity 0.2s ease, transform 0.2s ease;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.action-button:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.btn-outline-primary {
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
  color: var(--muted-text-color);
  border-color: rgba(var(--bs-secondary-rgb), 0.5);
  background-color: transparent;
}
.btn-outline-secondary:hover:not(:disabled) {
  background-color: rgba(var(--bs-secondary-rgb), 0.15);
  color: var(--text-color);
  border-color: var(--bs-secondary);
}

.action-button.disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.fa-spinner {
  animation: fa-spin 1s infinite linear;
}
</style>

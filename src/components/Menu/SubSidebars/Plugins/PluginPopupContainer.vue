<template>
  <div class="plugin-popup-container">
    <ul class="tabs">
      <li
        v-for="(tab, i) in tabs"
        :key="tab.id"
        :class="{ active: i === activeTabIndexLocal }"
        @click="switchTab(i)">
        {{ tab.title }}
        <button @click.stop="closeTab(i)">×</button>
      </li>
    </ul>

    <div class="component-wrapper">
      <keep-alive>
        <component
          :is="tabs[activeTabIndexLocal]?.component"
          v-bind="tabs[activeTabIndexLocal]?.props" />
      </keep-alive>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    tabs: Array,
    activeTabIndex: Number,
    onTabClose: Function,
  },
  data() {
    return {
      activeTabIndexLocal: this.activeTabIndex || 0,
    };
  },
  watch: {
    activeTabIndex(newVal) {
      this.activeTabIndexLocal = newVal;
    },
  },
  methods: {
    switchTab(index) {
      this.activeTabIndexLocal = index;
    },
    closeTab(index) {
      if (this.onTabClose) this.onTabClose(index);
    },
  },
};
</script>

<style scoped>
.plugin-popup-container {
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 20, 0.95);
  color: white;
  height: 100%;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  user-select: none;
}

/* Tabs container */
.tabs {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

/* For webkit browsers scrollbar styling */
.tabs::-webkit-scrollbar {
  height: 6px;
}
.tabs::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

/* Each tab */
.tabs > li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  cursor: pointer;
  border-radius: 5px 5px 0 0;
  background: transparent;
  white-space: nowrap;
  transition: background-color 0.25s ease, color 0.25s ease;
  font-weight: 500;
  font-size: 0.9rem;
  color: #ccc;
}

.tabs > li:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Active tab style */
.tabs > li.active {
  background: rgba(255, 255, 255, 0.15);
  font-weight: 700;
  color: white;
  box-shadow: inset 0 -3px 0 0 #4caf50; /* subtle green underline */
}

/* Close button */
.tabs > li button {
  background: transparent;
  border: none;
  color: #aaa;
  font-weight: bold;
  cursor: pointer;
  padding: 0 6px;
  font-size: 0.9rem;
  border-radius: 3px;
  transition: color 0.2s ease;
  line-height: 1;
}

.tabs > li button:hover {
  color: #ff4c4c;
}

/* The component area below tabs */
.component-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  background: rgba(30, 30, 30, 0.95);
  border-radius: 0 0 5px 5px;
}
</style>

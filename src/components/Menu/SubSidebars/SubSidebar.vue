<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <button @click="backToMainMenu" class="btn btn-link text-white back-btn">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h5 class="sub-sidebar-title">{{ title }}</h5>
      <button @click="closeAllSidebars" class="btn btn-link text-white close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="sub-sidebar-body">
      <slot></slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BaseSubSidebar',
  props: {
    title: {
      type: String,
      required: true,
    },
  },
  methods: {
    closeAllSidebars() {
      // Emit a new event to indicate complete sidebar closure
      this.$emit('close-all-sidebars');
    },
    backToMainMenu() {
      // Emit an event to go back to the main sidebar menu
      this.$emit('back-to-main-menu');
    },
  },
};
</script>

<style scoped>
.sub-sidebar-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.sub-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between; /* Changed to space-between to push back/close buttons to ends */
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 30, 30, 0);
}

.sub-sidebar-title {
  flex-grow: 1; /* Allows title to take available space */
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
  /* Removed margin-left: 30px; as justify-content handles spacing */
}

.close-btn, .back-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background: none; /* Ensure no background by default */
  border: none; /* Ensure no border by default */
}

.close-btn:hover, .back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sub-sidebar-body {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  color: white;
}
</style>
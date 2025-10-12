<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <button @click="backToMainMenu" class="btn btn-link text-white back-btn">
        <i class="fas fa-arrow-left"></i>
      </button>
      <h5 class="sub-sidebar-title">{{ displayTitle }}</h5>
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
  computed: {
    displayTitle() {
      // You can add logic here if you want different titles based on context
      // For now, it just returns the prop title
      return this.title;
    }
  },
  methods: {
    closeAllSidebars() {
      this.$emit('close-all-sidebars');
    },
    backToMainMenu() {
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
  justify-content: space-between;
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 30, 30, 0);
}

.sub-sidebar-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  /* Applying Measurement History title styles */
  font-size: 1.2em; /* Matches .history-title */
  font-weight: 600; /* Matches .history-title */
  color: 
#007bff; /* Matches .history-title primary accent color */
}

.close-btn, .back-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  background: none;
  border: none;
}

.close-btn:hover, .back-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sub-sidebar-body {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  color: white;
  padding-right: 5px;
}

.sub-sidebar-body::-webkit-scrollbar {
  width: 8px;
}

.sub-sidebar-body::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.sub-sidebar-body::-webkit-scrollbar-thumb {
  background-color: rgba(100, 100, 100, 0.5);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.sub-sidebar-body::-webkit-scrollbar-thumb:hover {
  background-color: rgba(150, 150, 150, 0.7);
}
</style>
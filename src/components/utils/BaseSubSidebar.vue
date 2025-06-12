<template>
  <div class="sub-sidebar-panel poppins-font">
    <div class="sub-sidebar-header">
      <h5 class="sub-sidebar-title">{{ title }}</h5>
      <button @click="closeSubMenu" class="btn btn-link text-white close-btn">
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
    // You could add an 'icon' prop here if you want an icon in the header next to the title
    // icon: {
    //   type: String,
    //   default: '',
    // },
  },
  methods: {
    closeSubMenu() {
      this.$emit('close-sub-menu');
    },
  },
};
</script>

<style scoped>
/* Common styling for all sub-sidebar panels */
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
  justify-content: flex-end;
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 30, 30, 0);
}

.sub-sidebar-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
  margin-left: 30px; /* Offset for the close button on the right */
}

.close-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sub-sidebar-body {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  color: white;
}

/* Custom styles for input fields, select dropdowns, etc.
   You can either move these common styles here or keep them in individual sub-sidebars
   if they are highly specific to the content within each.
   For now, I'm keeping them in AddDataSidebar for demonstration,
   but consider what truly is 'common' across all sub-sidebars. */
</style>
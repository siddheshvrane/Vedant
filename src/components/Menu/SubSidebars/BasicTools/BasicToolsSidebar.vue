<template>
  <BaseSubSidebar title="Basic Tools">
    <ul class="list-unstyled tool-list">
      <ToolsListItem
        v-for="tool in tools"
        :key="tool.name"
        :tool="tool"
        @activate-tool="activateTool"
      />
      <li v-if="tools.length === 0" class="text-center text-muted mt-3">
        No basic tools available.
      </li>
    </ul>
  </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from '../SubSidebar.vue'; // Adjust path if BaseSubSidebar is elsewhere
import ToolsListItem from './ToolListItem.vue'; // Adjust path based on where you put ToolsListItem.vue
// Assuming ToolManagementService and its methods are globally available or imported elsewhere
// For demonstration, these are commented out as their actual implementation is not provided.
// import {
//   oactivateTool,
//   OexecuteAction
// } from '../services/ToolManagementService';

export default {
  name: 'BasicToolsSidebar',
  components: {
    BaseSubSidebar,
    ToolsListItem,
  },
  data() {
    return {
      tools: [
        { name: 'Line Measure', isActive: false },
        { name: '3D Line Measure', isActive: false },
        { name: 'Area Measure', isActive: false },
        { name: '3D Area Measure', isActive: false },
        { name: 'Viewshield Analysis', isActive: false },
        { name: 'Terrain Profile', isActive: false },
      ],
    };
  },
  methods: {
    // This method is called by ToolsListItem events when a tool is selected via radio button.
    async activateTool(toolName) {
      console.log(`Attempting to activate tool: ${toolName}`);

      // Find the tool that was clicked
      const clickedTool = this.tools.find(tool => tool.name === toolName);

      if (clickedTool) {
        // If the clicked tool is already active, deactivate it (radio buttons typically don't allow unchecking,
        // but this adds explicit deactivation logic if a "none selected" state is desired or another tool is chosen).
        if (clickedTool.isActive) {
          console.log(`${toolName} was already active. Deactivating.`);
          clickedTool.isActive = false;
          // Implement actual tool deactivation logic here
          alert(`Action: Deactivated ${clickedTool.name}`);
        } else {
          // Deactivate all other tools first to ensure only one is active (radio button behavior)
          this.tools.forEach(tool => {
            if (tool.name !== toolName && tool.isActive) {
              tool.isActive = false;
              console.log(`Deactivating previously active tool: ${tool.name}`);
              // Implement actual tool deactivation logic for previously active tool
            }
          });

          // Activate the clicked tool
          clickedTool.isActive = true;
          alert(`Action: Activated ${clickedTool.name}`);
          console.log(`${clickedTool.name} activated.`);

          // Simulate tool activation through a service
          // try {
          //   oactivateTool(clickedTool.name);
          //   console.log(`${clickedTool.name} activated successfully.`);
          //   OexecuteAction(); // Or execute action specific to the activated tool
          // } catch (error) {
          //   console.error(`Error activating ${clickedTool.name}:`, error);
          //   clickedTool.isActive = false; // Revert state if activation fails
          //   alert(`Failed to activate ${clickedTool.name}.`);
          // }
        }
      }
    },
  },
};
</script>

<style scoped>
/* Inherit common sub-sidebar panel styles from LayerManagerSidebar.vue */
.sub-sidebar-panel {
  width: 350px; /* Consistent width for this sidebar */
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
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
}

.sub-sidebar-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
  margin-left: 30px;
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

/* Tool List Specific Styles */
.tool-list {
  padding: 0;
  margin: 0;
}
</style>
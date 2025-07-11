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
import { ToolManagementService } from '../../../../services/ToolManagementService'; // NEW: Import the service

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
      activeToolSubscription: null, // NEW: For listening to active tool changes
    };
  },
  mounted() {
    // Subscribe to the activeTool$ in ToolManagementService
    // This keeps the UI state synchronized with the service's active tool
    this.activeToolSubscription = ToolManagementService.activeTool$.subscribe(activeToolName => {
        this.tools.forEach(tool => {
            tool.isActive = (tool.name === activeToolName);
        });
        if (activeToolName) {
            console.log(`UI: Tool '${activeToolName}' is now active.`);
        } else {
            console.log('UI: No tool is active.');
        }
    });
  },
  beforeUnmount() {
    // Deactivate any active tool in the service when the sidebar unmounts
    ToolManagementService.deactivateCurrentTool();
    if (this.activeToolSubscription) {
        this.activeToolSubscription.unsubscribe();
    }
  },
  methods: {
    // This method is called by ToolsListItem events when a tool is selected via radio button.
    async activateTool(toolName) {
      console.log(`BasicToolsSidebar: Request to activate tool: ${toolName}`);

      const clickedTool = this.tools.find(tool => tool.name === toolName);

      if (clickedTool) {
        if (clickedTool.isActive) {
          // If the clicked tool is already active, it means the user clicked the active radio.
          // In a radio button context, clicking an active radio usually doesn't unselect it.
          // If you want it to toggle OFF, you'd need custom radio button behavior or a "None" option.
          // For now, if active, we interpret it as a re-selection (no change in active tool in service)
          // or a desire to deactivate if it's the only one selected.
          // For true radio behavior, this block might be removed, relying on the new selection to deactivate.
          console.log(`${toolName} was already active. Sending deactivate command.`);
          ToolManagementService.deactivateCurrentTool(); // Deactivate it
        } else {
          // Activate the tool via the service
          ToolManagementService.activateTool(toolName);
          // The subscription to activeTool$ will handle updating this.tools to reflect the new state.
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

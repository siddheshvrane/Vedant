<template>
  <BaseSubSidebar title="Basic Tools">
    <ul class="list-unstyled tool-list">
      <ToolsListItem
        v-for="tool in tools"
        :key="tool.name"
        :tool="tool"
        @activate-tool="activateTool" />
      <li v-if="tools.length === 0" class="text-center text-muted mt-3">
        No basic tools available.
      </li>
    </ul>

    <MeasurementHistory class="mt-4" />

    </BaseSubSidebar>
</template>

<script>
import BaseSubSidebar from "../SubSidebar.vue";
import ToolsListItem from "./ToolListItem.vue";
import MeasurementHistory from "./MeasurementHistory.vue";
// REMOVED: import TerrainProfilePopup from "../BasicTools/TerrainProfilePopup.vue";
import { ToolManagementService } from "../../../../services/ToolManagementService";
// REMOVED: import { getToolState } from "../BasicTools/tool-helpers/tools-helpers.js";
// getToolState is no longer needed here as handleRemoveProfile moved to Popup.vue

export default {
  name: "BasicToolsSidebar",
  components: {
    BaseSubSidebar,
    ToolsListItem,
    MeasurementHistory,
    // REMOVED: TerrainProfilePopup,
  },
  data() {
    return {
      tools: [
        { name: "Line Measure", isActive: false },
        { name: "3D Line Measure", isActive: false },
        { name: "Area Measure", isActive: false },
        { name: "3D Area Measure", isActive: false },
        { name: "Viewshield Analysis", isActive: false },
        { name: "Terrain Profile", isActive: false },
      ],
      activeToolSubscription: null,
      // REMOVED: showProfilePopup: false,
      // REMOVED: terrainProfileData: [],
      // REMOVED: terrainProfileEntity: null, // ✅ Track the polyline entity
    };
  },
  mounted() {
    this.activeToolSubscription = ToolManagementService.activeTool$.subscribe(
      (activeToolName) => {
        this.tools.forEach((tool) => {
          tool.isActive = tool.name === activeToolName;
        });
        console.log(`UI: Tool '${activeToolName || "None"}' is now active.`);
      }
    );

    // REMOVED: window.addEventListener("terrain-profile-ready", (e) => { ... });
    // This event listener is now in Popup.vue
  },
  beforeUnmount() {
    ToolManagementService.deactivateCurrentTool();
    if (this.activeToolSubscription) {
      this.activeToolSubscription.unsubscribe();
    }
  },
  methods: {
    async activateTool(toolName) {
      console.log(`BasicToolsSidebar: Request to activate tool: ${toolName}`);
      const clickedTool = this.tools.find((tool) => tool.name === toolName);

      if (clickedTool) {
        if (clickedTool.isActive) {
          console.log(
            `${toolName} was already active. Sending deactivate command.`
          );
          ToolManagementService.deactivateCurrentTool();
        } else {
          ToolManagementService.activateTool(toolName);
        }
      }
    },

    // REMOVED: handleRemoveProfile() method
    // This method is now in Popup.vue
  },
};
</script>

<style scoped>
/* No changes needed in styles unless you want to clean up unused rules */
.sub-sidebar-panel {
  width: 350px;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.poppins-font {
  font-family: "Poppins", sans-serif;
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

.tool-list {
  padding: 0;
  margin: 0;
}
</style>
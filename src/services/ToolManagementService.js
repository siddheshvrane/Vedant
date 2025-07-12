// src/services/ToolManagementService.js
import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';
import { MapService } from './MapService.js';

// Import individual tool setup functions
import { setupLineMeasureTool } from './tools/LineMeasureTool.js';
import { setupAreaMeasureTool } from './tools/AreaMeasureTool.js';
import { setupViewshieldAnalysisTool } from './tools/ViewshieldAnalysisTool.js';
import { setupTerrainProfileTool } from './tools/TerrainProfileTool.js';

// Import helper functions and common drawing methods
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint,
    addPersistentLabel,
    updateTemporaryLabel,
    getToolState,
    setToolState // Import the new setter
} from './tool-helpers/tools-helpers.js';

class ToolManagementServiceClass {
    activeTool$ = new BehaviorSubject(null); // Stores the name of the active tool

    constructor() {
        // Subscribe to MapService to get the Cesium viewer instance
        MapService.globeViewer$.subscribe(viewer => {
            // Update the viewer and handler in the tool state
            setToolState({
                viewer: viewer,
                handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null
            });

            if (viewer) {
                console.log("ToolManagementService: Received Cesium Viewer instance.");
            } else {
                this.deactivateCurrentTool();
                // Handler will be destroyed if viewer is null via setToolState
            }
        });
    }

    /**
     * Activates a specific tool and deactivates any currently active one.
     * @param {string} toolName - The name of the tool to activate.
     */
    activateTool(toolName) {
        const { viewer } = getToolState();
        if (!viewer) {
            console.warn("ToolManagementService: Cesium Viewer not available. Cannot activate tool.");
            return;
        }

        // Toggle behavior: if the same tool is clicked, deactivate it
        if (this.activeTool$.getValue() === toolName) {
            this.deactivateCurrentTool();
            return;
        }

        // Deactivate current tool if different
        this.deactivateCurrentTool();

        // Activate the new tool
        this.activeTool$.next(toolName);
        console.log(`ToolManagementService: Activating tool: ${toolName}`);

        switch (toolName) {
            case 'Line Measure': // User wants this to be 3D Displacement
                setupLineMeasureTool(true, false); // isDisplacement = true, clampShapeToGround = false
                break;
            case '3D Line Measure': // User wants this to be 3D Elevation Terrain Following
                setupLineMeasureTool(false, true); // isDisplacement = false, clampShapeToGround = true
                break;
            case 'Area Measure': // User wants this to be 3D Projected Area
                setupAreaMeasureTool(true, false); // isProjectedArea = true, clampShapeToGround = false
                break;
            case '3D Area Measure': // User wants this to be 3D Elevation Terrain Following Area
                setupAreaMeasureTool(false, true); // isProjectedArea = false, clampToGround = true
                break;
            case 'Viewshield Analysis':
                setupViewshieldAnalysisTool();
                break;
            case 'Terrain Profile':
                setupTerrainProfileTool();
                break;
            default:
                console.warn(`ToolManagementService: Unknown tool requested: ${toolName}`);
                this.deactivateCurrentTool();
                break;
        }
    }

    /**
     * Deactivates the currently active tool and cleans up its resources.
     */
    deactivateCurrentTool() {
        const activeTool = this.activeTool$.getValue();
        if (activeTool) {
            console.log(`ToolManagementService: Deactivating tool: ${activeTool}`);
            clearDrawing();
            removeEventHandlers();
        }
        this.activeTool$.next(null);
    }
}

export const ToolManagementService = new ToolManagementServiceClass();
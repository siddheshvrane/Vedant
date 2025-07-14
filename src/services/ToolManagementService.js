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
    setToolState
} from './tool-helpers/tools-helpers.js';

class ToolManagementServiceClass {
    // FIX: Removed the extra 'new' keyword here.
    activeTool$ = new BehaviorSubject(null); // Stores the name of the active tool

    constructor() {
        // Subscribe to MapService to get the Cesium viewer instance
        MapService.globeViewer$.subscribe(viewer => {
            // Always deactivate current tool and clear drawing before potentially updating viewer/handler.
            // This ensures a clean state and proper cleanup if the viewer changes or becomes null.
            this.deactivateCurrentTool();

            // Update the viewer and handler in the tool state.
            // setToolState now explicitly handles destroying the old handler if a new one is provided
            // or if the handler is being set to null.
            setToolState({
                viewer: viewer,
                // Create a new handler only if a viewer exists.
                // If viewer is null, the handler property will be set to null,
                // triggering destruction of any existing handler within setToolState.
                handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null
            });

            if (viewer) {
                console.log("ToolManagementService: Received Cesium Viewer instance. Handler initialized.");
                // Optional: For performance, if you only render on changes, enable requestRenderMode
                // viewer.scene.requestRenderMode = true;
                // viewer.scene.maximumRenderTimeChange = Infinity;
            } else {
                console.log("ToolManagementService: Cesium Viewer is null. Tools deactivated and resources cleaned.");
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
        // This will clean up drawings and remove old event handlers.
        this.deactivateCurrentTool();

        // Activate the new tool
        this.activeTool$.next(toolName);
        console.log(`ToolManagementService: Activating tool: ${toolName}`);

        // If requestRenderMode is enabled, request a render after tool activation
        // if (viewer.scene.requestRenderMode) {
        //     viewer.scene.requestRender();
        // }

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
                this.deactivateCurrentTool(); // Deactivate to ensure a clean state
                break;
        }
    }

    /**
     * Deactivates the currently active tool and cleans up its resources.
     * This function now primarily orchestrates cleanup by calling helper functions.
     */
    deactivateCurrentTool() {
        const activeTool = this.activeTool$.getValue();
        if (activeTool) {
            console.log(`ToolManagementService: Deactivating tool: ${activeTool}`);
            clearDrawing(); // Clears all entities related to drawing
            removeEventHandlers(); // Removes input actions from the current handler
        }
        this.activeTool$.next(null);

        // If requestRenderMode is enabled, request a render after deactivation/cleanup
        // const { viewer } = getToolState();
        // if (viewer && viewer.scene.requestRenderMode) {
        //     viewer.scene.requestRender();
        // }
    }
}

export const ToolManagementService = new ToolManagementServiceClass();
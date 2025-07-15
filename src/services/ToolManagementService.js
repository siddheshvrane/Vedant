import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';
import { MapService } from './MapService.js';

// Import individual tool setup functions
import { setupLineMeasureTool } from '../components/Menu/SubSidebars/BasicTools/tools/LineMeasureTool.js';
import { setupAreaMeasureTool } from '../components/Menu/SubSidebars/BasicTools/tools/AreaMeasureTool.js';
import { setupViewshieldAnalysisTool } from '../components/Menu/SubSidebars/BasicTools/tools/ViewshieldAnalysisTool.js';
import { setupTerrainProfileTool } from '../components/Menu/SubSidebars/BasicTools/tools/TerrainProfileTool.js';

// Import helper functions and common drawing methods
import {
    clearDrawing,
    removeEventHandlers,
    addTemporaryPoint, // Keep if needed by specific tools
    addPersistentLabel, // Keep if needed by specific tools
    updateTemporaryLabel, // Keep if needed by specific tools
    getToolState,
    setToolState,
    removeAllToolEntities, // NEW: Function to clear all entities created by tools
    // addEntity, // REMOVE THIS - it's not exported by tools-helpers.js in the way you expect
    // removeEntity // REMOVE THIS - it's not exported by tools-helpers.js in the way you expect
    // If you plan to use addPersistentEntity for general purpose, add it here:
    addPersistentEntity // Make sure this is exported from tools-helpers.js
} from '../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js';

class ToolManagementServiceClass {
    activeTool$ = new BehaviorSubject(null); // Stores the name of the active tool
    measurementHistory$ = new BehaviorSubject([]); // NEW: Stores an array of measurement objects
    nextMeasurementId = 0; // NEW: To generate unique IDs for measurements
    toolOperationCounters = {}; // NEW: To track operation numbers per tool

    constructor() {
        MapService.globeViewer$.subscribe(viewer => {
            this.deactivateCurrentTool();
            setToolState({
                viewer: viewer,
                handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null
            });

            if (viewer) {
                console.log("ToolManagementService: Received Cesium Viewer instance. Handler initialized.");
                // Ensure all entities from previous sessions are cleared on new viewer init
                removeAllToolEntities(viewer);
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

        this.deactivateCurrentTool(); // Deactivate current tool if different

        this.activeTool$.next(toolName);
        console.log(`ToolManagementService: Activating tool: ${toolName}`);

        switch (toolName) {
            case 'Line Measure':
                setupLineMeasureTool(true, false); // isDisplacement = true, clampShapeToGround = false
                break;
            case '3D Line Measure':
                setupLineMeasureTool(false, true); // isDisplacement = false, clampShapeToGround = true
                break;
            case 'Area Measure':
                setupAreaMeasureTool(true, false); // isProjectedArea = true, clampShapeToGround = false
                break;
            case '3D Area Measure':
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
            clearDrawing(); // Clears temporary drawing entities
            removeEventHandlers(); // Removes input actions from the current handler
        }
        this.activeTool$.next(null);
    }

    /**
     * Adds a new measurement to the history.
     * @param {string} toolName - The name of the tool that performed the measurement.
     * @param {string} value - The formatted measurement value (e.g., "10.5 km").
     * @param {Object} entities - An object containing Cesium entities associated with this measurement (e.g., { polyline: entity, label: entity }).
     */
    addMeasurement(toolName, value, entities) {
        // Increment operation counter for this tool
        if (!this.toolOperationCounters[toolName]) {
            this.toolOperationCounters[toolName] = 0;
        }
        this.toolOperationCounters[toolName]++;
        const operationNumber = this.toolOperationCounters[toolName];

        const newMeasurement = {
            id: this.nextMeasurementId++,
            toolName: toolName,
            operationNumber: operationNumber,
            value: value,
            entities: entities, // Store Cesium entities reference
            isEnabled: true // New measurements are enabled by default
        };

        const currentHistory = this.measurementHistory$.getValue();
        const updatedHistory = [...currentHistory, newMeasurement];
        this.measurementHistory$.next(updatedHistory);
        console.log("Measurement added:", newMeasurement);

        // Ensure entities are added to the viewer
        const { viewer } = getToolState();
        if (viewer) {
            for (const key in entities) {
                if (entities[key] && !viewer.entities.contains(entities[key])) {
                    viewer.entities.add(entities[key]); // Direct Cesium API call, no helper needed here
                }
            }
        }
    }

    /**
     * Removes a measurement from the history and from the Cesium viewer.
     * @param {number} id - The ID of the measurement to remove.
     */
    removeMeasurement(id) {
        const { viewer } = getToolState();
        const currentHistory = this.measurementHistory$.getValue();
        const measurementToRemove = currentHistory.find(m => m.id === id);

        if (measurementToRemove) {
            // Remove associated Cesium entities from the viewer
            if (viewer && measurementToRemove.entities) {
                for (const key in measurementToRemove.entities) {
                    if (measurementToRemove.entities[key]) {
                        viewer.entities.remove(measurementToRemove.entities[key]); // Direct Cesium API call, no helper needed here
                    }
                }
            }

            const updatedHistory = currentHistory.filter(m => m.id !== id);
            this.measurementHistory$.next(updatedHistory);
            console.log(`Measurement with ID ${id} removed.`);
        }
    }

    /**
     * Toggles the enabled state of a measurement and its visibility on the Cesium viewer.
     * @param {number} id - The ID of the measurement to toggle.
     */
    toggleMeasurementEnabled(id) {
        const currentHistory = this.measurementHistory$.getValue();
        const updatedHistory = currentHistory.map(m => {
            if (m.id === id) {
                const newEnabledState = !m.isEnabled;
                // Update visibility of associated Cesium entities
                const { viewer } = getToolState();
                if (viewer && m.entities) {
                    for (const key in m.entities) {
                        if (m.entities[key] && m.entities[key].show !== undefined) {
                            m.entities[key].show = newEnabledState;
                        }
                    }
                }
                return { ...m, isEnabled: newEnabledState };
            }
            return m;
        });
        this.measurementHistory$.next(updatedHistory);
        console.log(`Measurement with ID ${id} toggled.`);
    }

    /**
     * Retrieves a measurement by its ID.
     * @param {number} id - The ID of the measurement.
     * @returns {Object|undefined} The measurement object or undefined if not found.
     */
    getMeasurementById(id) {
        return this.measurementHistory$.getValue().find(m => m.id === id);
    }
}

export const ToolManagementService = new ToolManagementServiceClass();
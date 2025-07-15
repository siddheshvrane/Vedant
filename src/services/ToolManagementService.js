// services/ToolManagementService.js

import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';
import { MapService } from './MapService.js';
// NEW: Import PopupService
import { PopupService } from './PopupService.js'; // Ensure this path is correct based on your project structure

// Import individual tool setup functions
import { setupLineMeasureTool } from '../components/Menu/SubSidebars/BasicTools/tools/LineMeasureTool.js';
import { setupAreaMeasureTool } from '../components/Menu/SubSidebars/BasicTools/tools/AreaMeasureTool.js';
import { setupViewshieldAnalysisTool } from '../components/Menu/SubSidebars/BasicTools/tools/ViewshieldAnalysisTool.js';
import { setupTerrainProfileTool } from '../components/Menu/SubSidebars/BasicTools/tools/TerrainProfileTool.js';

// Import helper functions and common drawing methods
import {
    clearDrawing,
    removeEventHandlers,
    getToolState,
    setToolState,
    addPersistentEntity // Crucial: This function MUST be exported from tools-helpers.js and add the entity to viewer.entities
} from '../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js';

class ToolManagementServiceClass {
    activeTool$ = new BehaviorSubject(null); // Stores the name of the active tool
    measurementHistory$ = new BehaviorSubject([]); // Stores an array of measurement objects
    nextMeasurementId = 0; // To generate unique IDs for measurements
    toolOperationCounters = {}; // To track operation numbers per tool

    constructor() {
        MapService.globeViewer$.subscribe(viewer => {
            // Deactivate current tool and clean up handlers and temporary drawings
            // This also calls clearDrawing and removeEventHandlers
            // Call this BEFORE setting the new viewer/handler in toolState to ensure old handlers are destroyed.
            this.deactivateCurrentTool(); 

            // Set the viewer and handler in the global tool state for helpers to access
            // This is essential for all tool functions and helpers to interact with Cesium
            setToolState({
                viewer: viewer,
                // Only create a handler if a viewer exists
                handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null
            });

            if (viewer) {
                console.log("ToolManagementService: Received Cesium Viewer instance. Handler initialized.");
                // Clear any existing persistent measurements from previous viewer sessions
                this._clearAllPersistentMeasurements();
            } else {
                console.log("ToolManagementService: Cesium Viewer is null. Tools deactivated and resources cleaned.");
                // If viewer becomes null, clear all history as entities are no longer valid
                this._clearAllPersistentMeasurements();
            }
        });
    }

    /**
     * Clears all persistent measurements from the viewer and history.
     * Called when the viewer changes or on service initialization.
     * @private
     */
    _clearAllPersistentMeasurements() {
        const { viewer } = getToolState();
        const currentHistory = this.measurementHistory$.getValue();

        currentHistory.forEach(measurement => {
            if (viewer && measurement.cesiumEntities) {
                // Iterate over the stored actual Cesium Entity objects
                // The structure of measurement.cesiumEntities should mirror entityDefinitions
                // e.g., { polyline: Cesium.Entity, points: [Cesium.Entity, ...], labels: [Cesium.Entity, ...] }
                for (const key in measurement.cesiumEntities) {
                    const entityOrArray = measurement.cesiumEntities[key];
                    if (Array.isArray(entityOrArray)) {
                        entityOrArray.forEach(e => {
                            if (e instanceof Cesium.Entity && viewer.entities.contains(e)) {
                                viewer.entities.remove(e);
                            }
                        });
                    } else if (entityOrArray instanceof Cesium.Entity && viewer.entities.contains(entityOrArray)) {
                        viewer.entities.remove(entityOrArray);
                    }
                }
            }
        });
        this.measurementHistory$.next([]); // Clear the history in the BehaviorSubject
        this.nextMeasurementId = 0; // Reset ID counter
        this.toolOperationCounters = {}; // Reset operation counters
        console.log("ToolManagementService: All persistent measurements cleared.");
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

        // Call the specific setup function for the tool
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
                this.deactivateCurrentTool(); // Deactivate if tool is unknown
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
            clearDrawing(); // Clears temporary drawing entities (from tools-helpers.js)
            removeEventHandlers(); // Removes input actions from the current handler (from tools-helpers.js)
        }
        this.activeTool$.next(null); // Set active tool to null
        // Ensure PopupService is imported before this line.
        if (typeof PopupService !== 'undefined' && PopupService.hide) {
            PopupService.hide(); // Ensure any instruction popups are hidden
        } else {
            console.warn("PopupService not available or does not have a 'hide' method.");
        }
    }

    /**
     * Adds a new measurement to the history and adds its Cesium entities to the viewer.
     * This function now expects entity *definitions* and uses `addPersistentEntity` helper
     * to create and add the actual Cesium Entity objects to the viewer.
     *
     * @param {string} toolName - The name of the tool that performed the measurement.
     * @param {string} value - The formatted measurement value (e.g., "10.5 km").
     * @param {Object} entityDefinitions - An object containing Cesium entity *definitions*.
     * Expected structure:
     * {
     * polyline?: { polyline: { ... } }, // For line measure
     * polygon?: { polygon: { ... } },   // For area measure
     * points?: [{ point: { ... } }, ...], // Array of point definitions
     * labels?: [{ label: { ... } }, ...], // Array of label definitions
     * // Add other entity types as needed for different tools (e.g., billboards, models)
     * }
     */
    addMeasurement(toolName, value, entityDefinitions) {
        const { viewer } = getToolState();
        if (!viewer) {
            console.error("ToolManagementService: Viewer not available. Cannot add measurement.");
            return;
        }

        // Increment operation counter for this tool (e.g., "Line Measure 1", "Line Measure 2")
        if (!this.toolOperationCounters[toolName]) {
            this.toolOperationCounters[toolName] = 0;
        }
        this.toolOperationCounters[toolName]++;
        const operationNumber = this.toolOperationCounters[toolName];

        const createdCesiumEntities = {}; // This will store the *actual* Cesium Entity objects

        // --- Process and add polyline entity (for LineMeasureTool) ---
        if (entityDefinitions.polyline) {
            const polylineEntity = addPersistentEntity(entityDefinitions.polyline);
            if (polylineEntity) {
                createdCesiumEntities.polyline = polylineEntity;
            }
        }

        // --- Process and add polygon entity (for AreaMeasureTool) ---
        if (entityDefinitions.polygon) {
            const polygonEntity = addPersistentEntity(entityDefinitions.polygon);
            if (polygonEntity) {
                createdCesiumEntities.polygon = polygonEntity;
            }
        }

        // --- Process and add point entities (common to many tools) ---
        if (entityDefinitions.points && Array.isArray(entityDefinitions.points)) {
            createdCesiumEntities.points = []; // Initialize as an array
            entityDefinitions.points.forEach(pointDef => {
                const pointEntity = addPersistentEntity(pointDef);
                if (pointEntity) {
                    createdCesiumEntities.points.push(pointEntity);
                }
            });
        }

        // --- Process and add label entities (common to many tools) ---
        if (entityDefinitions.labels && Array.isArray(entityDefinitions.labels)) {
            createdCesiumEntities.labels = []; // Initialize as an array
            entityDefinitions.labels.forEach(labelDef => {
                const labelEntity = addPersistentEntity(labelDef);
                if (labelEntity) {
                    createdCesiumEntities.labels.push(labelEntity);
                }
            });
        }

        // --- Add other entity types here as needed for other tools (e.g., billboards, models, viewshield cone) ---
        if (entityDefinitions.billboards && Array.isArray(entityDefinitions.billboards)) {
            createdCesiumEntities.billboards = [];
            entityDefinitions.billboards.forEach(billboardDef => {
                const billboardEntity = addPersistentEntity(billboardDef);
                if (billboardEntity) {
                    createdCesiumEntities.billboards.push(billboardEntity);
                }
            });
        }

        if (entityDefinitions.models && Array.isArray(entityDefinitions.models)) {
            createdCesiumEntities.models = [];
            entityDefinitions.models.forEach(modelDef => {
                const modelEntity = addPersistentEntity(modelDef);
                if (modelEntity) {
                    createdCesiumEntities.models.push(modelEntity);
                }
            });
        }

        if (entityDefinitions.viewshieldCone) {
            const viewshieldConeEntity = addPersistentEntity(entityDefinitions.viewshieldCone);
            if (viewshieldConeEntity) {
                createdCesiumEntities.viewshieldCone = viewshieldConeEntity;
            }
        }
        // ... and so on for other complex entities specific to tools

        const newMeasurement = {
            id: this.nextMeasurementId++, // Assign a unique ID
            toolName: toolName,
            operationNumber: operationNumber,
            value: value,
            cesiumEntities: createdCesiumEntities, // Store references to the actual Cesium Entity objects
            isEnabled: true // New measurements are enabled (visible) by default
        };

        const currentHistory = this.measurementHistory$.getValue();
        const updatedHistory = [...currentHistory, newMeasurement];
        this.measurementHistory$.next(updatedHistory); // Update the observable history
        console.log("Measurement added to history:", newMeasurement);

        // Request a render to ensure new entities are immediately visible
        if (viewer.scene.requestRenderMode) {
            viewer.scene.requestRender();
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
            if (viewer && measurementToRemove.cesiumEntities) {
                for (const key in measurementToRemove.cesiumEntities) {
                    const entityOrArray = measurementToRemove.cesiumEntities[key];
                    if (Array.isArray(entityOrArray)) {
                        entityOrArray.forEach(entity => {
                            // Ensure it's a Cesium Entity and it's actually in the viewer's collection
                            if (entity instanceof Cesium.Entity && viewer.entities.contains(entity)) {
                                viewer.entities.remove(entity);
                            }
                        });
                    } else if (entityOrArray instanceof Cesium.Entity && viewer.entities.contains(entityOrArray)) {
                        viewer.entities.remove(entityOrArray);
                    }
                }
            }

            const updatedHistory = currentHistory.filter(m => m.id !== id);
            this.measurementHistory$.next(updatedHistory);
            console.log(`Measurement with ID ${id} removed.`);

            // Request a render after removal
            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn(`Attempted to remove non-existent measurement with ID: ${id}`);
        }
    }

    /**
     * Toggles the enabled state (visibility) of a measurement and its associated Cesium entities.
     * @param {number} id - The ID of the measurement to toggle.
     */
    toggleMeasurementEnabled(id) {
        const currentHistory = this.measurementHistory$.getValue();
        let measurementUpdated = false;

        const updatedHistory = currentHistory.map(m => {
            if (m.id === id) {
                const newEnabledState = !m.isEnabled;
                measurementUpdated = true; // Mark that an update occurred

                // Update visibility of associated Cesium entities
                const { viewer } = getToolState();
                if (viewer && m.cesiumEntities) {
                    for (const key in m.cesiumEntities) {
                        const entityOrArray = m.cesiumEntities[key];
                        if (Array.isArray(entityOrArray)) {
                            entityOrArray.forEach(entity => {
                                // Ensure it's a Cesium Entity and has a 'show' property
                                if (entity instanceof Cesium.Entity && entity.show !== undefined) {
                                    entity.show = newEnabledState;
                                }
                            });
                        } else if (entityOrArray instanceof Cesium.Entity && entityOrArray.show !== undefined) {
                            entityOrArray.show = newEnabledState;
                        }
                    }
                }
                return { ...m, isEnabled: newEnabledState };
            }
            return m;
        });

        if (measurementUpdated) {
            this.measurementHistory$.next(updatedHistory);
            console.log(`Measurement with ID ${id} visibility toggled.`);

            // Request a render after visibility change
            const { viewer } = getToolState();
            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        } else {
            console.warn(`Attempted to toggle non-existent measurement with ID: ${id}`);
        }
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
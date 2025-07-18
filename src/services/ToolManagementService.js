// services/ToolManagementService.js

import { Subject, BehaviorSubject } from 'rxjs';
import * as Cesium from 'cesium';
import { MapService } from './MapService.js';
import { PopupService } from './PopupService.js';

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
    addPersistentEntity, // Crucial: This function MUST be exported from tools-helpers.js and add the entity to viewer.entities
    removeAllToolEntities
} from '../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js';

class ToolManagementServiceClass {
    activeTool$ = new BehaviorSubject(null);
    measurementHistory$ = new BehaviorSubject([]);
    nextMeasurementId = 0;
    toolOperationCounters = {};

    constructor() {
        MapService.globeViewer$.subscribe(viewer => {
            this.deactivateCurrentTool();

            setToolState({
                viewer: viewer,
                handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null
            });

            if (viewer) {
                console.log("[TMS]: Received Cesium Viewer instance. Handler initialized.");
                this._clearAllPersistentMeasurements();
                removeAllToolEntities(viewer); // Ensure all temporary tool entities are cleared on viewer change
            } else {
                console.log("[TMS]: Cesium Viewer is null. Tools deactivated and resources cleaned.");
                this._clearAllPersistentMeasurements(); // Still clear history even if viewer is null
            }
        });
    }

    _clearAllPersistentMeasurements() {
        const { viewer } = getToolState();
        const currentHistory = this.measurementHistory$.getValue();

        // Use requestAnimationFrame to defer removal of all entities
        requestAnimationFrame(() => {
            currentHistory.forEach(measurement => {
                if (viewer && measurement.cesiumEntities) {
                    for (const key in measurement.cesiumEntities) {
                        const entityOrArray = measurement.cesiumEntities[key];
                        if (Array.isArray(entityOrArray)) {
                            entityOrArray.forEach(e => {
                                if (e instanceof Cesium.Entity) { // Removed viewer.entities.contains(e) check for _clearAll to try forceful removal
                                    // console.log(`[TMS]: Attempting to clear persistent entity (full reset) ID: ${e.id}, Type: ${key}`);
                                    viewer.entities.remove(e);
                                }
                            });
                        } else if (entityOrArray instanceof Cesium.Entity) { // Removed viewer.entities.contains(entityOrArray)
                            // console.log(`[TMS]: Attempting to clear persistent entity (full reset) ID: ${entityOrArray.id}, Type: ${key}`);
                            viewer.entities.remove(entityOrArray);
                        }
                    }
                }
            });

            this.measurementHistory$.next([]);
            this.nextMeasurementId = 0;
            this.toolOperationCounters = {};
            console.log("[TMS]: All persistent measurements cleared.");

            if (viewer) {
                removeAllToolEntities(viewer);
                console.log("[TMS]: All temporary tool entities cleared during full measurement reset.");
                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender(); // Request render after all removals
                }
            }
        });
    }

    activateTool(toolName) {
        const { viewer } = getToolState();
        if (!viewer) {
            console.warn("[TMS]: Cesium Viewer not available. Cannot activate tool.");
            return;
        }

        if (this.activeTool$.getValue() === toolName) {
            this.deactivateCurrentTool();
            return;
        }

        this.deactivateCurrentTool();

        this.activeTool$.next(toolName);
        console.log(`[TMS]: Activating tool: ${toolName}`);

        switch (toolName) {
            case 'Line Measure':
                setupLineMeasureTool(true, false);
                break;
            case '3D Line Measure':
                setupLineMeasureTool(false, true);
                break;
            case 'Area Measure':
                setupAreaMeasureTool(true, false);
                break;
            case '3D Area Measure':
                setupAreaMeasureTool(false, true);
                break;
            case 'Viewshield Analysis':
                setupViewshieldAnalysisTool();
                break;
            case 'Terrain Profile':
                setupTerrainProfileTool();
                break;
            default:
                console.warn(`[TMS]: Unknown tool requested: ${toolName}`);
                this.deactivateCurrentTool();
                break;
        }
    }

    deactivateCurrentTool() {
        const activeTool = this.activeTool$.getValue();
        if (activeTool) {
            console.log(`[TMS]: Deactivating tool: ${activeTool}`);
            clearDrawing();
            removeEventHandlers();
        }
        this.activeTool$.next(null);

        if (typeof PopupService !== 'undefined' && PopupService.hide) {
            PopupService.hide();
        } else {
            console.warn("[TMS]: PopupService not available or does not have a 'hide' method.");
        }
    }

    /**
     * Adds a new measurement to the history and adds its Cesium entities to the viewer.
     * This function now expects entity *definitions* and uses `addPersistentEntity` helper
     * to create and add the actual Cesium Entity objects to the viewer.
     *
     * IMPORTANT CHANGE: Using requestAnimationFrame() to defer entity additions
     * to ensure visual updates are synchronized with the browser's rendering cycle.
     *
     * @param {string} toolName - The name of the tool that performed the measurement.
     * @param {string} value - The formatted measurement value (e.g., "10.5 km").
     * @param {Object} entityDefinitions - An object containing Cesium entity *definitions*.
     */
    addMeasurement(toolName, value, entityDefinitions) {
        const { viewer } = getToolState();
        if (!viewer) {
            console.error("[TMS]: Viewer not available. Cannot add measurement.");
            return;
        }

        // Increment operation counter for this tool
        if (!this.toolOperationCounters[toolName]) {
            this.toolOperationCounters[toolName] = 0;
        }
        this.toolOperationCounters[toolName]++;
        const operationNumber = this.toolOperationCounters[toolName];

        const createdCesiumEntities = {}; // This will store the *actual* Cesium Entity objects

        // Use requestAnimationFrame() to defer the synchronous entity additions.
        // This ensures the browser can render other UI updates before starting Cesium entity creation.
        requestAnimationFrame(() => {
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
                createdCesiumEntities.points = [];
                entityDefinitions.points.forEach(pointDef => {
                    const pointEntity = addPersistentEntity(pointDef);
                    if (pointEntity) {
                        createdCesiumEntities.points.push(pointEntity);
                    }
                });
            }

            // --- Process and add label entities (common to many tools) ---
            if (entityDefinitions.labels && Array.isArray(entityDefinitions.labels)) {
                createdCesiumEntities.labels = [];
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
                id: this.nextMeasurementId++,
                toolName: toolName,
                operationNumber: operationNumber,
                value: value,
                cesiumEntities: createdCesiumEntities,
                isEnabled: true
            };

            const currentHistory = this.measurementHistory$.getValue();
            const updatedHistory = [...currentHistory, newMeasurement];
            this.measurementHistory$.next(updatedHistory);
            console.log("[TMS]: Measurement added to history:", newMeasurement);

            // Request a render to ensure new entities are immediately visible after they are added
            if (viewer.scene.requestRenderMode) {
                viewer.scene.requestRender();
            }
        }); // End of requestAnimationFrame()
    }

    removeMeasurement(id) {
        const { viewer } = getToolState();
        const currentHistory = this.measurementHistory$.getValue();
        const measurementToRemove = currentHistory.find(m => m.id === id);

        if (measurementToRemove) {
            // Remove the measurement from the history immediately for UI responsiveness
            const updatedHistory = currentHistory.filter(m => m.id !== id);
            this.measurementHistory$.next(updatedHistory);
            console.log(`[TMS]: Measurement with ID ${id} removed from history.`);

            // Defer the actual Cesium entity removal using requestAnimationFrame
            requestAnimationFrame(() => {
                if (viewer && measurementToRemove.cesiumEntities) {
                    for (const key in measurementToRemove.cesiumEntities) {
                        const entityOrArray = measurementToRemove.cesiumEntities[key];
                        if (Array.isArray(entityOrArray)) {
                            entityOrArray.forEach(entity => {
                                if (entity instanceof Cesium.Entity) {
                                    console.log(`[TMS - REMOVE]: Checking entity ID: ${entity.id}, Type: ${key}`);
                                    const isContained = viewer.entities.contains(entity);
                                    console.log(`[TMS - REMOVE]: Entity ID: ${entity.id} is contained in viewer.entities before removal: ${isContained}`);
                                    const wasRemoved = viewer.entities.remove(entity);
                                    console.log(`[TMS - REMOVE]: Result for removing entity ID: ${entity.id}: ${wasRemoved}`);
                                    if (!wasRemoved) {
                                        console.warn(`[TMS - REMOVE WARNING]: Failed to remove entity ID: ${entity.id}. It might not have been in the collection or was already removed.`);
                                    }
                                }
                            });
                        } else if (entityOrArray instanceof Cesium.Entity) {
                            console.log(`[TMS - REMOVE]: Checking entity ID: ${entityOrArray.id}, Type: ${key}`);
                            const isContained = viewer.entities.contains(entityOrArray);
                            console.log(`[TMS - REMOVE]: Entity ID: ${entityOrArray.id} is contained in viewer.entities before removal: ${isContained}`);
                            const wasRemoved = viewer.entities.remove(entityOrArray);
                            console.log(`[TMS - REMOVE]: Result for removing entity ID: ${entityOrArray.id}: ${wasRemoved}`);
                            if (!wasRemoved) {
                                console.warn(`[TMS - REMOVE WARNING]: Failed to remove entity ID: ${entityOrArray.id}. It might not have been in the collection or was already removed.`);
                            }
                        }
                    }
                }

                if (viewer.scene.requestRenderMode) {
                    viewer.scene.requestRender();
                }
                console.log(`[TMS]: Cesium entities for measurement ID ${id} removal process completed.`);
            });
        } else {
            console.warn(`[TMS]: Attempted to remove non-existent measurement with ID: ${id}`);
        }
    }

    toggleMeasurementEnabled(id) {
        const { viewer } = getToolState(); // Get viewer inside the function for robustness
        const currentHistory = this.measurementHistory$.getValue();
        let measurementUpdated = false;

        const updatedHistory = currentHistory.map(m => {
            if (m.id === id) {
                const newEnabledState = !m.isEnabled;
                measurementUpdated = true;

                // Defer the Cesium entity visibility toggle using requestAnimationFrame
                requestAnimationFrame(() => {
                    if (viewer && m.cesiumEntities) {
                        for (const key in m.cesiumEntities) {
                            const entityOrArray = m.cesiumEntities[key];
                            if (Array.isArray(entityOrArray)) {
                                entityOrArray.forEach(entity => {
                                    if (entity instanceof Cesium.Entity && entity.show !== undefined) {
                                        entity.show = newEnabledState;
                                    }
                                });
                            } else if (entityOrArray instanceof Cesium.Entity && entityOrArray.show !== undefined) {
                                entityOrArray.show = newEnabledState;
                            }
                        }
                        if (viewer.scene.requestRenderMode) {
                            viewer.scene.requestRender();
                        }
                        console.log(`[TMS]: Cesium entities for measurement ID ${id} visibility set to ${newEnabledState}.`);
                    }
                });
                return { ...m, isEnabled: newEnabledState };
            }
            return m;
        });

        if (measurementUpdated) {
            this.measurementHistory$.next(updatedHistory);
            console.log(`[TMS]: Measurement with ID ${id} history state updated.`);
        } else {
            console.warn(`[TMS]: Attempted to toggle non-existent measurement with ID: ${id}`);
        }
    }

    getMeasurementById(id) {
        return this.measurementHistory$.getValue().find(m => m.id === id);
    }
}

export const ToolManagementService = new ToolManagementServiceClass();
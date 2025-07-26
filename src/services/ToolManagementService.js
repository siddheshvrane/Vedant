// services/ToolManagementService.js

import { Subject, BehaviorSubject } from "rxjs";
import * as Cesium from "cesium";
import { MapService } from "./MapService.js";
import { PopupService } from "./PopupService.js";

// Import individual tool setup functions
import { setupLineMeasureTool } from "../components/Menu/SubSidebars/BasicTools/tools/LineMeasureTool.js";
import { setupAreaMeasureTool } from "../components/Menu/SubSidebars/BasicTools/tools/AreaMeasureTool.js";
import {
    setupViewshieldAnalysisTool,
    clearViewshield,
} from "../components/Menu/SubSidebars/BasicTools/tools/ViewshieldAnalysisTool.js";
import { setupTerrainProfileTool } from "../components/Menu/SubSidebars/BasicTools/tools/TerrainProfileTool.js";

// Corrected import for FlyThroughTool: Import 'stopFlyThrough' not 'clearFlyThroughTool'
import {
    setupFlyThroughTool,
    stopFlyThrough, // <-- Corrected import name
} from "../components/Menu/SubSidebars/BasicTools/tools/FlyThroughTool.js";

// Import helper functions and common drawing methods
import {
    clearDrawing,
    removeEventHandlers,
    getToolState,
    setToolState,
    addPersistentEntity,
    removeAllToolEntities,
} from "../components/Menu/SubSidebars/BasicTools/tool-helpers/tools-helpers.js";

class ToolManagementServiceClass {
    activeTool$ = new BehaviorSubject(null);
    measurementHistory$ = new BehaviorSubject([]);
    nextMeasurementId = 0;
    toolOperationCounters = {};

    constructor() {
        MapService.globeViewer$.subscribe((viewer) => {
            this.deactivateCurrentTool(); // Deactivate any previous tool state
            setToolState({
                viewer: viewer,
                handler: viewer
                    ? new Cesium.ScreenSpaceEventHandler(viewer.canvas)
                    : null,
            });
            if (viewer) {
                console.log(
                    "[TMS]: Received Cesium Viewer instance. Handler initialized."
                );
                this._clearAllPersistentMeasurements();
                removeAllToolEntities(viewer); // Also clear any remnants from previous sessions
            } else {
                console.log(
                    "[TMS]: Cesium Viewer is null. Tools deactivated and resources cleaned."
                );
                this._clearAllPersistentMeasurements();
            }
        });
    }

    _clearAllPersistentMeasurements() {
        const { viewer } = getToolState();
        const currentHistory = this.measurementHistory$.getValue();
        requestAnimationFrame(() => {
            currentHistory.forEach((measurement) => {
                if (viewer && measurement.cesiumEntities) {
                    for (const key in measurement.cesiumEntities) {
                        const entityOrArray = measurement.cesiumEntities[key];
                        if (Array.isArray(entityOrArray)) {
                            entityOrArray.forEach((e) => {
                                if (e instanceof Cesium.Entity) viewer.entities.remove(e);
                            });
                        } else if (entityOrArray instanceof Cesium.Entity) {
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
                removeAllToolEntities(viewer); // Clear any tool-specific temporary entities
                console.log(
                    "[TMS]: All temporary tool entities cleared during full measurement reset."
                );
                if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
            }
        });
    }

    activateTool(toolName) {
        const { viewer } = getToolState();
        if (!viewer)
            return console.warn(
                "[TMS]: Cesium Viewer not available. Cannot activate tool."
            );
        // If the requested tool is already active, deactivate it.
        if (this.activeTool$.getValue() === toolName)
            return this.deactivateCurrentTool();

        // Deactivate any currently active tool before activating a new one
        this.deactivateCurrentTool();

        this.activeTool$.next(toolName);
        console.log(`[TMS]: Activating tool: ${toolName}`);

        switch (toolName) {
            case "Line Measure":
                setupLineMeasureTool(true, false);
                break;
            case "3D Line Measure":
                setupLineMeasureTool(false, true);
                break;
            case "Area Measure":
                setupAreaMeasureTool(true, false);
                break;
            case "3D Area Measure":
                setupAreaMeasureTool(false, true);
                break;
            case "Viewshield Analysis":
                setupViewshieldAnalysisTool(viewer, {
                    observerHeight: 1.75,
                    viewDistance: 5000,
                    rayCount: 64,
                });
                break;
            case "Terrain Profile":
                setupTerrainProfileTool(viewer);
                break;
            // NEW: Case for FlyThrough Tool
            case "Flythrough Tool": // This name must match exactly what's in BasicToolSidebar.vue
                setupFlyThroughTool(viewer); // Pass viewer to the tool's setup function
                break;
            default:
                console.warn(`[TMS]: Unknown tool requested: ${toolName}`);
                this.deactivateCurrentTool(); // Deactivate if an unknown tool is requested
                break;
        }
    }

    deactivateCurrentTool() {
        const activeTool = this.activeTool$.getValue();
        if (activeTool) {
            console.log(`[TMS]: Deactivating tool: ${activeTool}`);
            switch (activeTool) {
                case "Viewshield Analysis":
                    clearViewshield();
                    break;
                // Corrected cleanup for FlyThrough Tool
                case "Flythrough Tool":
                    stopFlyThrough(); // <-- Call 'stopFlyThrough'
                    break;
                default:
                    // Default cleanup for other tools (line, area measures)
                    clearDrawing();
                    removeEventHandlers();
                    break;
            }
        }
        this.activeTool$.next(null); // Reset active tool state
        // Attempt to hide any active popups managed by PopupService
        if (PopupService?.hide) PopupService.hide();
        else
            console.warn(
                "[TMS]: PopupService not available or does not have a 'hide' method."
            );
    }

    addMeasurement(toolName, value, entityDefs) {
        const { viewer } = getToolState();
        if (!viewer)
            return console.error(
                "[TMS]: Viewer not available. Cannot add measurement."
            );

        // Increment operation counter for the specific tool
        if (!this.toolOperationCounters[toolName])
            this.toolOperationCounters[toolName] = 0;
        this.toolOperationCounters[toolName]++;
        const operationNumber = this.toolOperationCounters[toolName];
        const createdCesiumEntities = {};

        // Use requestAnimationFrame to ensure Cesium entities are added safely
        requestAnimationFrame(() => {
            // Special handling for tools that return pre-existing Cesium Entities
            // (e.g., Viewshield Analysis, Terrain Profile, and potentially FlyThrough if it works that way)
            if (
                toolName === "Viewshield Analysis" ||
                toolName === "Terrain Profile" ||
                toolName === "Flythrough Tool" // Add Flythrough Tool here if it passes pre-created entities
            ) {
                // For these tools, entityDefs might directly contain Cesium Entities or arrays of them
                // We'll store them directly without re-adding them via addPersistentEntity
                Object.entries(entityDefs).forEach(([key, entities]) => {
                    if (!entities) return;
                    createdCesiumEntities[key] = Array.isArray(entities)
                        ? entities
                        : [entities]; // Always store as an array for consistency
                });
            } else {
                // Generic handling for tools that provide entity definitions to be created
                if (entityDefs.polyline)
                    createdCesiumEntities.polyline = addPersistentEntity(
                        entityDefs.polyline
                    );
                if (entityDefs.polygon)
                    createdCesiumEntities.polygon = addPersistentEntity(
                        entityDefs.polygon
                    );
                if (entityDefs.points)
                    createdCesiumEntities.points =
                        entityDefs.points.map(addPersistentEntity);
                if (entityDefs.labels)
                    createdCesiumEntities.labels =
                        entityDefs.labels.map(addPersistentEntity);
                if (entityDefs.billboards)
                    createdCesiumEntities.billboards =
                        entityDefs.billboards.map(addPersistentEntity);
                if (entityDefs.models)
                    createdCesiumEntities.models =
                        entityDefs.models.map(addPersistentEntity);
            }

            const newMeasurement = {
                id: this.nextMeasurementId++,
                toolName,
                operationNumber,
                value, // The measurement value (e.g., "100 km", "5 sq km")
                cesiumEntities: createdCesiumEntities, // References to the actual Cesium entities
                isEnabled: true, // For toggling visibility
            };

            const updatedHistory = [
                ...this.measurementHistory$.getValue(),
                newMeasurement,
            ];
            this.measurementHistory$.next(updatedHistory);
            console.log("[TMS]: Measurement added to history:", newMeasurement);

            // Request a render if Cesium is in requestRenderMode
            if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
        });
    }

    removeMeasurement(id) {
        const { viewer } = getToolState();
        const currentHistory = this.measurementHistory$.getValue();
        const measurementToRemove = currentHistory.find((m) => m.id === id);

        if (measurementToRemove) {
            // Update the history first
            this.measurementHistory$.next(currentHistory.filter((m) => m.id !== id));
            console.log(`[TMS]: Measurement with ID ${id} removed from history.`);

            // Then remove associated Cesium entities
            requestAnimationFrame(() => {
                if (viewer && measurementToRemove.cesiumEntities) {
                    for (const key in measurementToRemove.cesiumEntities) {
                        const entityOrArray = measurementToRemove.cesiumEntities[key];
                        const entities = Array.isArray(entityOrArray)
                            ? entityOrArray
                            : [entityOrArray]; // Ensure it's always an array for iteration

                        entities.forEach((entity) => {
                            if (entity instanceof Cesium.Entity)
                                viewer.entities.remove(entity);
                        });
                    }
                }
                if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
                console.log(
                    `[TMS]: Cesium entities for measurement ID ${id} removal process completed.`
                );
            });
        } else {
            console.warn(
                `[TMS]: Attempted to remove non-existent measurement with ID: ${id}`
            );
        }
    }

    toggleMeasurementEnabled(id) {
        const { viewer } = getToolState();
        const updatedHistory = this.measurementHistory$.getValue().map((m) => {
            if (m.id === id) {
                const newState = !m.isEnabled;
                requestAnimationFrame(() => {
                    if (viewer && m.cesiumEntities) {
                        for (const key in m.cesiumEntities) {
                            const entityOrArray = m.cesiumEntities[key];
                            const entities = Array.isArray(entityOrArray)
                                ? entityOrArray
                                : [entityOrArray]; // Ensure it's always an array for iteration

                            entities.forEach((entity) => {
                                if (
                                    entity instanceof Cesium.Entity &&
                                    entity.show !== undefined
                                )
                                    entity.show = newState; // Toggle show property
                            });
                        }
                    }
                    if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
                });
                return { ...m, isEnabled: newState }; // Update history state
            }
            return m;
        });
        this.measurementHistory$.next(updatedHistory);
    }

    getMeasurementById(id) {
        return this.measurementHistory$.getValue().find((m) => m.id === id);
    }
}

export const ToolManagementService = new ToolManagementServiceClass();
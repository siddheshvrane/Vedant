// services/ToolManagementService.js

import { Subject, BehaviorSubject } from "rxjs";
import * as Cesium from "cesium";
import { MapService } from "./MapService.js";
import { PopupService } from "./PopupService.js";

// Import individual tool setup functions
import { setupLineMeasureTool } from "../components/Menu/SubSidebars/BasicTools/tools/LineMeasureTool.js";
import { setupAreaMeasureTool } from "../components/Menu/SubSidebars/BasicTools/tools/AreaMeasureTool.js";
// Updated import: Ensure both setup and clear functions are imported
import {
  setupViewshieldAnalysisTool,
  clearViewshield,
} from "../components/Menu/SubSidebars/BasicTools/tools/ViewshieldAnalysisTool.js";
import { setupTerrainProfileTool } from "../components/Menu/SubSidebars/BasicTools/tools/TerrainProfileTool.js";

// Import helper functions and common drawing methods
import {
  clearDrawing,
  removeEventHandlers,
  getToolState, // Make sure getToolState is available and returns { viewer, handler }
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
      this.deactivateCurrentTool();
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
        removeAllToolEntities(viewer);
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
        removeAllToolEntities(viewer);
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
    if (this.activeTool$.getValue() === toolName)
      return this.deactivateCurrentTool();
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
      switch (activeTool) {
        case "Viewshield Analysis":
          clearViewshield();
          break;
        default:
          clearDrawing();
          removeEventHandlers();
          break;
      }
    }
    this.activeTool$.next(null);
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
    if (!this.toolOperationCounters[toolName])
      this.toolOperationCounters[toolName] = 0;
    this.toolOperationCounters[toolName]++;
    const operationNumber = this.toolOperationCounters[toolName];
    const createdCesiumEntities = {};

    requestAnimationFrame(() => {
      if (
        toolName === "Viewshield Analysis" ||
        toolName === "Terrain Profile"
      ) {
        Object.entries(entityDefs).forEach(([key, entities]) => {
          if (!entities) return;
          createdCesiumEntities[key] = Array.isArray(entities)
            ? entities
            : [entities];
        });
      } else {
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
        value,
        cesiumEntities: createdCesiumEntities,
        isEnabled: true,
      };
      const updatedHistory = [
        ...this.measurementHistory$.getValue(),
        newMeasurement,
      ];
      this.measurementHistory$.next(updatedHistory);
      console.log("[TMS]: Measurement added to history:", newMeasurement);
      if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
    });
  }

  removeMeasurement(id) {
    const { viewer } = getToolState();
    const currentHistory = this.measurementHistory$.getValue();
    const measurementToRemove = currentHistory.find((m) => m.id === id);
    if (measurementToRemove) {
      this.measurementHistory$.next(currentHistory.filter((m) => m.id !== id));
      console.log(`[TMS]: Measurement with ID ${id} removed from history.`);
      requestAnimationFrame(() => {
        if (viewer && measurementToRemove.cesiumEntities) {
          for (const key in measurementToRemove.cesiumEntities) {
            const entityOrArray = measurementToRemove.cesiumEntities[key];
            const entities = Array.isArray(entityOrArray)
              ? entityOrArray
              : [entityOrArray];
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
                : [entityOrArray];
              entities.forEach((entity) => {
                if (
                  entity instanceof Cesium.Entity &&
                  entity.show !== undefined
                )
                  entity.show = newState;
              });
            }
            if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
          }
        });
        return { ...m, isEnabled: newState };
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

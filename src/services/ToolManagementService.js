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
                if (e instanceof Cesium.Entity) {
                  viewer.entities.remove(e);
                }
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
        if (viewer.scene.requestRenderMode) {
          viewer.scene.requestRender();
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

    if (typeof PopupService !== "undefined" && PopupService.hide) {
      PopupService.hide();
    } else {
      console.warn(
        "[TMS]: PopupService not available or does not have a 'hide' method."
      );
    }
  }

  addMeasurement(toolName, value, entityDefinitions) {
    const { viewer } = getToolState();
    if (!viewer) {
      console.error("[TMS]: Viewer not available. Cannot add measurement.");
      return;
    }

    if (!this.toolOperationCounters[toolName]) {
      this.toolOperationCounters[toolName] = 0;
    }
    this.toolOperationCounters[toolName]++;
    const operationNumber = this.toolOperationCounters[toolName];

    // ⚠️ Use the already added entities directly instead of adding them again
    const newMeasurement = {
      id: this.nextMeasurementId++,
      toolName,
      operationNumber,
      value,
      cesiumEntities: entityDefinitions, // ✅ already added
      isEnabled: true,
    };

    const updatedHistory = [
      ...this.measurementHistory$.getValue(),
      newMeasurement,
    ];
    this.measurementHistory$.next(updatedHistory);
    console.log("[TMS]: Measurement added to history:", newMeasurement);

    if (viewer.scene.requestRenderMode) {
      viewer.scene.requestRender();
    }
  }

  removeMeasurement(id) {
    const { viewer } = getToolState();
    const currentHistory = this.measurementHistory$.getValue();
    const measurementToRemove = currentHistory.find((m) => m.id === id);

    if (measurementToRemove) {
      const updatedHistory = currentHistory.filter((m) => m.id !== id);
      this.measurementHistory$.next(updatedHistory);

      requestAnimationFrame(() => {
        if (viewer && measurementToRemove.cesiumEntities) {
          for (const key in measurementToRemove.cesiumEntities) {
            const entityOrArray = measurementToRemove.cesiumEntities[key];
            if (Array.isArray(entityOrArray)) {
              entityOrArray.forEach((entity) => {
                if (entity instanceof Cesium.Entity)
                  viewer.entities.remove(entity);
              });
            } else if (entityOrArray instanceof Cesium.Entity) {
              viewer.entities.remove(entityOrArray);
            }
          }
        }
        if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
      });
    }
  }

  toggleMeasurementEnabled(id) {
    const { viewer } = getToolState();
    const currentHistory = this.measurementHistory$.getValue();
    let measurementUpdated = false;

    const updatedHistory = currentHistory.map((m) => {
      if (m.id === id) {
        const newEnabledState = !m.isEnabled;
        measurementUpdated = true;

        requestAnimationFrame(() => {
          if (viewer && m.cesiumEntities) {
            for (const key in m.cesiumEntities) {
              const entityOrArray = m.cesiumEntities[key];
              if (Array.isArray(entityOrArray)) {
                entityOrArray.forEach((entity) => {
                  if (
                    entity instanceof Cesium.Entity &&
                    entity.show !== undefined
                  ) {
                    entity.show = newEnabledState;
                  }
                });
              } else if (
                entityOrArray instanceof Cesium.Entity &&
                entityOrArray.show !== undefined
              ) {
                entityOrArray.show = newEnabledState;
              }
            }
            if (viewer.scene.requestRenderMode) viewer.scene.requestRender();
          }
        });
        return { ...m, isEnabled: newEnabledState };
      }
      return m;
    });

    if (measurementUpdated) {
      this.measurementHistory$.next(updatedHistory);
    }
  }

  getMeasurementById(id) {
    return this.measurementHistory$.getValue().find((m) => m.id === id);
  }
}

export const ToolManagementService = new ToolManagementServiceClass();

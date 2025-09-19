import { Subject } from "rxjs";
import { GeoSpatialProcessor } from "../components/Menu/SubSidebars/AddData/GeoSpatialProcessor.js";
import { LayerService } from "./LayerService.js";
import { PopupService } from "./PopupService.js";

/**
 * DataAddService: Handles RxJS communication for adding new data or services.
 * All business logic has been moved to appropriate processors and utilities.
 */
class DataAddServiceClass {
  // RxJS Subjects for communication between components
  dataAdded$ = new Subject();
  serviceAdded$ = new Subject();
  submissionSuccess$ = new Subject();
  submissionError$ = new Subject();

  /**
   * Processes the complete geo-spatial content submission from the form.
   */
  async processGeoSpatialSubmission(payload, file) {
    try {
      if (!payload.contentName) {
        this.submissionError$.next("Please enter a name for the content.");
        return;
      }

      const result = await GeoSpatialProcessor.processSubmission(payload, file);

      if (result.success) {
        if (payload.selectedOption === "data") {
          this.addData(result.model);
        } else {
          this.addService(result.model);
        }
        this.submissionSuccess$.next(result.message);
      } else {
        this.submissionError$.next(result.error);
      }
    } catch (error) {
      console.error(
        "DataAddService: Unexpected error during submission:",
        error
      );
      this.submissionError$.next(
        "An unexpected error occurred. Please try again."
      );
    }
  }

  /**
   * Handles data model addition workflow
   * @param {Data} dataModel - The data model to add
   */
  addData(dataModel) {
    if (!dataModel) {
      console.error("DataAddService: Invalid data model provided.");
      this.submissionError$.next("Internal Error: Invalid data model.");
      return;
    }

    console.log("DataAddService: Processing data addition for:", dataModel);
    LayerService.addGeoSpatialEntry(dataModel);

    const displayInfo = this._extractDisplayInfo(dataModel);

    // ========================================================================
    // THIS IS THE FIX
    // Changed from the incorrect `show` method to the correct helper method.
    // ========================================================================
    PopupService.showServiceAdded({
      layerName: dataModel.name,
      srs: displayInfo.srs,
      extent: displayInfo.extent,
    });

    this.dataAdded$.next(dataModel);
  }

  /**
   * Handles service model addition workflow
   * @param {Service} serviceModel - The service model to add
   */
  addService(serviceModel) {
    if (!serviceModel) {
      console.error("DataAddService: Invalid service model provided.");
      this.submissionError$.next("Internal Error: Invalid service model.");
      return;
    }

    console.log(
      "DataAddService: Processing service addition for:",
      serviceModel
    );
    LayerService.addGeoSpatialEntry(serviceModel);

    const displayInfo = this._extractServiceDisplayInfo(serviceModel);

    // ========================================================================
    // THIS IS THE FIX (Applied here too for consistency)
    // Changed from the incorrect `show` method to the correct helper method.
    // ========================================================================
    PopupService.showServiceAdded({
      layerName: serviceModel.name,
      srs: displayInfo.srs,
      extent: displayInfo.extent,
    });

    this.serviceAdded$.next(serviceModel);
  }

  /**
   * Extracts display information from data model for popup
   */
  _extractDisplayInfo(dataModel) {
    let srs = "N/A";
    let extent = "N/A";

    if (dataModel.srcInfo) {
      if (dataModel.type === "geojson" && dataModel.srcInfo.jsonContent) {
        const jsonContent = dataModel.srcInfo.jsonContent;
        if (jsonContent.crs?.properties?.name) {
          srs = jsonContent.crs.properties.name;
        }
        if (jsonContent.bbox) {
          extent = JSON.stringify(jsonContent.bbox);
        }
      } else if (dataModel.type === "kml" && dataModel.srcInfo.kmlDetails) {
        srs = "WGS84 (Assumed for KML)";
        // You could potentially calculate an extent from placemarks here in the future
        extent = `Placemarks: ${dataModel.srcInfo.kmlDetails.placemarkCount}`;
      } else if (dataModel.type === "czml") {
        srs = "WGS84 (Assumed for CZML)";
        extent = "N/A";
      } else if (dataModel.type === "3dmodel") {
        srs = "WGS84 (Assumed for 3D Model)";
        if (
          typeof dataModel.srcInfo.longitude === "number" &&
          typeof dataModel.srcInfo.latitude === "number"
        ) {
          extent = `Lon: ${dataModel.srcInfo.longitude.toFixed(
            4
          )}, Lat: ${dataModel.srcInfo.latitude.toFixed(4)}`;
        }
      } else if (dataModel.type === "3dtile") {
        srs = "WGS84 (Assumed for 3D Tile)";
        extent = "N/A";
      }
    }

    return { srs, extent };
  }

  /**
   * Extracts display information from service model for popup
   */
  _extractServiceDisplayInfo(serviceModel) {
    let srs = "N/A";
    let extent = "N/A";

    if (serviceModel.contentType === "wmts") {
      srs = serviceModel.args.tileMatrixSetID || "N/A";
      extent = serviceModel.args.extent || "N/A";
    } else if (serviceModel.contentType === "wms") {
      srs = serviceModel.args.srs || "N/A";
      extent = serviceModel.args.extent || "N/A";
    }

    return { srs, extent };
  }
}

export const DataAddService = new DataAddServiceClass();

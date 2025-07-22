// src/components/Globe/managers/CesiumLayerFactory.js
import * as Cesium from 'cesium';

/**
 * Creates a GeoJSON data source.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @returns {Promise<Cesium.DataSource>} The created GeoJSON data source.
 */
export async function createGeoJsonLayer(viewer, layerEntry) {
    if (!layerEntry.srcInfo?.jsonContent) {
        throw new Error('GeoJSON layer requires jsonContent in srcInfo.');
    }
    const ds = await Cesium.GeoJsonDataSource.load(layerEntry.srcInfo.jsonContent, {
        stroke: Cesium.Color.HOTPINK,
        fill: Cesium.Color.PINK.withAlpha(0.5),
        strokeWidth: 3,
        markerSymbol: '?',
        clampToGround: true
    });
    ds.name = layerEntry.name;
    ds.show = layerEntry.isVisible;
    viewer.dataSources.add(ds);
    return ds;
}

/**
 * Creates a KML data source.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @returns {Promise<Cesium.DataSource>} The created KML data source.
 */
export async function createKmlLayer(viewer, layerEntry) {
    if (!layerEntry.srcInfo?.kmlContent) {
        throw new Error('KML layer requires kmlContent in srcInfo.');
    }
    const ds = await Cesium.KmlDataSource.load(layerEntry.srcInfo.kmlContent, {
        camera: viewer.camera,
        canvas: viewer.canvas,
        clampToGround: true
    });
    ds.name = layerEntry.name;
    ds.show = layerEntry.isVisible;
    viewer.dataSources.add(ds);
    return ds;
}

/**
 * Creates a CZML data source.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @returns {Promise<Cesium.DataSource>} The created CZML data source.
 */
export async function createCzmlLayer(viewer, layerEntry) {
    if (!layerEntry.srcInfo?.czmlContent) {
        throw new Error('CZML layer requires czmlContent in srcInfo.');
    }
    const ds = await Cesium.CzmlDataSource.load(layerEntry.srcInfo.czmlContent);
    ds.name = layerEntry.name;
    ds.show = layerEntry.isVisible;
    viewer.dataSources.add(ds);
    return ds;
}

/**
 * Creates a 3D Tileset.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @returns {Promise<Cesium.Cesium3DTileset>} The created 3D Tileset.
 */
export async function create3DTileLayer(viewer, layerEntry) {
    if (!layerEntry.srcInfo?.url) {
        throw new Error('3D Tile layer requires a URL in srcInfo.');
    }
    const tileset = await Cesium.Cesium3DTileset.fromUrl(layerEntry.srcInfo.url);
    viewer.scene.primitives.add(tileset);
    tileset.show = layerEntry.isVisible;
    return tileset;
}

/**
 * Creates a 3D Model entity.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @param {object} indiaBBox - The INDIA_BBOX constant.
 * @returns {Promise<{layer: Cesium.Entity, blobUrl: string|null}>} An object containing the created entity and any generated blob URL.
 */
export async function create3DModelLayer(viewer, layerEntry, indiaBBox) {
    if (!layerEntry.srcInfo) {
        throw new Error('3D Model layer requires srcInfo.');
    }

    let modelUri = layerEntry.srcInfo.url;
    let blobUrl = null;

    if (layerEntry.srcInfo.gltfData instanceof File || layerEntry.srcInfo.gltfData instanceof Blob) {
        blobUrl = URL.createObjectURL(layerEntry.srcInfo.gltfData);
        modelUri = blobUrl;
    } else if (!modelUri) {
        throw new Error(`3D Model layer ${layerEntry.name} requires either gltfData (File/Blob) or a 'url' in srcInfo.`);
    }

    const position = Cesium.Cartesian3.fromDegrees(
        (layerEntry.srcInfo.longitude || indiaBBox.west + (indiaBBox.east - indiaBBox.west) / 2),
        (layerEntry.srcInfo.latitude || indiaBBox.south + (indiaBBox.north - indiaBBox.south) / 2),
        layerEntry.srcInfo.elevation || 0
    );

    const modelEntity = viewer.entities.add({
        id: layerEntry.id,
        name: layerEntry.name,
        position: position,
        model: {
            uri: modelUri,
            scale: layerEntry.srcInfo.scale || 1.0,
            minimumPixelSize: layerEntry.srcInfo.minimumPixelSize || 128,
            maximumScale: layerEntry.srcInfo.maximumScale || 20000,
            show: layerEntry.isVisible
        }
    });

    return { layer: modelEntity, blobUrl: blobUrl };
}

/**
 * Creates a WMS imagery layer.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @param {number} [imageryIndex] - Optional. The index at which to insert the layer.
 * @returns {Cesium.ImageryLayer} The created WMS imagery layer.
 */
export function createWmsLayer(viewer, layerEntry, imageryIndex) {
    if (!layerEntry.baseUrl || !layerEntry.args) {
        throw new Error('WMS layer requires baseUrl and args.');
    }
    const wmsParameters = {
        service: 'WMS',
        version: layerEntry.args.version || '1.1.1',
        request: 'GetMap',
        format: layerEntry.args.format || 'image/png',
        transparent: layerEntry.args.transparent !== undefined ? layerEntry.args.transparent : true,
        layers: layerEntry.args.layers || layerEntry.name,
        srs: layerEntry.args.srs || 'EPSG:4326',
        tiled: layerEntry.args.tiled !== undefined ? layerEntry.args.tiled : true,
        width: 256,
        height: 256,
        ...layerEntry.args
    };

    const imageryProvider = new Cesium.WebMapServiceImageryProvider({
        url: layerEntry.baseUrl,
        layers: wmsParameters.layers,
        parameters: wmsParameters,
        credit: new Cesium.Credit(layerEntry.name)
    });

    const cesiumLayer = viewer.imageryLayers.addImageryProvider(imageryProvider, imageryIndex);
    cesiumLayer.id = layerEntry.id;
    cesiumLayer.name = layerEntry.name;
    cesiumLayer.show = layerEntry.isVisible;
    return cesiumLayer;
}

/**
 * Creates a WMTS imagery layer.
 * @param {Cesium.Viewer} viewer - The Cesium Viewer instance.
 * @param {object} layerEntry - The layer entry object.
 * @param {number} [imageryIndex] - Optional. The index at which to insert the layer.
 * @returns {Cesium.ImageryLayer} The created WMTS imagery layer.
 */
export function createWmtsLayer(viewer, layerEntry, imageryIndex) {
    if (!layerEntry.baseUrl || !layerEntry.args) {
        throw new Error('WMTS layer requires baseUrl and args.');
    }
    const wmtsParameters = {
        service: 'WMTS',
        version: layerEntry.args.version || '1.0.0',
        request: 'GetTile',
        format: layerEntry.args.format || 'image/jpeg',
        layer: layerEntry.args.layer || layerEntry.name,
        style: layerEntry.args.style || '',
        tileMatrixSetID: layerEntry.args.tileMatrixSetID || 'EPSG:4326',
        tileMatrixLabels: layerEntry.args.tileMatrixLabels,
        dimensions: layerEntry.args.dimensions,
        tilingScheme: layerEntry.args.tilingScheme,
        credit: new Cesium.Credit(layerEntry.name),
        minimumLevel: layerEntry.args.minimumLevel || 0,
        maximumLevel: layerEntry.args.maximumLevel,
        ...layerEntry.args
    };

    const imageryProvider = new Cesium.WebMapTileServiceImageryProvider({
        url: layerEntry.baseUrl,
        layer: wmtsParameters.layer,
        style: wmtsParameters.style,
        format: wmtsParameters.format,
        tileMatrixSetID: wmtsParameters.tileMatrixSetID,
        tileMatrixLabels: wmtsParameters.tileMatrixLabels,
        tilingScheme: wmtsParameters.tilingScheme,
        minimumLevel: wmtsParameters.minimumLevel,
        maximumLevel: wmtsParameters.maximumLevel,
        credit: wmtsParameters.credit,
        dimensions: wmtsParameters.dimensions
    });

    const cesiumLayer = viewer.imageryLayers.addImageryProvider(imageryProvider, imageryIndex);
    cesiumLayer.id = layerEntry.id;
    cesiumLayer.name = layerEntry.name;
    cesiumLayer.show = layerEntry.isVisible;
    return cesiumLayer;
}
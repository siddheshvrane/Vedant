// src/components/Globe/managers/CesiumCoreManager.js 
import * as Cesium from 'cesium'; 

// Constants moved from CesiumConstants.js and defaultViewerOptions from old CesiumGlobeManager 
const DEFAULT_VIEWER_OPTIONS = { 
    animation: false, 
    baseLayerPicker: false, 
    geocoder: false, 
    homeButton: false, 
    infoBox: false, 
    sceneModePicker: false, 
    selectionIndicator: false, 
    timeline: false, 
    navigationHelpButton: false, 
    navigationInstructionsInitiallyVisible: false, 
    creditContainer: document.createElement('div'), 
    fullscreenButton: false, 
    sceneMode: Cesium.SceneMode.SCENE3D, 
    terrainExaggeration: 1.0, 
}; 

const DEFAULT_INITIAL_CAMERA_POSITION = { 
    destination: Cesium.Cartesian3.fromDegrees(78.9629, 20.5937, 20000000), 
    orientation: { 
        heading: Cesium.Math.toRadians(0.0), 
        pitch: Cesium.Math.toRadians(-90.0), 
        roll: Cesium.Math.toRadians(0.0) 
    }, 
    duration: 0 
}; 

// Export INDIA_BBOX so CesiumGeoDataManager can import it directly 
export const INDIA_BBOX = Cesium.Rectangle.fromDegrees(68.11, 6.55, 97.39, 35.50); 

class CesiumCoreManager { 
    constructor(containerId, options = {}) { 
        this.containerId = containerId; 
        this.viewer = null; 
        this.viewerOptions = { ...DEFAULT_VIEWER_OPTIONS, ...options }; 
        
        // Flight animation state
        this.flightAnimations = new Map(); // Store multiple flight animations by ID
        this.nextAnimationId = 1;
    } 

    /** 
     * Initializes the Cesium Viewer. 
     * @returns {Cesium.Viewer} The initialized Cesium Viewer instance. 
     */ 
    initViewer() { 
        if (this.viewer) { 
            console.warn('CesiumCoreManager: Viewer already initialized.'); 
            return this.viewer; 
        } 

        this.viewer = new Cesium.Viewer(this.containerId, { 
            ...this.viewerOptions, // Use merged options 
            imageryProvider: false, // CRUCIAL: Start with no default imagery, let GeoDataManager handle it 
            terrain: new Cesium.Terrain(Cesium.CesiumTerrainProvider.fromUrl('https://vedas.sac.gov.in/elevation/cdem_10m_2016/')) 
        }); 
        this.viewer.scene.globe.depthTestAgainstTerrain = false; 

        this.viewer.camera.flyTo(DEFAULT_INITIAL_CAMERA_POSITION); 

        // Enable natural lighting effects 
        this.viewer.scene.globe.enableLighting = true; // Crucial for day/night 
        this.viewer.shadows = true; // Enable shadows from the sun 
        this.viewer.scene.sun.show = true; // Show the sun 
        this.viewer.scene.moon.show = true; // Show the moon 
        this.viewer.scene.skyBox.show = true; // Show the sky box (stars, etc.) 
        this.viewer.scene.skyAtmosphere.show = true; // Show atmosphere 

        // Set up clock for animations
        this.viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
        this.viewer.clock.shouldAnimate = true;

        console.log('CesiumCoreManager: Viewer initialized with 3D terrain.'); 
        return this.viewer; 
    } 

    /** 
     * Destroys the Cesium Viewer instance. 
     */ 
    destroyViewer() { 
        if (this.viewer) {
            // Cancel all active flight animations
            this.cancelAllFlightAnimations();
            
            this.viewer.destroy(); 
            this.viewer = null; 
            console.log('CesiumCoreManager: Viewer destroyed.'); 
        } 
    } 

    /** 
     * Get the viewer instance. 
     * @returns {Cesium.Viewer|null} The Cesium Viewer instance. 
     */ 
    getViewer() { 
        return this.viewer; 
    } 

    // --- Camera Management Methods --- 
    addCameraChangeListener(callback) { 
        if (this.viewer) { 
            this.viewer.camera.changed.addEventListener(callback); 
        } 
    } 

    removeCameraChangeListener(callback) { 
        if (this.viewer) { 
            this.viewer.camera.changed.removeEventListener(callback); 
        } 
    } 

    zoomIn() { 
        if (this.viewer) { 
            this.viewer.camera.zoomIn(this.viewer.camera.positionCartographic.height * 0.5); 
        } 
    } 

    zoomOut() { 
        if (this.viewer) { 
            this.viewer.camera.zoomOut(this.viewer.camera.positionCartographic.height); 
        } 
    } 

    zoomToCoordinates(coordinates) { 
        if (!this.viewer || !coordinates) return; 
        const targetElevation = coordinates.elevation && coordinates.elevation > 1000 ? coordinates.elevation : 25000; 
        this.viewer.camera.flyTo({ 
            destination: Cesium.Cartesian3.fromDegrees(coordinates.longitude, coordinates.latitude, targetElevation), 
            duration: 2 
        }); 
    } 

    orientToNorth() { 
        if (this.viewer) { 
            const currentCameraPosition = this.viewer.camera.positionCartographic; 
            const longitude = Cesium.Math.toDegrees(currentCameraPosition.longitude); 
            const latitude = Cesium.Math.toDegrees(currentCameraPosition.latitude); 
            const height = currentCameraPosition.height; 
            const currentPitch = this.viewer.camera.pitch; 
            const currentRoll = this.viewer.camera.roll; 

            this.viewer.camera.flyTo({ 
                destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, height), 
                orientation: { 
                    heading: Cesium.Math.toRadians(0.0), 
                    pitch: currentPitch, 
                    roll: currentRoll 
                }, 
                duration: 1.5 
            }); 
        } 
    }

    // --- Advanced Camera Control Methods ---

    /**
     * Sets camera position and orientation
     * @param {object} viewOptions - Camera view options
     * @param {Cesium.Cartesian3} viewOptions.destination - Camera position
     * @param {object} viewOptions.orientation - Camera orientation (direction, up)
     * @param {number} viewOptions.duration - Animation duration (optional)
     */
    setCameraView(viewOptions) {
        if (!this.viewer) {
            console.warn('CesiumCoreManager: Viewer not available for camera view change');
            return;
        }

        if (viewOptions.duration && viewOptions.duration > 0) {
            return this.viewer.camera.flyTo(viewOptions);
        } else {
            this.viewer.camera.setView(viewOptions);
        }
    }

    /**
     * Gets current camera state
     * @returns {object} Current camera state with position, direction, up, right vectors and angles
     */
    getCameraState() {
        if (!this.viewer) {
            return null;
        }

        const camera = this.viewer.camera;
        return {
            position: camera.position.clone(),
            direction: camera.direction.clone(),
            up: camera.up.clone(),
            right: camera.right.clone(),
            heading: camera.heading,
            pitch: camera.pitch,
            roll: camera.roll
        };
    }

    /**
     * Moves camera by a given movement vector
     * @param {Cesium.Cartesian3} movement - Movement vector in world coordinates
     */
    moveCamera(movement) {
        if (!this.viewer || !movement) {
            return;
        }

        const newPosition = Cesium.Cartesian3.add(
            this.viewer.camera.position, 
            movement, 
            new Cesium.Cartesian3()
        );
        this.viewer.camera.position = newPosition;

        if (this.viewer.scene.requestRenderMode) {
            this.viewer.scene.requestRender();
        }
    }

    /**
     * Rotates camera look direction
     * @param {string} direction - Direction to look ('left', 'right', 'up', 'down')
     * @param {number} angle - Angle in radians
     */
    rotateCamera(direction, angle) {
        if (!this.viewer) {
            return;
        }

        const camera = this.viewer.camera;
        
        switch (direction) {
            case 'left':
                camera.lookLeft(angle);
                break;
            case 'right':
                camera.lookRight(angle);
                break;
            case 'up':
                camera.lookUp(angle);
                break;
            case 'down':
                camera.lookDown(angle);
                break;
            default:
                console.warn(`CesiumCoreManager: Unknown rotation direction: ${direction}`);
        }

        if (this.viewer.scene.requestRenderMode) {
            this.viewer.scene.requestRender();
        }
    }

    /**
     * Enables or disables default camera controls
     * @param {boolean} enabled - Whether to enable default controls
     */
    setDefaultCameraControlsEnabled(enabled) {
        if (!this.viewer) {
            return;
        }

        const controller = this.viewer.scene.screenSpaceCameraController;
        controller.enableRotate = enabled;
        controller.enableTranslate = enabled;
        controller.enableZoom = enabled;
        controller.enableTilt = enabled;
        controller.enableLook = enabled;
    }

    /**
     * Cancels current camera flight
     */
    cancelCameraFlight() {
        if (this.viewer) {
            this.viewer.camera.cancelFlight();
        }
    }

    // --- Flight Animation Management ---

    /**
     * Creates a smooth flight animation between points
     * @param {Array<Cesium.Cartesian3>} pathPositions - Array of world positions
     * @param {object} config - Flight configuration
     * @param {Function} onProgress - Progress callback (optional)
     * @param {Function} onComplete - Completion callback (optional)
     * @returns {string} Animation ID for tracking/cancellation
     */
    createFlightAnimation(pathPositions, config = {}, onProgress = null, onComplete = null) {
        if (!this.viewer || !pathPositions || pathPositions.length < 2) {
            console.warn('CesiumCoreManager: Invalid parameters for flight animation');
            return null;
        }

        const animationId = `flight_${this.nextAnimationId++}`;
        
        // Default configuration
        const flightConfig = {
            speed: 10, // meters per second
            height: 20, // meters above ground/terrain
            tilt: 45, // camera tilt in degrees
            duration: null, // calculated if not provided
            pauseBetweenPoints: 200, // milliseconds
            enableSmoothing: true,
            ...config
        };

        // Calculate total distance and duration
        let totalDistance = 0;
        for (let i = 0; i < pathPositions.length - 1; i++) {
            totalDistance += Cesium.Cartesian3.distance(pathPositions[i], pathPositions[i + 1]);
        }

        if (!flightConfig.duration) {
            flightConfig.duration = totalDistance / flightConfig.speed;
        }

        const animation = {
            id: animationId,
            pathPositions: pathPositions,
            config: flightConfig,
            currentIndex: 0,
            isActive: true,
            onProgress: onProgress,
            onComplete: onComplete,
            startTime: Date.now()
        };

        this.flightAnimations.set(animationId, animation);
        this._executeFlightAnimation(animationId);

        return animationId;
    }

    /**
     * Creates a marker-based flight animation
     * @param {Array<object>} markers - Array of marker objects with position and cameraState
     * @param {object} config - Flight configuration
     * @param {Function} onProgress - Progress callback (optional)  
     * @param {Function} onComplete - Completion callback (optional)
     * @returns {string} Animation ID for tracking/cancellation
     */
    createMarkerFlightAnimation(markers, config = {}, onProgress = null, onComplete = null) {
        if (!this.viewer || !markers || markers.length === 0) {
            console.warn('CesiumCoreManager: Invalid parameters for marker flight animation');
            return null;
        }

        const animationId = `marker_flight_${this.nextAnimationId++}`;
        
        const flightConfig = {
            enableSmoothing: true,
            waitTime: 3.0, // default wait time per marker
            ...config
        };

        const animation = {
            id: animationId,
            markers: markers,
            config: flightConfig,
            currentIndex: 0,
            isActive: true,
            onProgress: onProgress,
            onComplete: onComplete,
            startTime: Date.now()
        };

        this.flightAnimations.set(animationId, animation);
        this._executeMarkerFlightAnimation(animationId);

        return animationId;
    }

    /**
     * Cancels a specific flight animation
     * @param {string} animationId - Animation ID to cancel
     */
    cancelFlightAnimation(animationId) {
        const animation = this.flightAnimations.get(animationId);
        if (animation && animation.isActive) {
            animation.isActive = false;
            this.flightAnimations.delete(animationId);
            this.cancelCameraFlight();
            console.log(`CesiumCoreManager: Cancelled flight animation ${animationId}`);
        }
    }

    /**
     * Cancels all active flight animations
     */
    cancelAllFlightAnimations() {
        this.flightAnimations.forEach((animation, id) => {
            if (animation.isActive) {
                animation.isActive = false;
            }
        });
        this.flightAnimations.clear();
        this.cancelCameraFlight();
        console.log('CesiumCoreManager: Cancelled all flight animations');
    }

    /**
     * Gets active flight animations
     * @returns {Array<string>} Array of active animation IDs
     */
    getActiveFlightAnimations() {
        return Array.from(this.flightAnimations.keys()).filter(id => 
            this.flightAnimations.get(id).isActive
        );
    }

    // --- Private Flight Animation Methods ---

    /**
     * Executes path-based flight animation
     * @private
     */
    async _executeFlightAnimation(animationId) {
        const animation = this.flightAnimations.get(animationId);
        if (!animation || !animation.isActive) {
            return;
        }

        const { pathPositions, config, onProgress, onComplete } = animation;
        
        const flyToNextPoint = () => {
            if (!animation.isActive || animation.currentIndex >= pathPositions.length - 1) {
                // Animation completed
                this.flightAnimations.delete(animationId);
                if (onComplete) {
                    onComplete();
                }
                return;
            }

            const currentPosition = pathPositions[animation.currentIndex];
            const nextPosition = pathPositions[animation.currentIndex + 1];

            // Calculate segment duration based on distance and speed
            const segmentDistance = Cesium.Cartesian3.distance(currentPosition, nextPosition);
            const segmentDuration = segmentDistance / config.speed;

            // Calculate camera orientation
            const orientation = this._calculateFlightOrientation(currentPosition, nextPosition, config.tilt);

            // Progress callback
            if (onProgress) {
                onProgress({
                    currentIndex: animation.currentIndex,
                    totalPoints: pathPositions.length,
                    progress: animation.currentIndex / (pathPositions.length - 1),
                    elapsedTime: (Date.now() - animation.startTime) / 1000
                });
            }

            // Fly to next position
            this.viewer.camera.flyTo({
                destination: nextPosition,
                orientation: orientation,
                duration: segmentDuration,
                easingFunction: config.enableSmoothing ? 
                    Cesium.EasingFunction.CUBIC_IN_OUT : 
                    Cesium.EasingFunction.LINEAR,
                complete: () => {
                    if (animation.isActive) {
                        animation.currentIndex++;
                        setTimeout(flyToNextPoint, config.pauseBetweenPoints);
                    }
                },
                cancel: () => {
                    animation.isActive = false;
                    this.flightAnimations.delete(animationId);
                }
            });
        };

        // Start at first position
        const firstOrientation = this._calculateFlightOrientation(
            pathPositions[0], 
            pathPositions[1], 
            config.tilt
        );
        
        this.setCameraView({
            destination: pathPositions[0],
            orientation: firstOrientation
        });

        // Begin flight sequence
        setTimeout(flyToNextPoint, 300);
    }

    /**
     * Executes marker-based flight animation
     * @private
     */
    async _executeMarkerFlightAnimation(animationId) {
        const animation = this.flightAnimations.get(animationId);
        if (!animation || !animation.isActive) {
            return;
        }

        const { markers, config, onProgress, onComplete } = animation;

        for (let i = 0; i < markers.length && animation.isActive; i++) {
            const marker = markers[i];
            animation.currentIndex = i;

            // Progress callback
            if (onProgress) {
                onProgress({
                    currentIndex: i,
                    totalMarkers: markers.length,
                    progress: i / markers.length,
                    marker: marker,
                    elapsedTime: (Date.now() - animation.startTime) / 1000
                });
            }

            // Fly to marker's camera state
            await new Promise((resolve) => {
                this.viewer.camera.flyTo({
                    destination: marker.cameraState.position,
                    orientation: {
                        direction: marker.cameraState.direction,
                        up: marker.cameraState.up
                    },
                    duration: config.enableSmoothing ? 2.5 : 1.5,
                    easingFunction: config.enableSmoothing ? 
                        Cesium.EasingFunction.CUBIC_IN_OUT : 
                        Cesium.EasingFunction.LINEAR,
                    complete: resolve,
                    cancel: () => {
                        animation.isActive = false;
                        resolve();
                    }
                });
            });

            // Wait at marker position
            if (animation.isActive && (i < markers.length - 1 || marker.waitTime > 0)) {
                await new Promise(resolve => 
                    setTimeout(resolve, (marker.waitTime || config.waitTime) * 1000)
                );
            }
        }

        // Animation completed
        if (animation.isActive) {
            this.flightAnimations.delete(animationId);
            if (onComplete) {
                onComplete();
            }
        }
    }

    /**
     * Calculates camera orientation for flight segments
     * @private
     */
    _calculateFlightOrientation(currentPosition, nextPosition, tiltAngle) {
        const direction = Cesium.Cartesian3.subtract(
            nextPosition, 
            currentPosition, 
            new Cesium.Cartesian3()
        );
        const normalizedDirection = Cesium.Cartesian3.normalize(direction, new Cesium.Cartesian3());

        const surfaceNormal = Cesium.Cartesian3.normalize(currentPosition, new Cesium.Cartesian3());
        const right = Cesium.Cartesian3.cross(
            normalizedDirection, 
            surfaceNormal, 
            new Cesium.Cartesian3()
        );
        const normalizedRight = Cesium.Cartesian3.normalize(right, new Cesium.Cartesian3());

        const tiltRadians = Cesium.Math.toRadians(tiltAngle);
        let tiltedDirection;

        if (tiltAngle === 0) {
            tiltedDirection = Cesium.Cartesian3.negate(surfaceNormal, new Cesium.Cartesian3());
        } else if (tiltAngle === 90) {
            tiltedDirection = normalizedDirection;
        } else {
            const downWeight = Math.cos(tiltRadians);
            const forwardWeight = Math.sin(tiltRadians);

            const downVector = Cesium.Cartesian3.negate(surfaceNormal, new Cesium.Cartesian3());
            const weightedDown = Cesium.Cartesian3.multiplyByScalar(
                downVector, 
                downWeight, 
                new Cesium.Cartesian3()
            );
            const weightedForward = Cesium.Cartesian3.multiplyByScalar(
                normalizedDirection, 
                forwardWeight, 
                new Cesium.Cartesian3()
            );

            tiltedDirection = Cesium.Cartesian3.add(
                weightedDown, 
                weightedForward, 
                new Cesium.Cartesian3()
            );
            Cesium.Cartesian3.normalize(tiltedDirection, tiltedDirection);
        }

        const cameraUp = Cesium.Cartesian3.cross(
            normalizedRight, 
            tiltedDirection, 
            new Cesium.Cartesian3()
        );
        const normalizedCameraUp = Cesium.Cartesian3.normalize(cameraUp, new Cesium.Cartesian3());

        return {
            direction: tiltedDirection,
            up: normalizedCameraUp
        };
    }

    // --- Terrain Sampling Methods ---

    /**
     * Samples terrain heights for given positions
     * @param {Array<Cesium.Cartesian3>} positions - World positions to sample
     * @param {number} heightOffset - Height offset above terrain (default: 20m)
     * @returns {Promise<Array<Cesium.Cartesian3>>} Terrain-adjusted positions
     */
    async sampleTerrainHeights(positions, heightOffset = 20) {
        if (!this.viewer || !positions || positions.length === 0) {
            return positions || [];
        }

        const cleanPositions = positions.filter(p =>
            Cesium.defined(p) && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
        );

        if (cleanPositions.length === 0) {
            return [];
        }

        let finalPositions = [];

        if (Cesium.defined(this.viewer.terrainProvider) && this.viewer.terrainProvider.ready) {
            try {
                // Convert to cartographic coordinates
                const cartographicPoints = cleanPositions.map(p =>
                    this.viewer.scene.globe.ellipsoid.cartesianToCartographic(p)
                );

                // Sample terrain
                const sampledCartographics = await Cesium.sampleTerrainMostDetailed(
                    this.viewer.terrainProvider,
                    cartographicPoints
                );

                // Convert back to Cartesian with height offset
                finalPositions = sampledCartographics.map(c => {
                    const adjustedHeight = (c.height || 0) + heightOffset;
                    const adjustedCartographic = new Cesium.Cartographic(
                        c.longitude,
                        c.latitude,
                        adjustedHeight
                    );
                    return this.viewer.scene.globe.ellipsoid.cartographicToCartesian(adjustedCartographic);
                });

            } catch (error) {
                console.warn('CesiumCoreManager: Terrain sampling failed, using fallback:', error);
                // Fallback to ellipsoid heights with offset
                finalPositions = cleanPositions.map(p => {
                    const cartographic = this.viewer.scene.globe.ellipsoid.cartesianToCartographic(p);
                    const elevated = new Cesium.Cartographic(
                        cartographic.longitude,
                        cartographic.latitude,
                        (cartographic.height || 0) + heightOffset
                    );
                    return this.viewer.scene.globe.ellipsoid.cartographicToCartesian(elevated);
                });
            }
        } else {
            // No terrain provider, use ellipsoid heights
            finalPositions = cleanPositions.map(p => {
                const cartographic = this.viewer.scene.globe.ellipsoid.cartesianToCartographic(p);
                const elevated = new Cesium.Cartographic(
                    cartographic.longitude,
                    cartographic.latitude,
                    (cartographic.height || 0) + heightOffset
                );
                return this.viewer.scene.globe.ellipsoid.cartographicToCartesian(elevated);
            });
        }

        return finalPositions.filter(p =>
            Cesium.defined(p) && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z)
        );
    }

    // --- Scene Information & Mode Methods --- 
    getSceneInformation() { 
        if (!this.viewer) return {}; 
        const cameraPosition = this.viewer.camera.positionCartographic; 
        if (!cameraPosition) { 
            return { 
                currentCoordinates: { latitude: 0, longitude: 0, elevation: 0 }, 
                terrainType: 'N/A', 
                satelliteImageryType: 'N/A', 
                angle: 0 
            }; 
        } 

        let terrainTypeName = 'Unknown'; 
        if (this.viewer.terrainProvider instanceof Cesium.CesiumTerrainProvider) { 
            terrainTypeName = 'cdem_10m_2016'; 
        } else if (this.viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) { 
            terrainTypeName = 'Ellipsoid (no terrain)'; 
        } else if (this.viewer.terrainProvider) { 
            terrainTypeName = this.viewer.terrainProvider.name || 'Custom Terrain'; 
        } 

        let imageryTypeName = 'Unknown'; 
        if (this.viewer.imageryLayers.length > 0) { 
            let firstVisibleLayer = null; 
            for (let i = 0; i < this.viewer.imageryLayers.length; i++) { 
                const layer = this.viewer.imageryLayers.get(i); 
                if (layer.show) { 
                    firstVisibleLayer = layer.imageryProvider; 
                    break; 
                } 
            } 
            // If no visible layers, try to get the first available layer as a fallback 
            if (!firstVisibleLayer && this.viewer.imageryLayers.length > 0) { 
                firstVisibleLayer = this.viewer.imageryLayers.get(0).imageryProvider; 
            } 

            if (firstVisibleLayer instanceof Cesium.WebMapServiceImageryProvider) { 
                imageryTypeName = firstVisibleLayer.name || 'WMS Layer'; 
                // Check if it's the specific Vedas imagery (assuming this check is desired) 
                if (firstVisibleLayer.url.includes('bhuvan-ras1.nrsc.gov.in') && firstVisibleLayer.layers.includes('bhuvan_img')) { 
                    imageryTypeName = 'Vedas Satellite Imagery'; 
                } 
            } else if (firstVisibleLayer instanceof Cesium.BingMapsImageryProvider) { 
                imageryTypeName = 'Bing Maps'; 
            } else if (firstVisibleLayer) { 
                imageryTypeName = firstVisibleLayer.name || 'Custom Imagery'; 
            } 
        } 

        return { 
            currentCoordinates: { 
                latitude: Cesium.Math.toDegrees(cameraPosition.latitude), 
                longitude: Cesium.Math.toDegrees(cameraPosition.longitude), 
                elevation: cameraPosition.height 
            }, 
            terrainType: terrainTypeName, 
            satelliteImageryType: imageryTypeName, 
            angle: Cesium.Math.toDegrees(this.viewer.camera.heading) 
        }; 
    } 

    setGlobeVisualizationMode(mode) { 
        if (!this.viewer) { 
            console.warn('CesiumCoreManager: Viewer not initialized, cannot set visualization mode.'); 
            return; 
        } 

        switch (mode) { 
            case '2D': 
                this.viewer.scene.mode = Cesium.SceneMode.COLUMBUS_VIEW; 
                this.viewer.scene.screenSpaceCameraController.enableTilt = false; 
                break; 
            case '3D': 
                this.viewer.scene.mode = Cesium.SceneMode.SCENE3D; 
                this.viewer.scene.screenSpaceCameraController.enableTilt = true; 
                break; 
            default: 
                console.warn(`CesiumCoreManager: Unknown visualization mode: ${mode}.`); 
                break; 
        } 
    } 

    /** 
     * Sets the globe's clock to a specific time, affecting day/night rendering. 
     * @param {object} time - An object containing hour, minute, and ampm properties. 
     */ 
    setGlobeClockTime(time) { 
        if (!this.viewer) { 
            console.warn('CesiumCoreManager: Viewer not initialized, cannot set globe clock time.'); 
            return; 
        } 

        const { hour, minute, ampm } = time; 
        let militaryHour = parseInt(hour, 10); 
        const parsedMinute = parseInt(minute, 10); 

        if (ampm === 'PM' && militaryHour !== 12) { 
            militaryHour += 12; 
        } else if (ampm === 'AM' && militaryHour === 12) { 
            militaryHour = 0; // 12 AM is 00:00 military time 
        } 

        // Get the current date to combine with the new time 
        const now = Cesium.JulianDate.toDate(this.viewer.clock.currentTime); 
        const newDateTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), militaryHour, parsedMinute, 0, 0); 

        // Convert the new Date object to Cesium.JulianDate 
        const newJulianDate = Cesium.JulianDate.fromDate(newDateTime); 

        // Set the Cesium viewer's clock current time 
        this.viewer.clock.currentTime = newJulianDate; 
        console.log(`CesiumCoreManager: Globe clock time set to: ${newDateTime.toLocaleTimeString()}`); 
    } 
} 

export default CesiumCoreManager;
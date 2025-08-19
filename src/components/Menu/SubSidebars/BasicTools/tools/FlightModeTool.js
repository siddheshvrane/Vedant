import * as Cesium from 'cesium';
import {
    clearDrawing,
    removeEventHandlers,
    getToolState,
    setToolState,
} from '../tool-helpers/tools-helpers.js';
import { PopupService } from '../../../../../services/PopupService.js';
import { ToolManagementService } from '../../../../../services/ToolManagementService.js';
import { MapService } from '../../../../../services/MapService.js';
import { ScreenRecordingService } from '../../../../../services/ScreenRecordingService.js'; // Import the recording service

// Default flight configuration
const DEFAULT_FLIGHT_CONFIG = {
    moveSpeed: 500,               // meters per second
    turnSpeed: 1.0,               // radians per second
    pitchSpeed: 1.0,              // radians per second
    accelerationFactor: 2.0,      // speed multiplier when shift is held
    showInstructions: true,       // show control instructions
    smoothMovement: true          // enable smooth movement interpolation
};

// Key mapping for flight controls
const FLIGHT_KEYS = {
    // Movement
    FORWARD: ['KeyW', 'ArrowUp'],
    BACKWARD: ['KeyS', 'ArrowDown'],
    LEFT: ['KeyA', 'ArrowLeft'],
    RIGHT: ['KeyD', 'ArrowRight'],
    UP: ['KeyQ', 'Space'],
    DOWN: ['KeyE', 'KeyC'],

    // Camera rotation
    LOOK_UP: ['KeyI'],
    LOOK_DOWN: ['KeyK'],
    LOOK_LEFT: ['KeyJ'],
    LOOK_RIGHT: ['KeyL'],

    // Speed modifier
    ACCELERATE: ['ShiftLeft', 'ShiftRight']
};

/**
 * Sets up the Flight Mode tool with keyboard controls for camera movement
 * @param {Cesium.Viewer} viewer The Cesium Viewer instance.
 */
export function setupFlightModeTool(viewer) {
    console.log("FlightModeTool: Setting up flight mode with keyboard controls");

    // Get CesiumCoreManager instance from viewer with comprehensive fallback
    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("FlightModeTool: Cannot access CesiumCoreManager");
        PopupService.showToolInstruction(
            "Flight Mode requires CesiumCoreManager but it's not available.\n\n" +
            "Please ensure the application is properly initialized.\n\n" +
            "Debug Info:\n" +
            `• Viewer available: ${!!viewer}\n` +
            `• Viewer._coreManager: ${!!viewer?._coreManager}\n` +
            `• window.cesiumCoreManager: ${!!window.cesiumCoreManager}\n` +
            `• MapService.getCoreManager(): ${!!MapService.getCoreManager()}`,
            "Tool Error",
            true
        );
        ToolManagementService.deactivateCurrentTool();
        return;
    }

    console.log("FlightModeTool: CesiumCoreManager successfully obtained");

    // Initialize tool state
    setToolState({
        viewer: viewer,
        coreManager: coreManager,
        handler: viewer ? new Cesium.ScreenSpaceEventHandler(viewer.canvas) : null,
        flightActive: false,
        flightConfig: { ...DEFAULT_FLIGHT_CONFIG },
        activeKeys: new Set(),
        animationFrame: null,
        keyboardHandler: null,
        startPosition: null,
        flightStartTime: null,
        isRecordingActive: false, // New state to track if recording is active
        recordedBlob: null, // To store the blob after recording stops
        recordedInfo: null, // To store info after recording stops
    });

    const { handler } = getToolState();
    const toolName = "Flight Mode";

    // Show detailed initial instructions popup
    PopupService.showToolInstruction(
        `📋 **FLIGHT MODE INSTRUCTIONS:**\n\n` +
        `🖱️ **MOUSE CONTROLS:**\n` +
        `• Left-click anywhere to START flight mode\n` +
        `• Right-click anywhere to STOP flight mode\n\n` +
        `⌨️ **KEYBOARD CONTROLS (active during flight):**\n` +
        `• WASD or Arrow Keys: Move forward/back/left/right\n` +
        `• Q or Space: Move up\n` +
        `• E or C: Move down\n` +
        `• I/J/K/L: Look up/left/down/right\n` +
        `• Hold Shift: Move faster (2x speed)\n\n` +
        `✈️ Ready to fly? Left-click to begin!`,
        "Flight Mode Setup",
        true // Show dismiss button
    );

    // LEFT_CLICK Handler - Start flight mode
    handler.setInputAction((click) => {
        const { flightActive } = getToolState();
        if (!flightActive) {
            startFlightMode(toolName);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // RIGHT_CLICK Handler - Stop flight mode
    handler.setInputAction(() => {
        const { flightActive } = getToolState();
        if (flightActive) {
            stopFlightMode(toolName);
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

/**
 * Gets CesiumCoreManager instance from viewer with comprehensive fallback methods
 */
function getCoreManagerFromViewer(viewer) {
    console.log('FlightModeTool: Looking for CesiumCoreManager...');

    // Method 1: Check if attached to viewer
    if (viewer && viewer._coreManager) {
        console.log('FlightModeTool: ✅ Found CesiumCoreManager attached to viewer');
        return viewer._coreManager;
    }

    // Method 2: Check MapService first (most reliable)
    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) {
            console.log('FlightModeTool: ✅ Found CesiumCoreManager in MapService');
            return coreManagerFromMapService;
        }
    } catch (error) {
        console.warn('FlightModeTool: Could not get core manager from MapService:', error);
    }

    // Method 3: Check global reference
    if (window.cesiumCoreManager) {
        console.log('FlightModeTool: ✅ Found CesiumCoreManager in global window');
        return window.cesiumCoreManager;
    }

    console.error('FlightModeTool: ❌ CesiumCoreManager not found in any expected location');
    console.error('FlightModeTool: Debug information:');
    console.error(`  • viewer exists: ${!!viewer}`);
    console.error(`  • viewer._coreManager exists: ${!!viewer?._coreManager}`);
    console.error(`  • window.cesiumCoreManager exists: ${!!window.cesiumCoreManager}`);
    console.error(`  • MapService.getCoreManager() exists: ${!!MapService.getCoreManager()}`);

    return null;
}

/**
 * Starts the flight mode with keyboard controls
 */
async function startFlightMode(toolName) {
    console.log("FlightModeTool: Starting flight mode");

    // Step 1: Prompt user for audio device selection
    const audioDevices = ScreenRecordingService.availableAudioDevices$.getValue();
    let selectedAudioDeviceId = 'none'; // Default to no audio

    await new Promise((resolve, reject) => {
        PopupService.showSelectAudioDeviceForm({
            audioDevices: audioDevices,
            onSelect: (deviceId) => {
                selectedAudioDeviceId = deviceId;
                resolve();
            },
            onCancel: () => {
                reject(new Error("Audio device selection cancelled. Flight mode will not start."));
            }
        });
    });

    // Update ScreenRecordingService config with the selected audio device
    ScreenRecordingService.updateConfig({ audioSource: selectedAudioDeviceId });

    try {
        // Step 2: Start screen recording
        const recordingStarted = await ScreenRecordingService.startRecording();
        if (!recordingStarted) {
            throw new Error("Screen recording failed to start. Flight mode cancelled.");
        }
        setToolState({ isRecordingActive: true });

        const { viewer, coreManager } = getToolState();
        const startPosition = coreManager.getCameraState().position.clone();
        const startTime = Date.now();

        setToolState({
            flightActive: true,
            startPosition: startPosition,
            flightStartTime: startTime
        });

        // Set up keyboard event listeners
        setupKeyboardControls();

        // Start animation loop
        startFlightAnimation();

        // Update instructions
        const { flightConfig } = getToolState();
        if (flightConfig.showInstructions) {
            PopupService.showToolInstruction(
                `Flight Mode Active! Recording is in progress. WASD/Arrows: Move | IJKL: Look | Q/E: Up/Down | Shift: Faster | Right-click: Stop`,
                "Flight Controls",
                false
            );
        }

        // Disable default camera controls using CesiumCoreManager
        coreManager.setDefaultCameraControlsEnabled(false);

        console.log("FlightModeTool: Flight mode started successfully");
    } catch (error) {
        console.error("FlightModeTool: Error during flight mode start or recording:", error);
        PopupService.showToolInstruction(
            `Flight mode failed to start: ${error.message || 'Unknown error'}`,
            "Flight Mode Error",
            true
        );
        ToolManagementService.deactivateCurrentTool();
        return;
    }
}

/**
 * Stops the flight mode and restores normal camera controls
 */
async function stopFlightMode(toolName) {
    console.log("FlightModeTool: Stopping flight mode");

    const { animationFrame, flightStartTime, coreManager, isRecordingActive } = getToolState();

    // Stop animation loop
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    // Remove keyboard event listeners
    removeKeyboardControls();

    // Restore default camera controls using CesiumCoreManager
    coreManager.setDefaultCameraControlsEnabled(true);

    // Stop recording if active
    if (isRecordingActive) {
        PopupService.showToolInstruction(
            'Flight mode stopped. Stopping recording...',
            'Finishing Up',
            false
        );
        try {
            const { blob, info } = await ScreenRecordingService.stopRecording();
            setToolState({ isRecordingActive: false, recordedBlob: blob, recordedInfo: info });

            // Offer download after recording stops
            PopupService.showDownloadRecordingForm({
                recordingInfo: info,
                onDownload: () => {
                    ScreenRecordingService.downloadRecording(blob, info.timestamp);
                },
                onCancel: () => {
                    console.log("FlightModeTool: Download cancelled by user.");
                }
            });

        } catch (recordingError) {
            console.error('FlightModeTool: Error stopping recording:', recordingError);
            PopupService.showToolInstruction(
                `Recording failed to stop or save: ${recordingError.message}`,
                'Recording Error',
                true
            );
        }
    }


    // Update state
    setToolState({
        flightActive: false,
        activeKeys: new Set(),
        animationFrame: null,
        keyboardHandler: null
    });

    // Show completion message
    if (flightStartTime) {
        const flightDuration = ((Date.now() - flightStartTime) / 1000).toFixed(1);
        PopupService.showToolInstruction(
            `Flight mode stopped. Flight duration: ${flightDuration}s`,
            "Flight Complete",
            true
        );
    }

    console.log("FlightModeTool: Flight mode stopped successfully");
}

/**
 * Sets up keyboard event listeners for flight controls
 */
function setupKeyboardControls() {
    const { activeKeys } = getToolState();

    const keyDownHandler = (event) => {
        // Prevent default behavior for our control keys
        if (isFlightKey(event.code)) {
            event.preventDefault();
            activeKeys.add(event.code);
        }
    };

    const keyUpHandler = (event) => {
        if (isFlightKey(event.code)) {
            event.preventDefault();
            activeKeys.delete(event.code);
        }
    };

    // Add event listeners to document to capture keys even when canvas doesn't have focus
    document.addEventListener('keydown', keyDownHandler, true);
    document.addEventListener('keyup', keyUpHandler, true);

    // Store handlers for cleanup
    setToolState({
        keyboardHandler: {
            keyDown: keyDownHandler,
            keyUp: keyUpHandler
        }
    });

    console.log("FlightModeTool: Keyboard controls initialized");
}

/**
 * Removes keyboard event listeners
 */
function removeKeyboardControls() {
    const { keyboardHandler } = getToolState();

    if (keyboardHandler) {
        document.removeEventListener('keydown', keyboardHandler.keyDown, true);
        document.removeEventListener('keyup', keyboardHandler.keyUp, true);
        console.log("FlightModeTool: Keyboard controls removed");
    }
}

/**
 * Checks if a key code is a flight control key
 */
function isFlightKey(keyCode) {
    return Object.values(FLIGHT_KEYS).some(keys => keys.includes(keyCode));
}

/**
 * Starts the flight animation loop
 */
function startFlightAnimation() {
    const animate = () => {
        const { flightActive } = getToolState();

        if (!flightActive) {
            return; // Stop animation if flight is no longer active
        }

        updateCameraFromInput();

        // Request next frame
        const frameId = requestAnimationFrame(animate);
        setToolState({ animationFrame: frameId });
    };

    animate();
}

/**
 * Updates camera position and orientation based on active keys using CesiumCoreManager
 */
function updateCameraFromInput() {
    const { activeKeys, flightConfig, coreManager, viewer } = getToolState();

    if (activeKeys.size === 0) {
        return; // No keys pressed, no movement needed
    }

    // Calculate delta time (assume 60fps for consistent movement)
    const deltaTime = 1/60;

    // Check if acceleration key is pressed
    const isAccelerating = FLIGHT_KEYS.ACCELERATE.some(key => activeKeys.has(key));
    const speedMultiplier = isAccelerating ? flightConfig.accelerationFactor : 1.0;

    // Calculate movement speeds
    const moveSpeed = flightConfig.moveSpeed * speedMultiplier * deltaTime;
    const turnSpeed = flightConfig.turnSpeed * deltaTime;
    const pitchSpeed = flightConfig.pitchSpeed * deltaTime;

    // Get current camera state from CesiumCoreManager
    const cameraState = coreManager.getCameraState();
    const { position, direction, right, up } = cameraState;

    // Movement calculations
    const movement = new Cesium.Cartesian3(0, 0, 0);

    // Forward/Backward movement
    if (FLIGHT_KEYS.FORWARD.some(key => activeKeys.has(key))) {
        const forwardMovement = Cesium.Cartesian3.multiplyByScalar(direction, moveSpeed, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(movement, forwardMovement, movement);
    }
    if (FLIGHT_KEYS.BACKWARD.some(key => activeKeys.has(key))) {
        const backwardMovement = Cesium.Cartesian3.multiplyByScalar(direction, -moveSpeed, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(movement, backwardMovement, movement);
    }

    // Left/Right strafe movement
    if (FLIGHT_KEYS.LEFT.some(key => activeKeys.has(key))) {
        const leftMovement = Cesium.Cartesian3.multiplyByScalar(right, -moveSpeed, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(movement, leftMovement, movement);
    }
    if (FLIGHT_KEYS.RIGHT.some(key => activeKeys.has(key))) {
        const rightMovement = Cesium.Cartesian3.multiplyByScalar(right, moveSpeed, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(movement, rightMovement, movement);
    }

    // Up/Down movement
    if (FLIGHT_KEYS.UP.some(key => activeKeys.has(key))) {
        const upMovement = Cesium.Cartesian3.multiplyByScalar(up, moveSpeed, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(movement, upMovement, movement);
    }
    if (FLIGHT_KEYS.DOWN.some(key => activeKeys.has(key))) {
        const downMovement = Cesium.Cartesian3.multiplyByScalar(up, -moveSpeed, new Cesium.Cartesian3());
        Cesium.Cartesian3.add(movement, downMovement, movement);
    }

    // Apply movement using CesiumCoreManager
    if (!Cesium.Cartesian3.equals(movement, Cesium.Cartesian3.ZERO)) {
        coreManager.moveCamera(movement);
    }

    // Camera rotation (look around) using CesiumCoreManager
    if (FLIGHT_KEYS.LOOK_LEFT.some(key => activeKeys.has(key))) {
        coreManager.rotateCamera('left', turnSpeed);
    }
    if (FLIGHT_KEYS.LOOK_RIGHT.some(key => activeKeys.has(key))) {
        coreManager.rotateCamera('right', turnSpeed);
    }
    if (FLIGHT_KEYS.LOOK_UP.some(key => activeKeys.has(key))) {
        coreManager.rotateCamera('up', pitchSpeed);
    }
    if (FLIGHT_KEYS.LOOK_DOWN.some(key => activeKeys.has(key))) {
        coreManager.rotateCamera('down', pitchSpeed);
    }

    // Request render if in render mode
    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

/**
 * Stops the flight mode tool and cleans up resources
 */
export async function stopFlightModeTool() {
    console.log("FlightModeTool: Cleaning up flight mode tool");

    const { viewer, flightActive, animationFrame, coreManager, isRecordingActive } = getToolState();

    // Stop flight mode if active
    if (flightActive && viewer) {
        await stopFlightMode("Flight Mode");
    }

    // Cancel any pending animation frame
    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    // Remove keyboard controls
    removeKeyboardControls();

    // Stop recording if active and a clean stop has not occurred
    if (isRecordingActive) {
      PopupService.showToolInstruction('Unexpected cleanup. Stopping recording...', 'Finishing Up', false);
      try {
        const { blob, info } = await ScreenRecordingService.stopRecording();
        PopupService.showDownloadRecordingForm({
          recordingInfo: info,
          onDownload: () => ScreenRecordingService.downloadRecording(blob, info.timestamp),
          onCancel: () => console.log("FlightModeTool: Download cancelled during cleanup."),
        });
      } catch (error) {
        console.error('FlightModeTool: Error during unexpected recording stop:', error);
      }
    }


    // Clear drawing and remove event handlers
    clearDrawing();
    removeEventHandlers();

    // Reset tool state
    setToolState({
        flightActive: false,
        flightConfig: { ...DEFAULT_FLIGHT_CONFIG },
        activeKeys: new Set(),
        animationFrame: null,
        keyboardHandler: null,
        startPosition: null,
        flightStartTime: null,
        coreManager: null,
        isRecordingActive: false,
        recordedBlob: null,
        recordedInfo: null,
    });

    // Hide any active popups
    PopupService.hide();

    console.log("FlightModeTool: Cleanup completed");
}
// FlightModeTool.js - Integrated with ScreenRecordingHelper

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
import { ScreenRecordingHelper } from '../tool-helpers/ScreenRecordingHelper.js';

const DEFAULT_FLIGHT_CONFIG = {
    moveSpeed: 500,
    turnSpeed: 1.0,
    pitchSpeed: 1.0,
    accelerationFactor: 2.0,
    showInstructions: true,
    smoothMovement: true
};

const FLIGHT_KEYS = {
    FORWARD: ['KeyW', 'ArrowUp'],
    BACKWARD: ['KeyS', 'ArrowDown'],
    LEFT: ['KeyA', 'ArrowLeft'],
    RIGHT: ['KeyD', 'ArrowRight'],
    UP: ['KeyQ', 'Space'],
    DOWN: ['KeyE', 'KeyC'],
    LOOK_UP: ['KeyI'],
    LOOK_DOWN: ['KeyK'],
    LOOK_LEFT: ['KeyJ'],
    LOOK_RIGHT: ['KeyL'],
    ACCELERATE: ['ShiftLeft', 'ShiftRight']
};

export function setupFlightModeTool(viewer) {
    console.log("FlightModeTool: Setting up flight mode");

    const coreManager = getCoreManagerFromViewer(viewer);
    if (!coreManager) {
        console.error("FlightModeTool: CesiumCoreManager not available");
        PopupService.showToolInstruction(
            "Flight Mode requires CesiumCoreManager but it's not available.",
            "Tool Error",
            true
        );
        ToolManagementService.deactivateCurrentTool();
        return;
    }

    setToolState({
        viewer: viewer,
        coreManager: coreManager,
        handler: new Cesium.ScreenSpaceEventHandler(viewer.canvas),
        flightActive: false,
        flightConfig: { ...DEFAULT_FLIGHT_CONFIG },
        activeKeys: new Set(),
        animationFrame: null,
        keyboardHandler: null,
        startPosition: null,
        flightStartTime: null,
        recordingHelper: null,
        flightModeId: null,
    });

    const { handler } = getToolState();
    const toolName = "Flight Mode";

    const baseInstructions = `📋 **FLIGHT MODE INSTRUCTIONS:**\n\n` +
        `🖱️ **GET STARTED:**\n` +
        `• Left-click anywhere to configure and START flight mode\n\n` +
        `⌨️ **FLIGHT CONTROLS:**\n` +
        `• WASD/Arrows: Move forward/back/left/right\n` +
        `• Q/Space: Move up | E/C: Move down\n` +
        `• I/J/K/L: Look up/left/down/right\n` +
        `• Hold Shift: Move faster (2x speed)\n\n` +
        `🛑 **TO FINISH:**\n` +
        `• Right-click to STOP flight and save recording`;

    const enhancedInstructions = ScreenRecordingHelper.addRecordingContextToInstructions(baseInstructions, toolName);

    PopupService.showToolInstruction(enhancedInstructions, "Flight Mode Setup", true);

    handler.setInputAction(async () => {
        const { flightActive } = getToolState();
        if (!flightActive) {
            await initializeFlightModeWithRecording(toolName);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    handler.setInputAction(async () => {
        const { flightActive } = getToolState();
        if (flightActive) {
            await stopFlightModeWithRecording(toolName);
        }
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}

function getCoreManagerFromViewer(viewer) {
    try {
        const coreManagerFromMapService = MapService.getCoreManager();
        if (coreManagerFromMapService) return coreManagerFromMapService;
    } catch (error) {
        console.warn('FlightModeTool: Could not get core manager from MapService:', error);
    }

    if (viewer && viewer._coreManager) return viewer._coreManager;
    if (window.cesiumCoreManager) return window.cesiumCoreManager;

    return null;
}

async function initializeFlightModeWithRecording(toolName) {
    try {
        const flightModeId = `flightmode_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        setToolState({ flightModeId: flightModeId });

        let recordingHelper = null;

        try {
            const recordingSetup = await ScreenRecordingHelper.initializeRecording();
            
            if (recordingSetup.cancelled) {
                ToolManagementService.deactivateCurrentTool();
                return;
            }

            if (recordingSetup.recordingEnabled) {
                recordingHelper = recordingSetup.helper;
                await recordingHelper.startRecording(recordingSetup.config);
                setToolState({ recordingHelper: recordingHelper });
                
                PopupService.showToolInstruction(
                    '🔴 Recording started! Flight mode beginning...',
                    'Recording Active',
                    false
                );
            }
        } catch (recordingError) {
            console.warn('FlightModeTool: Recording setup failed:', recordingError);
            
            const continueWithoutRecording = await PopupService.showConfirmation(
                `${recordingError.message}\n\nContinue without recording?`,
                'Recording Setup Failed',
                'Continue Without Recording',
                'Cancel Flight Mode'
            );

            if (!continueWithoutRecording) {
                ToolManagementService.deactivateCurrentTool();
                return;
            }
        }

        await startFlightMode(toolName, recordingHelper);

    } catch (error) {
        console.error("FlightModeTool: Critical error:", error);

        const { recordingHelper } = getToolState();
        if (recordingHelper) {
            recordingHelper.cleanup();
        }

        PopupService.showToolInstruction(`Flight mode failed: ${error.message}`, 'Error', true);
        ToolManagementService.deactivateCurrentTool();
    }
}

async function startFlightMode(toolName, recordingHelper) {
    const { coreManager } = getToolState();
    const startPosition = coreManager.getCameraState().position.clone();
    const startTime = Date.now();

    setToolState({
        flightActive: true,
        startPosition: startPosition,
        flightStartTime: startTime
    });

    setupKeyboardControls();
    startFlightAnimation();

    const { flightConfig } = getToolState();
    if (flightConfig.showInstructions) {
        const recordingStatus = recordingHelper ? '🔴 Recording Active!' : 'No recording.';
        PopupService.showToolInstruction(
            `✈️ Flight Mode Active! ${recordingStatus}\n\n` +
            `WASD/Arrows: Move | IJKL: Look | Q/E: Up/Down | Shift: Faster\n\n` +
            `Right-click to STOP`,
            "Flight Controls",
            false
        );
    }

    coreManager.setDefaultCameraControlsEnabled(false);
}

async function stopFlightModeWithRecording(toolName) {
    const { animationFrame, flightStartTime, coreManager, recordingHelper, flightModeId } = getToolState();

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    removeKeyboardControls();
    coreManager.setDefaultCameraControlsEnabled(true);

    const flightDuration = flightStartTime ? ((Date.now() - flightStartTime) / 1000).toFixed(1) : 0;

    let recordingBlob = null;
    let recordingInfo = null;

    if (recordingHelper) {
        try {
            PopupService.showToolInstruction(
                'Flight completed. Processing recording...',
                'Processing',
                false
            );

            const result = await recordingHelper.stopRecording();
            
            if (result && result.blob) {
                recordingBlob = result.blob;
                recordingInfo = result.info;

                const shouldDownload = await PopupService.showConfirmation(
                    `Recording complete!\n\nSize: ${result.info.sizeFormatted}\nDuration: ${result.info.durationFormatted}\n\nDownload now?`,
                    'Recording Complete',
                    'Download Recording',
                    'Skip Download'
                );

                if (shouldDownload) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('.')[0];
                    const filename = `flight-mode-${timestamp}.webm`;
                    await ScreenRecordingHelper.downloadRecording(recordingBlob, filename);
                }
            }
        } catch (recordingError) {
            console.error('FlightModeTool: Error processing recording:', recordingError);
        } finally {
            recordingHelper.cleanup();
        }
    }

    setToolState({
        flightActive: false,
        activeKeys: new Set(),
        animationFrame: null,
        keyboardHandler: null
    });

    const flightValue = `Flight: ${flightDuration}s${recordingBlob ? ' (Recorded)' : ''}`;

    const entities = {
        flightModeId: flightModeId,
        recordingBlob: recordingBlob,
        recordingInfo: recordingInfo,
        flightDuration: parseFloat(flightDuration),
        startTime: flightStartTime,
        endTime: Date.now()
    };

    ToolManagementService.addMeasurement('Flight Mode', flightValue, entities);

    if (!recordingHelper) {
        PopupService.showToolInstruction(
            `Flight completed: ${flightDuration}s`,
            "Success",
            true
        );
    }

    setTimeout(() => {
        ToolManagementService.deactivateCurrentTool();
    }, 2000);
}

function setupKeyboardControls() {
    const { activeKeys } = getToolState();

    const keyDownHandler = (event) => {
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

    document.addEventListener('keydown', keyDownHandler, true);
    document.addEventListener('keyup', keyUpHandler, true);

    setToolState({
        keyboardHandler: {
            keyDown: keyDownHandler,
            keyUp: keyUpHandler
        }
    });
}

function removeKeyboardControls() {
    const { keyboardHandler } = getToolState();

    if (keyboardHandler) {
        document.removeEventListener('keydown', keyboardHandler.keyDown, true);
        document.removeEventListener('keyup', keyboardHandler.keyUp, true);
    }
}

function isFlightKey(keyCode) {
    return Object.values(FLIGHT_KEYS).some(keys => keys.includes(keyCode));
}

function startFlightAnimation() {
    const animate = () => {
        const { flightActive } = getToolState();

        if (!flightActive) return;

        updateCameraFromInput();

        const frameId = requestAnimationFrame(animate);
        setToolState({ animationFrame: frameId });
    };

    animate();
}

function updateCameraFromInput() {
    const { activeKeys, flightConfig, coreManager, viewer } = getToolState();

    if (activeKeys.size === 0) return;

    const deltaTime = 1/60;
    const isAccelerating = FLIGHT_KEYS.ACCELERATE.some(key => activeKeys.has(key));
    const speedMultiplier = isAccelerating ? flightConfig.accelerationFactor : 1.0;

    const moveSpeed = flightConfig.moveSpeed * speedMultiplier * deltaTime;
    const turnSpeed = flightConfig.turnSpeed * deltaTime;
    const pitchSpeed = flightConfig.pitchSpeed * deltaTime;

    const cameraState = coreManager.getCameraState();
    const { direction, right, up } = cameraState;

    const movement = new Cesium.Cartesian3(0, 0, 0);

    if (FLIGHT_KEYS.FORWARD.some(key => activeKeys.has(key))) {
        Cesium.Cartesian3.add(movement, Cesium.Cartesian3.multiplyByScalar(direction, moveSpeed, new Cesium.Cartesian3()), movement);
    }
    if (FLIGHT_KEYS.BACKWARD.some(key => activeKeys.has(key))) {
        Cesium.Cartesian3.add(movement, Cesium.Cartesian3.multiplyByScalar(direction, -moveSpeed, new Cesium.Cartesian3()), movement);
    }
    if (FLIGHT_KEYS.LEFT.some(key => activeKeys.has(key))) {
        Cesium.Cartesian3.add(movement, Cesium.Cartesian3.multiplyByScalar(right, -moveSpeed, new Cesium.Cartesian3()), movement);
    }
    if (FLIGHT_KEYS.RIGHT.some(key => activeKeys.has(key))) {
        Cesium.Cartesian3.add(movement, Cesium.Cartesian3.multiplyByScalar(right, moveSpeed, new Cesium.Cartesian3()), movement);
    }
    if (FLIGHT_KEYS.UP.some(key => activeKeys.has(key))) {
        Cesium.Cartesian3.add(movement, Cesium.Cartesian3.multiplyByScalar(up, moveSpeed, new Cesium.Cartesian3()), movement);
    }
    if (FLIGHT_KEYS.DOWN.some(key => activeKeys.has(key))) {
        Cesium.Cartesian3.add(movement, Cesium.Cartesian3.multiplyByScalar(up, -moveSpeed, new Cesium.Cartesian3()), movement);
    }

    if (!Cesium.Cartesian3.equals(movement, Cesium.Cartesian3.ZERO)) {
        coreManager.moveCamera(movement);
    }

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

    if (viewer.scene.requestRenderMode) {
        viewer.scene.requestRender();
    }
}

export async function stopFlightModeTool() {
    const { flightActive, animationFrame, recordingHelper } = getToolState();

    if (flightActive) {
        await stopFlightModeWithRecording("Flight Mode");
    }

    if (animationFrame) {
        cancelAnimationFrame(animationFrame);
    }

    removeKeyboardControls();

    if (recordingHelper) {
        recordingHelper.cleanup();
    }

    clearDrawing();
    removeEventHandlers();

    setToolState({
        flightActive: false,
        flightConfig: { ...DEFAULT_FLIGHT_CONFIG },
        activeKeys: new Set(),
        animationFrame: null,
        keyboardHandler: null,
        startPosition: null,
        flightStartTime: null,
        recordingHelper: null,
        flightModeId: null,
    });

    PopupService.hide();
}
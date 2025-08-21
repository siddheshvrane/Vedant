// services/FlythroughPlaybackService.js

import { BehaviorSubject } from 'rxjs';
import { MapService } from './MapService.js';
import * as Cesium from 'cesium';

class FlythroughPlaybackServiceClass {
    constructor() {
        this.activeFlythroughs = new Map(); // Store active flythrough instances
        this.playbackStates$ = new BehaviorSubject(new Map()); // Observable for playback states
    }

    /**
     * Calculate total duration for a flythrough path
     * @param {Array} path - Array of Cartesian3 positions
     * @param {Object} config - Flythrough configuration
     * @returns {number} Duration in seconds
     */
    calculateFlythroughDuration(path, config) {
        if (!path || path.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
            const distance = Cesium.Cartesian3.distance(path[i-1], path[i]);
            totalDistance += distance;
        }

        const speed = config.cameraSpeed || 10; // meters per second
        const pauseTime = ((path.length - 1) * (config.pauseBetweenPoints || 200)) / 1000; // convert ms to seconds
        
        const duration = (totalDistance / speed) + pauseTime;
        console.log('FlythroughPlaybackService: Calculated duration:', duration, 'seconds for', path.length, 'points');
        return duration;
    }

    /**
     * Register a new flythrough with its path data
     * @param {string} id - Unique identifier for the flythrough
     * @param {Object} flythroughData - Data containing path, config, and other info
     */
    registerFlythrough(id, flythroughData) {
        const flythroughInstance = {
            id: id,
            path: flythroughData.path || [],
            config: flythroughData.config || {},
            totalDuration: flythroughData.totalDuration || 0,
            currentTime: 0,
            progress: 0,
            state: 'stopped', // 'playing', 'paused', 'stopped'
            animationId: null,
            startTime: null,
            pausedTime: 0,
            recordingBlob: flythroughData.recordingBlob || null,
            coreManager: null,
        };

        this.activeFlythroughs.set(id, flythroughInstance);
        this._updatePlaybackStates();
        
        console.log('FlythroughPlaybackService: Registered flythrough:', id);
        return flythroughInstance;
    }

    /**
     * Play a flythrough from a specific time position
     * @param {string} id - Flythrough ID
     * @param {number} fromTime - Time in seconds to start from
     */
    async playFlythrough(id, fromTime = 0) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found:', id);
            return false;
        }

        try {
            // Stop any currently playing flythrough
            this._stopAllFlythroughs();

            // Get CesiumCoreManager
            const coreManager = MapService.getCoreManager();
            if (!coreManager) {
                throw new Error('CesiumCoreManager not available');
            }

            flythrough.coreManager = coreManager;
            flythrough.state = 'playing';
            flythrough.currentTime = fromTime;
            flythrough.startTime = Date.now() - (fromTime * 1000);
            flythrough.pausedTime = 0;

            // Calculate progress based on fromTime
            flythrough.progress = flythrough.totalDuration > 0 
                ? (fromTime / flythrough.totalDuration) * 100 
                : 0;

            // Calculate starting position in path based on time
            const startIndex = this._calculatePathIndexFromTime(flythrough, fromTime);
            const pathSegment = flythrough.path.slice(startIndex);

            if (pathSegment.length < 2) {
                console.warn('FlythroughPlaybackService: Not enough path points to continue from this position');
                flythrough.state = 'stopped';
                this._updatePlaybackStates();
                return false;
            }

            // Create flight animation from the calculated position
            flythrough.animationId = coreManager.createFlightAnimation(
                pathSegment,
                {
                    speed: flythrough.config.cameraSpeed || 10,
                    height: flythrough.config.cameraHeight || 20,
                    tilt: flythrough.config.cameraTilt || 45,
                    pauseBetweenPoints: flythrough.config.pauseBetweenPoints || 200,
                    enableSmoothing: true
                },
                // Progress callback
                (progress) => {
                    if (flythrough.state === 'playing') {
                        const elapsedTime = (Date.now() - flythrough.startTime) / 1000;
                        flythrough.currentTime = fromTime + progress.elapsedTime;
                        flythrough.progress = flythrough.totalDuration > 0 
                            ? (flythrough.currentTime / flythrough.totalDuration) * 100 
                            : 0;
                        
                        this._updatePlaybackStates();
                    }
                },
                // Completion callback
                () => {
                    flythrough.state = 'stopped';
                    flythrough.currentTime = flythrough.totalDuration;
                    flythrough.progress = 100;
                    flythrough.animationId = null;
                    this._updatePlaybackStates();
                    
                    console.log('FlythroughPlaybackService: Flythrough completed:', id);
                }
            );

            this._updatePlaybackStates();
            console.log('FlythroughPlaybackService: Started playback for:', id, 'from time:', fromTime);
            return true;

        } catch (error) {
            console.error('FlythroughPlaybackService: Error starting playback:', error);
            flythrough.state = 'stopped';
            this._updatePlaybackStates();
            return false;
        }
    }

    /**
     * Pause a flythrough
     * @param {string} id - Flythrough ID
     */
    pauseFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found:', id);
            return false;
        }

        if (flythrough.state === 'playing') {
            flythrough.state = 'paused';
            flythrough.pausedTime = Date.now();
            
            // Cancel the current animation
            if (flythrough.animationId && flythrough.coreManager) {
                flythrough.coreManager.cancelFlightAnimation(flythrough.animationId);
                flythrough.animationId = null;
            }

            this._updatePlaybackStates();
            console.log('FlythroughPlaybackService: Paused flythrough:', id);
            return true;
        }

        return false;
    }

    /**
     * Stop a flythrough completely
     * @param {string} id - Flythrough ID
     */
    stopFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found:', id);
            return false;
        }

        flythrough.state = 'stopped';
        flythrough.currentTime = 0;
        flythrough.progress = 0;
        flythrough.startTime = null;
        flythrough.pausedTime = 0;

        // Cancel any active animation
        if (flythrough.animationId && flythrough.coreManager) {
            flythrough.coreManager.cancelFlightAnimation(flythrough.animationId);
            flythrough.animationId = null;
        }

        this._updatePlaybackStates();
        console.log('FlythroughPlaybackService: Stopped flythrough:', id);
        return true;
    }

    /**
     * Seek to a specific position in the flythrough
     * @param {string} id - Flythrough ID
     * @param {number} percentage - Position as percentage (0-100)
     */
    seekFlythrough(id, percentage) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found:', id);
            return false;
        }

        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        const seekTime = (clampedPercentage / 100) * flythrough.totalDuration;
        
        flythrough.progress = clampedPercentage;
        flythrough.currentTime = seekTime;

        // If currently playing, restart from the new position
        if (flythrough.state === 'playing') {
            this.pauseFlythrough(id);
            setTimeout(() => {
                this.playFlythrough(id, seekTime);
            }, 100);
        }

        this._updatePlaybackStates();
        console.log('FlythroughPlaybackService: Seeked flythrough:', id, 'to:', clampedPercentage + '%');
        return true;
    }

    /**
     * Get current progress for a flythrough
     * @param {string} id - Flythrough ID
     * @returns {number} Progress as percentage (0-100)
     */
    getProgress(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.progress : 0;
    }

    /**
     * Get current time for a flythrough
     * @param {string} id - Flythrough ID
     * @returns {number} Current time in seconds
     */
    getCurrentTime(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.currentTime : 0;
    }

    /**
     * Get total duration for a flythrough
     * @param {string} id - Flythrough ID
     * @returns {number} Total duration in seconds
     */
    getTotalDuration(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.totalDuration : 0;
    }

    /**
     * Get current state for a flythrough
     * @param {string} id - Flythrough ID
     * @returns {string} State: 'playing', 'paused', or 'stopped'
     */
    getState(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.state : 'stopped';
    }

    /**
     * Remove a flythrough from tracking
     * @param {string} id - Flythrough ID
     */
    unregisterFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (flythrough) {
            // Stop it first if playing
            this.stopFlythrough(id);
            
            // Remove from tracking
            this.activeFlythroughs.delete(id);
            this._updatePlaybackStates();
            
            console.log('FlythroughPlaybackService: Unregistered flythrough:', id);
            return true;
        }
        
        return false;
    }

    /**
     * Get all active flythrough states
     * @returns {Map} Map of flythrough states
     */
    getPlaybackStates() {
        return this.playbackStates$.getValue();
    }

    // Private methods

    /**
     * Update the playback states observable
     */
    _updatePlaybackStates() {
        const states = new Map();
        this.activeFlythroughs.forEach((flythrough, id) => {
            states.set(id, {
                id: id,
                state: flythrough.state,
                progress: flythrough.progress,
                currentTime: flythrough.currentTime,
                totalDuration: flythrough.totalDuration
            });
        });
        this.playbackStates$.next(states);
    }

    /**
     * Stop all currently playing flythroughs
     */
    _stopAllFlythroughs() {
        this.activeFlythroughs.forEach((flythrough, id) => {
            if (flythrough.state === 'playing') {
                this.pauseFlythrough(id);
            }
        });
    }

    /**
     * Calculate path index based on time position
     * @param {Object} flythrough - Flythrough instance
     * @param {number} time - Time in seconds
     * @returns {number} Path index
     */
    _calculatePathIndexFromTime(flythrough, time) {
        if (!flythrough.path || flythrough.path.length === 0) return 0;
        if (flythrough.totalDuration === 0) return 0;

        const percentage = time / flythrough.totalDuration;
        const index = Math.floor(percentage * (flythrough.path.length - 1));
        return Math.max(0, Math.min(flythrough.path.length - 1, index));
    }
}

// Create and export the service instance
export const FlythroughPlaybackService = new FlythroughPlaybackServiceClass();
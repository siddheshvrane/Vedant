// services/FlythroughPlaybackService.js

import { BehaviorSubject } from 'rxjs';
import { MapService } from './MapService.js';
import * as Cesium from 'cesium';

class FlythroughPlaybackServiceClass {
    constructor() {
        this.activeFlythroughs = new Map(); // Store active flythrough instances
        this.playbackStates$ = new BehaviorSubject(new Map()); // Observable for playback states
        console.log('FlythroughPlaybackService: Initialized');
    }

    /**
     * Calculate total duration for a flythrough path
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
     * Register a new flythrough with its path data and recording blob
     */
    registerFlythrough(id, flythroughData) {
        console.log('FlythroughPlaybackService: Registering flythrough:', id, 'with data:', {
            hasPath: !!(flythroughData.path && flythroughData.path.length),
            pathLength: flythroughData.path?.length || 0,
            hasRecording: !!flythroughData.recordingBlob,
            totalDuration: flythroughData.totalDuration
        });

        const flythroughInstance = {
            id: id,
            path: flythroughData.path || [],
            config: flythroughData.config || {},
            totalDuration: flythroughData.totalDuration || this.calculateFlythroughDuration(flythroughData.path, flythroughData.config),
            currentTime: 0,
            progress: 0,
            state: 'stopped', // 'playing', 'paused', 'stopped'
            animationId: null,
            startTime: null,
            pausedTime: 0,
            recordingBlob: flythroughData.recordingBlob || null,
            recordingUrl: null,
            videoElement: null,
            coreManager: null,
        };

        // Create video element if recording blob exists
        if (flythroughInstance.recordingBlob) {
            this._createVideoElement(flythroughInstance);
        }

        this.activeFlythroughs.set(id, flythroughInstance);
        this._updatePlaybackStates();
        
        console.log('FlythroughPlaybackService: Successfully registered flythrough:', id);
        console.log('FlythroughPlaybackService: Active flythroughs:', Array.from(this.activeFlythroughs.keys()));
        return flythroughInstance;
    }

    /**
     * Create video element for recorded flythrough
     */
    _createVideoElement(flythroughInstance) {
        try {
            if (flythroughInstance.recordingBlob) {
                // Create blob URL
                flythroughInstance.recordingUrl = URL.createObjectURL(flythroughInstance.recordingBlob);
                
                // Create video element
                const video = document.createElement('video');
                video.src = flythroughInstance.recordingUrl;
                video.style.display = 'none';
                video.preload = 'metadata';
                video.muted = true; // Prevent autoplay issues

                // Add event listeners
                video.addEventListener('loadedmetadata', () => {
                    console.log('FlythroughPlaybackService: Video metadata loaded for', flythroughInstance.id);
                    // Update duration from actual video if different
                    if (video.duration && Math.abs(video.duration - flythroughInstance.totalDuration) > 1) {
                        flythroughInstance.totalDuration = video.duration;
                        this._updatePlaybackStates();
                    }
                });

                video.addEventListener('timeupdate', () => {
                    if (flythroughInstance.state === 'playing') {
                        flythroughInstance.currentTime = video.currentTime;
                        flythroughInstance.progress = flythroughInstance.totalDuration > 0 
                            ? (video.currentTime / flythroughInstance.totalDuration) * 100 
                            : 0;
                        this._updatePlaybackStates();
                    }
                });

                video.addEventListener('ended', () => {
                    flythroughInstance.state = 'stopped';
                    flythroughInstance.currentTime = flythroughInstance.totalDuration;
                    flythroughInstance.progress = 100;
                    this._updatePlaybackStates();
                    console.log('FlythroughPlaybackService: Video ended for', flythroughInstance.id);
                });

                video.addEventListener('error', (e) => {
                    console.error('FlythroughPlaybackService: Video error for', flythroughInstance.id, e);
                    flythroughInstance.state = 'stopped';
                    this._updatePlaybackStates();
                });

                flythroughInstance.videoElement = video;
                document.body.appendChild(video);

                console.log('FlythroughPlaybackService: Video element created for', flythroughInstance.id);
            }
        } catch (error) {
            console.error('FlythroughPlaybackService: Error creating video element:', error);
        }
    }

    /**
     * Play a flythrough (video + camera animation if available)
     */
    async playFlythrough(id, fromTime = 0) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.error('FlythroughPlaybackService: Flythrough not found for ID:', id);
            console.error('FlythroughPlaybackService: Available IDs:', Array.from(this.activeFlythroughs.keys()));
            return false;
        }

        console.log('FlythroughPlaybackService: Starting playback for:', id, 'from time:', fromTime);

        try {
            // Stop any currently playing flythrough
            this._stopAllFlythroughs();

            flythrough.state = 'playing';
            flythrough.currentTime = fromTime;
            flythrough.startTime = Date.now() - (fromTime * 1000);
            flythrough.pausedTime = 0;

            // Calculate progress based on fromTime
            flythrough.progress = flythrough.totalDuration > 0 
                ? (fromTime / flythrough.totalDuration) * 100 
                : 0;

            let videoPlaybackSuccess = false;

            // Play video if available
            if (flythrough.videoElement && flythrough.recordingBlob) {
                try {
                    flythrough.videoElement.currentTime = fromTime;
                    const playPromise = flythrough.videoElement.play();
                    
                    if (playPromise !== undefined) {
                        await playPromise;
                        videoPlaybackSuccess = true;
                        console.log('FlythroughPlaybackService: Video playback started for', id);
                    }
                } catch (videoError) {
                    console.warn('FlythroughPlaybackService: Video playback failed:', videoError);
                }
            }

            // Also play camera animation if available
            const coreManager = MapService.getCoreManager();
            if (coreManager && flythrough.path && flythrough.path.length >= 2) {
                try {
                    // Calculate starting position in path based on time
                    const startIndex = this._calculatePathIndexFromTime(flythrough, fromTime);
                    const pathSegment = flythrough.path.slice(startIndex);

                    if (pathSegment.length >= 2) {
                        flythrough.coreManager = coreManager;
                        flythrough.animationId = coreManager.createFlightAnimation(
                            pathSegment,
                            {
                                speed: flythrough.config.cameraSpeed || 10,
                                height: flythrough.config.cameraHeight || 20,
                                tilt: flythrough.config.cameraTilt || 45,
                                pauseBetweenPoints: flythrough.config.pauseBetweenPoints || 200,
                                enableSmoothing: true
                            },
                            // Progress callback - sync with video if available
                            (progress) => {
                                if (flythrough.state === 'playing') {
                                    if (!flythrough.videoElement) {
                                        // Update time based on animation if no video
                                        flythrough.currentTime = fromTime + progress.elapsedTime;
                                        flythrough.progress = flythrough.totalDuration > 0 
                                            ? (flythrough.currentTime / flythrough.totalDuration) * 100 
                                            : 0;
                                        this._updatePlaybackStates();
                                    }
                                }
                            },
                            // Completion callback
                            () => {
                                if (!flythrough.videoElement) {
                                    flythrough.state = 'stopped';
                                    flythrough.currentTime = flythrough.totalDuration;
                                    flythrough.progress = 100;
                                    flythrough.animationId = null;
                                    this._updatePlaybackStates();
                                    console.log('FlythroughPlaybackService: Camera animation completed for:', id);
                                }
                            }
                        );
                    }
                } catch (animationError) {
                    console.warn('FlythroughPlaybackService: Camera animation failed:', animationError);
                }
            }

            this._updatePlaybackStates();
            console.log('FlythroughPlaybackService: Started playback successfully for:', id);
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
     */
    pauseFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found for pause:', id);
            return false;
        }

        if (flythrough.state === 'playing') {
            flythrough.state = 'paused';
            flythrough.pausedTime = Date.now();
            
            // Pause video
            if (flythrough.videoElement) {
                flythrough.videoElement.pause();
            }

            // Cancel the camera animation
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
     */
    stopFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found for stop:', id);
            return false;
        }

        flythrough.state = 'stopped';
        flythrough.currentTime = 0;
        flythrough.progress = 0;
        flythrough.startTime = null;
        flythrough.pausedTime = 0;

        // Stop and reset video
        if (flythrough.videoElement) {
            flythrough.videoElement.pause();
            flythrough.videoElement.currentTime = 0;
        }

        // Cancel any active camera animation
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
     */
    seekFlythrough(id, percentage) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.warn('FlythroughPlaybackService: Flythrough not found for seek:', id);
            return false;
        }

        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        const seekTime = (clampedPercentage / 100) * flythrough.totalDuration;
        
        flythrough.progress = clampedPercentage;
        flythrough.currentTime = seekTime;

        // Seek video if available
        if (flythrough.videoElement) {
            flythrough.videoElement.currentTime = seekTime;
        }

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
     * Update flythrough with recording data
     */
    updateFlythroughRecording(id, recordingBlob, recordingInfo) {
        const flythrough = this.activeFlythroughs.get(id);
        if (flythrough) {
            flythrough.recordingBlob = recordingBlob;
            flythrough.recordingInfo = recordingInfo;
            
            // Create video element for playback
            this._createVideoElement(flythrough);
            
            this._updatePlaybackStates();
            console.log('FlythroughPlaybackService: Updated recording for flythrough:', id);
            return true;
        }
        console.warn('FlythroughPlaybackService: Could not update recording - flythrough not found:', id);
        return false;
    }

    /**
     * Get current progress for a flythrough
     */
    getProgress(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.progress : 0;
    }

    /**
     * Get current time for a flythrough
     */
    getCurrentTime(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.currentTime : 0;
    }

    /**
     * Get total duration for a flythrough
     */
    getTotalDuration(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.totalDuration : 0;
    }

    /**
     * Get current state for a flythrough
     */
    getState(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? flythrough.state : 'stopped';
    }

    /**
     * Check if flythrough has recording
     */
    hasRecording(id) {
        const flythrough = this.activeFlythroughs.get(id);
        return flythrough ? !!flythrough.recordingBlob : false;
    }

    /**
     * Remove a flythrough from tracking
     */
    unregisterFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (flythrough) {
            // Stop it first if playing
            this.stopFlythrough(id);
            
            // Clean up video element and blob URL
            if (flythrough.videoElement) {
                flythrough.videoElement.remove();
            }
            if (flythrough.recordingUrl) {
                URL.revokeObjectURL(flythrough.recordingUrl);
            }
            
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
                totalDuration: flythrough.totalDuration,
                hasRecording: !!flythrough.recordingBlob
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
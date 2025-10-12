// FlythroughPlaybackService.js - Optimized with clear separation

import { BehaviorSubject } from 'rxjs';
import { MapService } from './MapService.js';
import * as Cesium from 'cesium';

class FlythroughPlaybackServiceClass {
    constructor() {
        this.activeFlythroughs = new Map();
        this.playbackStates$ = new BehaviorSubject(new Map());
        console.log('FlythroughPlaybackService: Initialized');
    }

    /**
     * Calculate total duration for a flythrough path
     */
    calculateFlythroughDuration(path, config) {
        if (!path || path.length < 2) return 0;

        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
            totalDistance += Cesium.Cartesian3.distance(path[i-1], path[i]);
        }

        const speed = config.cameraSpeed || 10;
        const pauseTime = ((path.length - 1) * (config.pauseBetweenPoints || 200)) / 1000;
        
        return (totalDistance / speed) + pauseTime;
    }

    /**
     * Register a new flythrough
     */
    registerFlythrough(id, flythroughData) {
        console.log('FlythroughPlaybackService: Registering:', id);

        const flythroughInstance = {
            id: id,
            path: flythroughData.path || [],
            config: flythroughData.config || {},
            totalDuration: flythroughData.totalDuration || this.calculateFlythroughDuration(flythroughData.path, flythroughData.config),
            currentTime: 0,
            progress: 0,
            state: 'stopped',
            animationId: null,
            startTime: null,
            pausedTime: 0,
            recordingBlob: flythroughData.recordingBlob || null,
            recordingUrl: null,
            videoElement: null,
            coreManager: null,
        };

        if (flythroughInstance.recordingBlob) {
            this._createVideoElement(flythroughInstance);
        }

        this.activeFlythroughs.set(id, flythroughInstance);
        this._updatePlaybackStates();
        
        return flythroughInstance;
    }

    /**
     * Create video element for recorded flythrough
     */
    _createVideoElement(flythroughInstance) {
        try {
            if (!flythroughInstance.recordingBlob) return;

            flythroughInstance.recordingUrl = URL.createObjectURL(flythroughInstance.recordingBlob);
            
            const video = document.createElement('video');
            video.src = flythroughInstance.recordingUrl;
            video.style.display = 'none';
            video.preload = 'metadata';
            video.muted = true;

            video.addEventListener('loadedmetadata', () => {
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
            });

            video.addEventListener('error', (e) => {
                console.error('FlythroughPlaybackService: Video error:', e);
                flythroughInstance.state = 'stopped';
                this._updatePlaybackStates();
            });

            flythroughInstance.videoElement = video;
            document.body.appendChild(video);

        } catch (error) {
            console.error('FlythroughPlaybackService: Error creating video:', error);
        }
    }

    /**
     * Play a flythrough
     */
    async playFlythrough(id, fromTime = 0) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) {
            console.error('FlythroughPlaybackService: Flythrough not found:', id);
            return false;
        }

        try {
            this._stopAllFlythroughs();

            flythrough.state = 'playing';
            flythrough.currentTime = fromTime;
            flythrough.startTime = Date.now() - (fromTime * 1000);
            flythrough.pausedTime = 0;
            flythrough.progress = flythrough.totalDuration > 0 
                ? (fromTime / flythrough.totalDuration) * 100 
                : 0;

            // Play video if available
            if (flythrough.videoElement) {
                try {
                    flythrough.videoElement.currentTime = fromTime;
                    await flythrough.videoElement.play();
                } catch (videoError) {
                    console.warn('FlythroughPlaybackService: Video playback failed:', videoError);
                }
            }

            // Play camera animation if available
            const coreManager = MapService.getCoreManager();
            if (coreManager && flythrough.path && flythrough.path.length >= 2) {
                try {
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
                            (progress) => {
                                if (flythrough.state === 'playing' && !flythrough.videoElement) {
                                    flythrough.currentTime = fromTime + progress.elapsedTime;
                                    flythrough.progress = flythrough.totalDuration > 0 
                                        ? (flythrough.currentTime / flythrough.totalDuration) * 100 
                                        : 0;
                                    this._updatePlaybackStates();
                                }
                            },
                            () => {
                                if (!flythrough.videoElement) {
                                    flythrough.state = 'stopped';
                                    flythrough.currentTime = flythrough.totalDuration;
                                    flythrough.progress = 100;
                                    flythrough.animationId = null;
                                    this._updatePlaybackStates();
                                }
                            }
                        );
                    }
                } catch (animationError) {
                    console.warn('FlythroughPlaybackService: Animation failed:', animationError);
                }
            }

            this._updatePlaybackStates();
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
        if (!flythrough || flythrough.state !== 'playing') return false;

        flythrough.state = 'paused';
        flythrough.pausedTime = Date.now();
        
        if (flythrough.videoElement) {
            flythrough.videoElement.pause();
        }

        if (flythrough.animationId && flythrough.coreManager) {
            flythrough.coreManager.cancelFlightAnimation(flythrough.animationId);
            flythrough.animationId = null;
        }

        this._updatePlaybackStates();
        return true;
    }

    /**
     * Stop a flythrough
     */
    stopFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) return false;

        flythrough.state = 'stopped';
        flythrough.currentTime = 0;
        flythrough.progress = 0;
        flythrough.startTime = null;
        flythrough.pausedTime = 0;

        if (flythrough.videoElement) {
            flythrough.videoElement.pause();
            flythrough.videoElement.currentTime = 0;
        }

        if (flythrough.animationId && flythrough.coreManager) {
            flythrough.coreManager.cancelFlightAnimation(flythrough.animationId);
            flythrough.animationId = null;
        }

        this._updatePlaybackStates();
        return true;
    }

    /**
     * Seek to position
     */
    seekFlythrough(id, percentage) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) return false;

        const clampedPercentage = Math.max(0, Math.min(100, percentage));
        const seekTime = (clampedPercentage / 100) * flythrough.totalDuration;
        
        flythrough.progress = clampedPercentage;
        flythrough.currentTime = seekTime;

        if (flythrough.videoElement) {
            flythrough.videoElement.currentTime = seekTime;
        }

        if (flythrough.state === 'playing') {
            this.pauseFlythrough(id);
            setTimeout(() => this.playFlythrough(id, seekTime), 100);
        }

        this._updatePlaybackStates();
        return true;
    }

    /**
     * Update flythrough recording
     */
    updateFlythroughRecording(id, recordingBlob, recordingInfo) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) return false;

        flythrough.recordingBlob = recordingBlob;
        flythrough.recordingInfo = recordingInfo;
        this._createVideoElement(flythrough);
        this._updatePlaybackStates();
        
        return true;
    }

    /**
     * Getters
     */
    getProgress(id) {
        return this.activeFlythroughs.get(id)?.progress || 0;
    }

    getCurrentTime(id) {
        return this.activeFlythroughs.get(id)?.currentTime || 0;
    }

    getTotalDuration(id) {
        return this.activeFlythroughs.get(id)?.totalDuration || 0;
    }

    getState(id) {
        return this.activeFlythroughs.get(id)?.state || 'stopped';
    }

    hasRecording(id) {
        return !!(this.activeFlythroughs.get(id)?.recordingBlob);
    }

    getPlaybackStates() {
        return this.playbackStates$.getValue();
    }

    /**
     * Unregister flythrough
     */
    unregisterFlythrough(id) {
        const flythrough = this.activeFlythroughs.get(id);
        if (!flythrough) return false;

        this.stopFlythrough(id);
        
        if (flythrough.videoElement) {
            flythrough.videoElement.remove();
        }
        if (flythrough.recordingUrl) {
            URL.revokeObjectURL(flythrough.recordingUrl);
        }
        
        this.activeFlythroughs.delete(id);
        this._updatePlaybackStates();
        
        return true;
    }

    // Private methods

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

    _stopAllFlythroughs() {
        this.activeFlythroughs.forEach((flythrough, id) => {
            if (flythrough.state === 'playing') {
                this.pauseFlythrough(id);
            }
        });
    }

    _calculatePathIndexFromTime(flythrough, time) {
        if (!flythrough.path || flythrough.path.length === 0 || flythrough.totalDuration === 0) return 0;

        const percentage = time / flythrough.totalDuration;
        const index = Math.floor(percentage * (flythrough.path.length - 1));
        return Math.max(0, Math.min(flythrough.path.length - 1, index));
    }
}

export const FlythroughPlaybackService = new FlythroughPlaybackServiceClass();
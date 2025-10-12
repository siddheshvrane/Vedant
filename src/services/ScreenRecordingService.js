// ScreenRecordingService.js - Pure RxJS Communication Layer
// This service ONLY manages state communication between components
// All business logic is in ScreenRecordingHelper.js and RecordingHandler

import { BehaviorSubject } from 'rxjs';

class ScreenRecordingServiceClass {
    constructor() {
        // State observables - ONLY for communication
        this.isRecording$ = new BehaviorSubject(false);
        this.recordingProgress$ = new BehaviorSubject({ duration: 0, size: 0 });
        this.availableAudioDevices$ = new BehaviorSubject([]);
        this.recordingConfig$ = new BehaviorSubject({
            audioSource: 'none',
            videoFormat: 'webm',
            frameRate: 30,
            videoWidth: 1920,
            videoHeight: 1080,
        });
        this.recordingStatus$ = new BehaviorSubject({
            isRecording: false,
            canRecord: false,
            environment: null
        });

        console.log('ScreenRecordingService: RxJS communication layer initialized');
    }

    // State update methods - ONLY update observables
    updateRecordingState(isRecording) {
        this.isRecording$.next(isRecording);
    }

    updateRecordingProgress(progress) {
        this.recordingProgress$.next(progress);
    }

    updateAvailableDevices(devices) {
        this.availableAudioDevices$.next(devices);
    }

    updateRecordingConfig(config) {
        const currentConfig = this.recordingConfig$.getValue();
        this.recordingConfig$.next({ ...currentConfig, ...config });
    }

    updateRecordingStatus(status) {
        this.recordingStatus$.next(status);
    }

    // Getters - ONLY return current state
    getRecordingState() {
        return this.isRecording$.getValue();
    }

    getRecordingProgress() {
        return this.recordingProgress$.getValue();
    }

    getAvailableDevices() {
        return this.availableAudioDevices$.getValue();
    }

    getRecordingConfig() {
        return this.recordingConfig$.getValue();
    }

    getRecordingStatus() {
        return this.recordingStatus$.getValue();
    }

    // Reset state
    resetState() {
        this.isRecording$.next(false);
        this.recordingProgress$.next({ duration: 0, size: 0 });
        this.updateRecordingConfig({
            audioSource: 'none',
            videoFormat: 'webm',
            frameRate: 30,
            videoWidth: 1920,
            videoHeight: 1080,
        });
    }
}

// Singleton export
export const ScreenRecordingService = new ScreenRecordingServiceClass();
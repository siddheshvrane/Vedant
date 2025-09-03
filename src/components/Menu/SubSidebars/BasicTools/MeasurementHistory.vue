<template>
  <div class="measurement-history poppins-font mt-3">
    <h5 class="history-title">Measurement History</h5>
    <ul class="list-unstyled history-list">
      <li v-if="measurements.length === 0" class="text-center text-muted no-measurements">
        No measurements yet.
      </li>
      <li
        v-for="measurement in measurements"
        :key="measurement.id"
        class="history-item d-flex align-items-center p-2 mb-2 rounded"
        :class="{ 'flythrough-item': measurement.toolName === 'Flythrough Tool' }"
      >
        <!-- Regular measurement item -->
        <div 
          v-if="measurement.toolName !== 'Flythrough Tool'"
          class="measurement-info d-flex flex-column flex-grow-1 me-2"
        >
          <span class="tool-operation-title">
            {{ measurement.toolName }} #{{ measurement.operationNumber }}
          </span>
          <span class="measurement-value mt-1">{{ measurement.value }}</span>
        </div>

        <!-- Flythrough measurement item -->
        <div 
          v-else
          class="flythrough-container w-100"
        >
          <!-- Flythrough Header -->
          <div class="flythrough-header d-flex align-items-center justify-content-between mb-2">
            <span class="flythrough-title">
              {{ measurement.toolName }} #{{ measurement.operationNumber }}
            </span>
            <div class="flythrough-controls d-flex align-items-center">
              <!-- Recording indicator -->
              <span v-if="hasRecording(measurement)" class="recording-indicator me-2" title="Has Recording">
                <i class="fas fa-video text-success"></i>
              </span>
              
              <button
                @click="toggleFlythroughPlayback(measurement)"
                class="btn btn-sm flythrough-control-btn me-2"
                :title="getFlythroughState(measurement) === 'playing' ? 'Pause Flythrough' : 'Play Flythrough'"
                :disabled="!hasValidFlythroughData(measurement)"
              >
                <i :class="getFlythroughState(measurement) === 'playing' ? 'fas fa-pause' : 'fas fa-play'"></i>
              </button>
              
              <button
                @click="stopFlythrough(measurement)"
                class="btn btn-sm flythrough-control-btn me-2"
                :title="'Stop Flythrough'"
                :disabled="getFlythroughState(measurement) === 'stopped'"
              >
                <i class="fas fa-stop"></i>
              </button>
              
              <button
                @click="downloadFlythrough(measurement)"
                class="btn btn-sm flythrough-control-btn me-2"
                title="Download Recording"
                :disabled="!hasRecording(measurement)"
              >
                <i class="fas fa-download" :class="{ 'disabled-icon': !hasRecording(measurement) }"></i>
              </button>
            </div>
          </div>

          <!-- Timeline Player -->
          <div class="timeline-container mb-2">
            <div class="timeline-wrapper">
              <div class="timeline-track" @click="seekFlythrough($event, measurement)">
                <div 
                  class="timeline-progress"
                  :style="{ width: getFlythroughProgress(measurement) + '%' }"
                ></div>
                <div 
                  class="timeline-handle"
                  :style="{ left: getFlythroughProgress(measurement) + '%' }"
                  @mousedown="startDragging($event, measurement)"
                ></div>
              </div>
            </div>
            <div class="timeline-info d-flex justify-content-between mt-1">
              <span class="timeline-time">{{ formatTime(getCurrentTime(measurement)) }}</span>
              <span class="timeline-duration">{{ formatTime(getTotalDuration(measurement)) }}</span>
            </div>
          </div>

          <!-- Flythrough Details -->
          <div class="flythrough-details">
            <small class="text-muted">
              {{ measurement.value }}
              <span v-if="hasRecording(measurement)" class="recording-info ms-2">
                • <i class="fas fa-video"></i> Recording Available
              </span>
            </small>
          </div>

          <!-- Video element (hidden) -->
          <video
            v-if="hasRecording(measurement) && getVideoUrl(measurement)"
            :ref="`video-${measurement.id}`"
            :src="getVideoUrl(measurement)"
            style="display: none"
            preload="metadata"
            @loadedmetadata="onVideoLoaded(measurement)"
            @timeupdate="onVideoTimeUpdate(measurement)"
            @ended="onVideoEnded(measurement)"
            @error="onVideoError(measurement)"
          ></video>
        </div>

        <!-- Action buttons for non-flythrough items -->
        <div 
          v-if="measurement.toolName !== 'Flythrough Tool'"
          class="measurement-actions d-flex align-items-center"
        >
          <button
            @click="toggleEnabled(measurement.id)"
            class="btn btn-sm action-btn me-2"
            :title="measurement.isEnabled ? 'Hide on Globe' : 'Show on Globe'"
          >
            <i :class="measurement.isEnabled ? 'fas fa-eye' : 'fas fa-eye-slash'"
               :style="{ color: measurement.isEnabled ? 'white' : 'white' }"
            ></i>
          </button>

          <button
            @click="deleteMeasurement(measurement.id)"
            class="btn btn-sm action-btn delete-btn"
            title="Delete Measurement"
          >
            <i class="fas fa-trash" style="color: #FF6600;"></i>
          </button>
        </div>

        <!-- Delete button for flythrough items -->
        <div 
          v-else
          class="flythrough-actions"
        >
          <button
            @click="deleteMeasurement(measurement.id)"
            class="btn btn-sm action-btn delete-btn"
            title="Delete Flythrough"
          >
            <i class="fas fa-trash" style="color: #FF6600;"></i>
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script>
import { ToolManagementService } from '../../../../services/ToolManagementService';
import { PopupService } from '../../../../services/PopupService';
import { FlythroughPlaybackService } from '../../../../services/FlythroughPlaybackService';

export default {
  name: 'MeasurementHistory',
  data() {
    return {
      measurements: [],
      historySubscription: null,
      playbackStates: new Map(),
      playbackSubscription: null,
      videoUrls: new Map(),
      isDragging: false,
      currentDragMeasurement: null,
    };
  },
  mounted() {
    console.log('MeasurementHistory: Component mounted');
    
    // Subscribe to measurement history changes
    this.historySubscription = ToolManagementService.measurementHistory$.subscribe(history => {
      console.log('MeasurementHistory: Received updated history:', history.length, 'measurements');
      this.measurements = history;
      
      // Register flythroughs that aren't already registered
      history.forEach(measurement => {
        if (measurement.toolName === 'Flythrough Tool') {
          console.log('MeasurementHistory: Processing flythrough measurement:', measurement.id);
          this.ensureFlythroughRegistered(measurement);
        }
      });
    });

    // Subscribe to playback state changes
    this.playbackSubscription = FlythroughPlaybackService.playbackStates$.subscribe(states => {
      console.log('MeasurementHistory: Playback states updated:', states.size, 'flythroughs');
      this.playbackStates = new Map(states);
      this.$forceUpdate();
    });

    // Add mouse event listeners for dragging
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);

    // Process any existing measurements on mount
    const existingMeasurements = ToolManagementService.measurementHistory$.getValue();
    if (existingMeasurements.length > 0) {
      console.log('MeasurementHistory: Processing', existingMeasurements.length, 'existing measurements on mount');
      existingMeasurements.forEach(measurement => {
        if (measurement.toolName === 'Flythrough Tool') {
          this.ensureFlythroughRegistered(measurement);
        }
      });
    }
  },
  beforeUnmount() {
    if (this.historySubscription) {
      this.historySubscription.unsubscribe();
    }
    
    if (this.playbackSubscription) {
      this.playbackSubscription.unsubscribe();
    }
    
    // Remove event listeners
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    
    // Clean up video URLs
    this.videoUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.videoUrls.clear();
  },
  methods: {
    toggleEnabled(id) {
      ToolManagementService.toggleMeasurementEnabled(id);
    },
    
    async deleteMeasurement(id) {
      try {
        const confirmed = await PopupService.showConfirmation(
          'Are you sure you want to delete this measurement? This action cannot be undone.',
          'Delete Measurement',
          'Delete',
          'Cancel'
        );

        if (confirmed) {
          const measurement = this.measurements.find(m => m.id === id);
          
          if (measurement && measurement.toolName === 'Flythrough Tool') {
            this.stopFlythrough(measurement);
            
            // Use the flythrough ID for cleanup - try multiple approaches
            const flythroughId = this.getFlythroughId(measurement);
            if (flythroughId) {
              FlythroughPlaybackService.unregisterFlythrough(flythroughId);
              console.log('MeasurementHistory: Unregistered flythrough:', flythroughId);
            }
          }
          
          // Clean up video URL
          if (this.videoUrls.has(id)) {
            URL.revokeObjectURL(this.videoUrls.get(id));
            this.videoUrls.delete(id);
          }
          
          ToolManagementService.removeMeasurement(id);
        }
      } catch (error) {
        console.error("MeasurementHistory: Confirmation dialog error:", error);
      }
    },

    // Helper to get flythrough ID from measurement - handles both structures
    getFlythroughId(measurement) {
      // Try entities first (new structure)
      if (measurement.entities && measurement.entities.flythroughId) {
        return measurement.entities.flythroughId;
      }
      
      // Try cesiumEntities (old structure)
      if (measurement.cesiumEntities && measurement.cesiumEntities.flythroughId) {
        return measurement.cesiumEntities.flythroughId;
      }
      
      // Fall back to measurement ID
      return measurement.id;
    },

    // Get entities from measurement - handles both structures
    getEntities(measurement) {
      return measurement.entities || measurement.cesiumEntities || {};
    },

    // Flythrough registration
    ensureFlythroughRegistered(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      const entities = this.getEntities(measurement);
      
      console.log('MeasurementHistory: Ensuring flythrough registered:', {
        measurementId: measurement.id,
        flythroughId: flythroughId,
        hasEntities: !!entities,
        hasSampledPositions: !!entities.sampledPositions
      });

      if (!entities.sampledPositions || !Array.isArray(entities.sampledPositions)) {
        console.warn('MeasurementHistory: Invalid or missing sampledPositions for flythrough:', measurement.id);
        return;
      }

      // Check if already registered
      if (FlythroughPlaybackService.activeFlythroughs.has(flythroughId)) {
        console.log('MeasurementHistory: Flythrough already registered:', flythroughId);
        
        // Update with recording blob if it wasn't there before
        if (entities.recordingBlob && !FlythroughPlaybackService.hasRecording(flythroughId)) {
          FlythroughPlaybackService.updateFlythroughRecording(
            flythroughId,
            entities.recordingBlob,
            entities.recordingInfo
          );
        }
        return;
      }

      // Register the flythrough
      console.log('MeasurementHistory: Registering new flythrough:', flythroughId);
      try {
        const registrationData = {
          path: entities.sampledPositions || [],
          config: entities.config || {},
          totalDuration: entities.totalDuration || 0,
          recordingBlob: entities.recordingBlob || null,
          recordingInfo: entities.recordingInfo || null
        };
        
        FlythroughPlaybackService.registerFlythrough(flythroughId, registrationData);

        // Create video URL if recording exists
        if (entities.recordingBlob) {
          this.createVideoUrl(measurement);
        }
        
        console.log('MeasurementHistory: Successfully registered flythrough:', flythroughId);
      } catch (error) {
        console.error('MeasurementHistory: Failed to register flythrough:', flythroughId, error);
      }
    },

    createVideoUrl(measurement) {
      const entities = this.getEntities(measurement);
      if (entities.recordingBlob && !this.videoUrls.has(measurement.id)) {
        try {
          const url = URL.createObjectURL(entities.recordingBlob);
          this.videoUrls.set(measurement.id, url);
          console.log('MeasurementHistory: Created video URL for measurement:', measurement.id);
        } catch (error) {
          console.error('MeasurementHistory: Error creating video URL:', error);
        }
      }
    },

    getVideoUrl(measurement) {
      return this.videoUrls.get(measurement.id) || null;
    },

    hasRecording(measurement) {
      if (measurement.toolName !== 'Flythrough Tool') return false;
      
      const entities = this.getEntities(measurement);
      const hasBlob = !!entities.recordingBlob;
      const flythroughId = this.getFlythroughId(measurement);
      const hasPlaybackRecording = FlythroughPlaybackService.hasRecording(flythroughId);
      
      return hasBlob || hasPlaybackRecording;
    },

    hasValidFlythroughData(measurement) {
      if (measurement.toolName !== 'Flythrough Tool') return false;
      
      const entities = this.getEntities(measurement);
      return !!(entities.sampledPositions && entities.sampledPositions.length >= 2);
    },

    formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    toggleFlythroughPlayback(measurement) {
      const currentState = this.getFlythroughState(measurement);
      
      if (currentState === 'playing') {
        this.pauseFlythrough(measurement);
      } else {
        this.playFlythrough(measurement);
      }
    },

    playFlythrough(measurement) {
      console.log('MeasurementHistory: playFlythrough called for measurement:', measurement.id);
      
      const flythroughId = this.getFlythroughId(measurement);
      
      // Ensure flythrough is registered before playing
      if (!FlythroughPlaybackService.activeFlythroughs.has(flythroughId)) {
        console.log('MeasurementHistory: Flythrough not registered, ensuring registration...');
        this.ensureFlythroughRegistered(measurement);
      }

      // Check again after registration attempt
      if (!FlythroughPlaybackService.activeFlythroughs.has(flythroughId)) {
        console.error('MeasurementHistory: Failed to register flythrough for playback');
        PopupService.showNotification('Cannot play flythrough: Registration failed', true);
        return;
      }

      const currentTime = this.getCurrentTime(measurement);
      const success = FlythroughPlaybackService.playFlythrough(flythroughId, currentTime);
      
      if (!success) {
        PopupService.showNotification('Failed to start flythrough playback', true);
      } else {
        PopupService.showNotification('Flythrough playback started', false);
      }
    },

    pauseFlythrough(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      FlythroughPlaybackService.pauseFlythrough(flythroughId);
    },

    stopFlythrough(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      FlythroughPlaybackService.stopFlythrough(flythroughId);
    },

    downloadFlythrough(measurement) {
      if (!this.hasRecording(measurement)) {
        PopupService.showNotification('No recording available for this flythrough', true);
        return;
      }

      try {
        const entities = this.getEntities(measurement);
        const recordingBlob = entities.recordingBlob;
        if (!recordingBlob) {
          throw new Error('Recording blob not found');
        }

        console.log('MeasurementHistory: Downloading flythrough recording:', measurement.id);
        
        const url = URL.createObjectURL(recordingBlob);
        const link = document.createElement('a');
        link.href = url;
        
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `flythrough-${measurement.operationNumber}-${timestamp}.webm`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        PopupService.showNotification('Flythrough recording downloaded', false);
      } catch (error) {
        console.error('MeasurementHistory: Download failed:', error);
        PopupService.showNotification(`Download failed: ${error.message}`, true);
      }
    },

    seekFlythrough(event, measurement) {
      const rect = event.currentTarget.getBoundingClientRect();
      const percentage = ((event.clientX - rect.left) / rect.width) * 100;
      const clampedPercentage = Math.max(0, Math.min(100, percentage));
      
      const flythroughId = this.getFlythroughId(measurement);
      console.log('MeasurementHistory: Seeking flythrough to:', clampedPercentage + '%');
      FlythroughPlaybackService.seekFlythrough(flythroughId, clampedPercentage);
    },

    startDragging(event, measurement) {
      this.isDragging = true;
      this.currentDragMeasurement = measurement;
      event.preventDefault();
    },

    handleMouseMove(event) {
      if (!this.isDragging || !this.currentDragMeasurement) return;

      const timelineTrack = event.target.closest('.timeline-container')?.querySelector('.timeline-track');
      if (!timelineTrack) return;

      const rect = timelineTrack.getBoundingClientRect();
      const percentage = ((event.clientX - rect.left) / rect.width) * 100;
      const clampedPercentage = Math.max(0, Math.min(100, percentage));
      
      const flythroughId = this.getFlythroughId(this.currentDragMeasurement);
      FlythroughPlaybackService.seekFlythrough(flythroughId, clampedPercentage);
    },

    handleMouseUp() {
      this.isDragging = false;
      this.currentDragMeasurement = null;
    },

    // Video event handlers
    onVideoLoaded(measurement) {
      console.log('MeasurementHistory: Video loaded for measurement:', measurement.id);
    },

    onVideoTimeUpdate(measurement) {
      // Video time updates are handled by FlythroughPlaybackService
    },

    onVideoEnded(measurement) {
      console.log('MeasurementHistory: Video ended for measurement:', measurement.id);
    },

    onVideoError(measurement, error) {
      console.error('MeasurementHistory: Video error for measurement:', measurement.id, error);
      PopupService.showNotification('Video playback error occurred', true);
    },

    // Helper methods for flythrough state
    getFlythroughState(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      return FlythroughPlaybackService.getState(flythroughId);
    },

    getFlythroughProgress(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      return FlythroughPlaybackService.getProgress(flythroughId);
    },

    getCurrentTime(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      return FlythroughPlaybackService.getCurrentTime(flythroughId);
    },

    getTotalDuration(measurement) {
      const flythroughId = this.getFlythroughId(measurement);
      return FlythroughPlaybackService.getTotalDuration(flythroughId);
    },
  },
};
</script>

<style scoped>
.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.measurement-history {
  background-color: transparent;
  color: white;
  padding: 0;
  border-radius: 10px;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.history-title {
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 10px;
  color: #007bff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding-bottom: 8px;
  text-align: left;
}

.history-list {
  overflow-y: auto;
  padding-right: 5px;
  flex-grow: 1;
}

.history-list::-webkit-scrollbar {
  width: 8px;
}

.history-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.history-list::-webkit-scrollbar-thumb {
  background-color: rgba(0, 123, 255, 0.5);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-list::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 123, 255, 0.7);
}

.no-measurements {
  padding: 10px;
  font-style: italic;
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9em;
}

.history-item {
  background-color: rgba(45, 45, 45, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
  min-height: 60px;
}

.history-item:hover {
  background-color: rgba(60, 60, 60, 0.9);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* Special styling for flythrough items */
.flythrough-item {
  min-height: auto;
  padding: 15px !important;
  background: linear-gradient(135deg, rgba(0, 123, 255, 0.1), rgba(45, 45, 45, 0.9));
  border: 1px solid rgba(0, 123, 255, 0.3);
}

.flythrough-item:hover {
  background: linear-gradient(135deg, rgba(0, 123, 255, 0.2), rgba(60, 60, 60, 0.9));
  border-color: rgba(0, 123, 255, 0.5);
}

.flythrough-container {
  width: 100%;
}

.flythrough-header {
  margin-bottom: 10px;
}

.flythrough-title {
  font-weight: 600;
  color: #007bff;
  font-size: 1em;
}

.flythrough-controls {
  gap: 5px;
}

.flythrough-control-btn {
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  color: white;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
  font-size: 0.9em;
}

.flythrough-control-btn:hover {
  background: rgba(0, 123, 255, 0.4);
  border-color: rgba(0, 123, 255, 0.6);
  transform: scale(1.05);
}

.flythrough-control-btn:disabled {
  background: rgba(100, 100, 100, 0.2);
  border-color: rgba(100, 100, 100, 0.3);
  cursor: not-allowed;
}

.flythrough-control-btn:disabled:hover {
  transform: none;
}

.disabled-icon {
  opacity: 0.5;
}

/* Timeline Styles */
.timeline-container {
  margin: 10px 0;
}

.timeline-wrapper {
  padding: 5px 0;
}

.timeline-track {
  height: 6px;
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  position: relative;
  cursor: pointer;
  transition: height 0.2s ease;
}

.timeline-track:hover {
  height: 8px;
}

.timeline-progress {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #00d4ff);
  border-radius: 3px;
  transition: width 0.1s ease;
  position: relative;
}

.timeline-handle {
  position: absolute;
  top: 50%;
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid #007bff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  cursor: grab;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.timeline-handle:hover {
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: 0 3px 10px rgba(0, 123, 255, 0.4);
}

.timeline-handle:active {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.1);
}

.timeline-info {
  font-size: 0.75em;
  color: rgba(255, 255, 255, 0.7);
}

.timeline-time {
  color: #007bff;
  font-weight: 500;
}

.timeline-duration {
  color: rgba(255, 255, 255, 0.6);
}

.flythrough-details {
  margin-top: 8px;
  font-size: 0.85em;
}

.flythrough-actions {
  position: absolute;
  top: 15px;
  right: 15px;
}

/* Regular measurement styles */
.measurement-info {
  flex-grow: 1;
  justify-content: center;
}

.tool-operation-title {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95em;
}

.measurement-value {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.85em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.action-btn {
  background: none;
  border: none;
  font-size: 1.2em;
  padding: 5px 8px;
  cursor: pointer;
  transition: transform 0.1s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  transform: scale(1.1);
}

.action-btn i {
  transition: color 0.2s ease;
}

.action-btn:hover i {
  color: #007bff !important;
}

.delete-btn:hover i {
  color: #FF9933 !important;
}
</style>
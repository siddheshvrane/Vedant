<template>
  <div class="recording-config-content">
    <div class="config-sections">
      <div v-if="!isRecordingSupported" class="config-section warning-section">
        <div class="section-header">
          <i class="fas fa-exclamation-triangle section-icon warning-icon"></i>
          <h3>Recording Not Available</h3>
        </div>
        <div class="section-content">
          <div class="warning-message">
            <div class="warning-content">
              <strong v-if="isHttpContext">HTTPS Required for Screen Recording</strong>
              <strong v-else>Screen Recording Not Supported</strong>
              <p v-if="isHttpContext">
                Your application is running on HTTP. Modern browsers require HTTPS for screen recording security.
              </p>
              <p v-else>
                Screen recording is not available in this browser or environment.
              </p>
              
              <div v-if="isHttpContext" class="solution-list">
                <p><strong>Solutions:</strong></p>
                <ul>
                  <li>Enable HTTPS on your server</li>
                  <li>Access via localhost or 127.0.0.1</li>
                  <li>Use the desktop application</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="config-section">
        <div class="section-header">
          <i class="fas fa-microphone section-icon"></i>
          <h3>Recording Settings</h3>
        </div>
        <div class="section-content">
          <div class="form-group">
            <label>Choose Recording Option:</label>
            <select v-model="config.audioSource" @change="onAudioSourceChange" class="form-select">
              <option value="skip">Skip Recording (Flythrough Only)</option>
              <option v-if="isRecordingSupported" value="none">Record Video Only (No Audio)</option>
              <option 
                v-for="device in availableAudioDevices" 
                :key="device.id" 
                :value="device.id"
                :disabled="!isRecordingSupported || device.disabled"
              >
                {{ device.label }}
                {{ device.disabled ? ' (Not Available)' : '' }}
              </option>
            </select>
            <small class="form-help">
              {{ getHelpText() }}
            </small>
          </div>
          
          <div v-if="showAudioTest" class="audio-preview">
            <div class="audio-level-container">
              <label>Audio Level Test:</label>
              <div class="audio-level-meter">
                <div 
                  class="audio-level-bar"
                  :style="{ width: audioLevel + '%' }"
                  :class="{
                    'level-low': audioLevel < 30,
                    'level-medium': audioLevel >= 30 && audioLevel < 70,
                    'level-high': audioLevel >= 70
                  }"
                ></div>
              </div>
              <span class="audio-level-text">{{ audioLevel.toFixed(0) }}%</span>
            </div>
            <button @click="testAudio" class="test-button" :disabled="isTestingAudio">
              <i :class="isTestingAudio ? 'fas fa-spinner fa-spin' : 'fas fa-volume-up'"></i>
              {{ isTestingAudio ? 'Testing...' : 'Test Audio' }}
            </button>
          </div>

          <div v-if="config.audioSource === 'skip'" class="info-message">
            <i class="fas fa-info-circle"></i>
            <span>Only flythrough animation will run. No screen recording will be performed.</span>
          </div>
        </div>
      </div>

      <div class="config-section">
        <div class="section-header">
          <i class="fas fa-info-circle section-icon"></i>
          <h3>Recording Info</h3>
        </div>
        <div class="section-content">
          <div class="recording-info">
            <div class="info-row">
              <span class="info-label">Quality:</span>
              <span class="info-value">1080p @ 30fps</span>
            </div>
            <div class="info-row">
              <span class="info-label">Format:</span>
              <span class="info-value">WebM/MP4</span>
            </div>
            <div class="info-row">
              <span class="info-label">Audio:</span>
              <span class="info-value">{{ getAudioDescription() }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="info-value" :class="getStatusClass()">{{ getStatusText() }}</span>
            </div>
            <div v-if="environmentInfo && environmentInfo.hostname" class="info-row">
              <span class="info-label">Context:</span>
              <span class="info-value">{{ getProtocolText() }} on {{ environmentInfo.hostname }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="config-actions">
      <button @click="cancel" class="action-button cancel-button">
        <i class="fas fa-times"></i>
        Cancel
      </button>
      <button 
        @click="startRecording" 
        class="action-button start-button" 
        :disabled="!canStartRecording"
      >
        <i class="fas fa-play"></i>
        {{ getStartButtonText() }}
      </button>
    </div>
  </div>
</template>

<script>
import { ScreenRecordingService } from '../../../services/ScreenRecordingService';

export default {
  name: 'RecordingConfigPopup',
  props: {
    audioDevices: {
      type: Array,
      default: () => []
    },
    currentConfig: {
      type: Object,
      default: () => ({})
    },
    onStart: {
      type: Function,
      required: true
    },
    onCancel: {
      type: Function,
      default: () => {
        console.log('RecordingConfigPopup: Default onCancel called');
      }
    }
  },
  data() {
    return {
      config: {
        audioSource: 'skip'
      },
      audioLevel: 0,
      isTestingAudio: false,
      audioTestStream: null,
      audioContext: null,
      isRecordingSupported: false,
      environmentInfo: null
    };
  },
  async mounted() {
    try {
      // Initialize configuration
      this.config = { ...this.config, ...this.currentConfig };
      
      // Check recording support and get environment info
      this.checkRecordingSupport();
      
      // Set appropriate default based on support
      if (!this.isRecordingSupported) {
        this.config.audioSource = 'skip';
      } else if (!this.config.audioSource && this.audioDevices.length > 0) {
        this.config.audioSource = 'none'; // Video only as safe default
      }
    } catch (error) {
      console.error('RecordingConfigPopup: Error during component mount:', error);
      // Set safe defaults
      this.isRecordingSupported = false;
      this.config.audioSource = 'skip';
    }
  },
  beforeUnmount() {
    this.stopAudioTest();
  },
  computed: {
    canStartRecording() {
      return true; // Always allow - we handle the logic in the tool
    },

    availableAudioDevices() {
      if (!Array.isArray(this.audioDevices)) {
        return [];
      }
      return this.audioDevices.filter(device => 
        device && !device.disabled
      );
    },

    showAudioTest() {
      return this.isRecordingSupported && 
            this.config.audioSource !== 'skip' && 
            this.config.audioSource !== 'none' &&
            this.config.audioSource;
    },

    isHttpContext() {
      return this.environmentInfo && 
            this.environmentInfo.protocol === 'http:' && 
            this.environmentInfo.hostname !== 'localhost' && 
            this.environmentInfo.hostname !== '127.0.0.1';
    }
  },
  methods: {
    checkRecordingSupport() {
      try {
        this.isRecordingSupported = ScreenRecordingService.constructor.isSupported();
        this.environmentInfo = ScreenRecordingService.constructor.getEnvironmentInfo();
        
        console.log('RecordingConfigPopup: Support check:', {
          supported: this.isRecordingSupported,
          environment: this.environmentInfo
        });
      } catch (error) {
        console.error('RecordingConfigPopup: Error checking recording support:', error);
        this.isRecordingSupported = false;
        this.environmentInfo = {
          protocol: window.location.protocol || 'unknown:',
          hostname: window.location.hostname || 'unknown'
        };
      }
    },

    getProtocolText() {
      if (!this.environmentInfo || !this.environmentInfo.protocol) {
        return 'Unknown';
      }
      
      try {
        // Safe string conversion and uppercase
        const protocol = String(this.environmentInfo.protocol || '');
        return protocol.toUpperCase();
      } catch (error) {
        console.error('RecordingConfigPopup: Error getting protocol text:', error);
        return 'Unknown';
      }
    },

    getHelpText() {
      if (!this.isRecordingSupported) {
        if (this.isHttpContext) {
          return 'Screen recording requires HTTPS. Only flythrough animation is available.';
        }
        return 'Screen recording not supported in this browser. Only flythrough animation is available.';
      }
      
      if (this.config.audioSource === 'skip') {
        return 'No recording will be performed. Flythrough animation only.';
      } else if (this.config.audioSource === 'none') {
        return 'Video recording without audio (safest option).';
      } else {
        return 'Video recording with selected microphone audio.';
      }
    },

    onAudioSourceChange() {
      this.stopAudioTest();
      if (this.showAudioTest) {
        // Auto-test audio after a brief delay
        setTimeout(() => {
          if (this.showAudioTest) {
            this.testAudio();
          }
        }, 500);
      }
    },

    async testAudio() {
      if (this.isTestingAudio || !this.showAudioTest) return;

      this.stopAudioTest();
      this.isTestingAudio = true;

      try {
        const constraints = {
          audio: {
            deviceId: this.config.audioSource === 'default' 
              ? undefined 
              : { exact: this.config.audioSource },
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        };

        this.audioTestStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const source = this.audioContext.createMediaStreamSource(this.audioTestStream);
        const analyser = this.audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevel = () => {
          if (!this.isTestingAudio) return;
          
          analyser.getByteFrequencyData(dataArray);
          
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i] * dataArray[i];
          }
          const rms = Math.sqrt(sum / bufferLength);
          this.audioLevel = Math.min(100, (rms / 255) * 100 * 2);
          
          requestAnimationFrame(updateLevel);
        };

        updateLevel();

        // Auto-stop test after 5 seconds
        setTimeout(() => {
          this.stopAudioTest();
        }, 5000);

      } catch (error) {
        console.error('Audio test failed:', error);
        this.audioLevel = 0;
        this.isTestingAudio = false;
        
        let errorMessage = 'Audio test failed: ';
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Microphone permission denied';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'Audio device not found';
        } else {
          errorMessage += 'Unknown error occurred';
        }
        
        this.$emit('audio-test-error', errorMessage);
      }
    },

    stopAudioTest() {
      this.isTestingAudio = false;
      this.audioLevel = 0;

      if (this.audioTestStream) {
        this.audioTestStream.getTracks().forEach(track => {
          track.stop();
        });
        this.audioTestStream = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close().catch(err => {
          console.warn('Error closing audio context:', err);
        });
        this.audioContext = null;
      }
    },

    getAudioDescription() {
      if (this.config.audioSource === 'skip') {
        return 'No recording (flythrough only)';
      } else if (this.config.audioSource === 'none') {
        return 'Video only (no audio)';
      }
      
      const device = this.audioDevices.find(d => d && d.id === this.config.audioSource);
      const deviceName = (device && device.label) ? device.label : 'Unknown device';
      return `${deviceName} (128 kbps)`;
    },

    getStatusText() {
      if (this.config.audioSource === 'skip') {
        return 'Flythrough Only';
      } else if (!this.isRecordingSupported) {
        return 'Recording Not Available';
      } else {
        return 'Ready to Record';
      }
    },

    getStatusClass() {
      if (this.config.audioSource === 'skip') {
        return 'status-disabled';
      } else if (!this.isRecordingSupported) {
        return 'status-error';
      } else {
        return 'status-ready';
      }
    },

    getStartButtonText() {
      if (this.config.audioSource === 'skip') {
        return 'Start Flythrough Only';
      } else if (!this.isRecordingSupported) {
        return 'Start (Recording Not Available)';
      } else {
        return 'Start Recording & Flythrough';
      }
    },

    startRecording() {
      this.stopAudioTest();
      
      const finalConfig = {
        audioSource: this.config.audioSource,
        recordingEnabled: this.config.audioSource !== 'skip' && this.isRecordingSupported
      };

      console.log('RecordingConfigPopup: Starting with config:', finalConfig);
      
      try {
        if (typeof this.onStart === 'function') {
          this.onStart(finalConfig);
        } else {
          console.error('RecordingConfigPopup: onStart is not a function');
        }
      } catch (error) {
        console.error('RecordingConfigPopup: Error calling onStart:', error);
      }
    },

    cancel() {
      this.stopAudioTest();
      
      try {
        if (typeof this.onCancel === 'function') {
          this.onCancel();
        } else {
          console.warn('RecordingConfigPopup: onCancel is not a function');
        }
      } catch (error) {
        console.error('RecordingConfigPopup: Error calling onCancel:', error);
      }
    }
  }
};
</script>

<style scoped>
.recording-config-content {
  width: 100%;
  max-width: 520px;
  color: white;
}

.config-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

.config-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 16px;
  backdrop-filter: blur(10px);
}

.warning-section {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.section-icon {
  font-size: 16px;
  margin-right: 8px;
  color: #007bff;
}

.warning-icon {
  color: #ffc107;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
}

.section-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.9;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-select {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 10px 12px;
  color: white;
  font-size: 14px;
  transition: all 0.3s ease;
}

.form-select:focus {
  outline: none;
  border-color: #007bff;
  background: rgba(255, 255, 255, 0.2);
}

.form-select option {
  background: #2d3748;
  color: white;
}

.form-help {
  font-size: 11px;
  opacity: 0.7;
  font-style: italic;
  line-height: 1.3;
}

.info-message {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 123, 255, 0.2);
  border: 1px solid rgba(0, 123, 255, 0.4);
  border-radius: 6px;
  padding: 10px;
  font-size: 12px;
}

.warning-message {
  background: rgba(255, 193, 7, 0.2);
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 6px;
  padding: 12px;
}

.warning-content strong {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #ffc107;
}

.warning-content p {
  margin: 4px 0;
  font-size: 12px;
  opacity: 0.9;
  line-height: 1.4;
}

.solution-list {
  margin-top: 8px;
}

.solution-list ul {
  margin: 4px 0 0 16px;
  padding: 0;
}

.solution-list li {
  font-size: 11px;
  margin-bottom: 2px;
  opacity: 0.8;
}

.audio-preview {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audio-level-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-level-container label {
  font-size: 11px;
  min-width: 80px;
}

.audio-level-meter {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.audio-level-bar {
  height: 100%;
  transition: width 0.1s ease;
  border-radius: 4px;
}

.audio-level-bar.level-low {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.audio-level-bar.level-medium {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.audio-level-bar.level-high {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.audio-level-text {
  font-size: 11px;
  min-width: 35px;
  text-align: right;
}

.test-button {
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 12px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 6px;
}

.test-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.3);
}

.test-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.recording-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.info-label {
  font-size: 12px;
  opacity: 0.8;
  font-weight: 500;
}

.info-value {
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}

.status-ready {
  color: #10b981;
}

.status-disabled {
  color: #6b7280;
}

.status-error {
  color: #ef4444;
}

.config-actions {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.action-button {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.cancel-button {
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.cancel-button:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.start-button {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border: 1px solid transparent;
}

.start-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #0056b3, #004085);
  transform: translateY(-1px);
}

.start-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Focus styles for accessibility */
.form-select:focus,
.action-button:focus,
.test-button:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}
</style>
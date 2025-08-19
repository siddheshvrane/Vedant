<template>
  <div class="recording-config-content">
    <div class="config-sections">
      <!-- Audio Configuration -->
      <div class="config-section">
        <div class="section-header">
          <i class="fas fa-microphone section-icon"></i>
          <h3>Audio Settings</h3>
        </div>
        <div class="section-content">
          <div class="form-group">
            <label>Audio Source:</label>
            <select v-model="config.audioSource" @change="onAudioSourceChange" class="form-select">
              <option value="none">No Audio</option>
              <option 
                v-for="device in audioDevices" 
                :key="device.id" 
                :value="device.id"
                :disabled="device.id === 'system' && !systemAudioSupported"
              >
                {{ device.label }}
                {{ device.id === 'system' && !systemAudioSupported ? ' (Not Available)' : '' }}
              </option>
            </select>
          </div>
          
          <div v-if="config.audioSource === 'system' && !systemAudioSupported" class="warning-message">
            <i class="fas fa-exclamation-triangle warning-icon"></i>
            <div class="warning-content">
              <strong>System Audio Unavailable</strong>
              <p v-if="platform === 'darwin'">
                Install BlackHole virtual audio device to record system audio on macOS.
              </p>
              <p v-else-if="platform === 'linux'">
                Make sure PulseAudio is installed and running to record system audio on Linux.
              </p>
              <p v-else>
                System audio recording may not be available on your platform.
              </p>
            </div>
          </div>

          <div v-if="config.audioSource !== 'none'" class="audio-preview">
            <div class="audio-level-container">
              <label>Audio Level:</label>
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
              <i class="fas fa-volume-up"></i>
              {{ isTestingAudio ? 'Testing...' : 'Test Audio' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Recording Preview -->
      <div class="config-section">
        <div class="section-header">
          <i class="fas fa-info-circle section-icon"></i>
          <h3>Recording Info</h3>
        </div>
        <div class="section-content">
          <div class="recording-info">
            <div class="info-row">
              <span class="info-label">Quality:</span>
              <span class="info-value">1080p @ 30fps (Default)</span>
            </div>
            <div class="info-row">
              <span class="info-label">Format:</span>
              <span class="info-value">WebM</span>
            </div>
            <div class="info-row">
              <span class="info-label">Audio:</span>
              <span class="info-value">{{ getAudioDescription() }}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Platform:</span>
              <span class="info-value">{{ getPlatformName() }}</span>
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
      <button @click="startRecording" class="action-button start-button" :disabled="!canStartRecording">
        <i class="fas fa-video"></i>
        Start Recording
      </button>
    </div>
  </div>
</template>

<script>
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
      required: true
    }
  },
  data() {
    return {
      config: {
        audioSource: 'none',
        videoFormat: 'webm',
        videoQuality: 'medium', // Fixed default
        frameRate: 30, // Fixed default
        videoBitrate: 4000000, // Fixed default
        audioBitrate: 128000 // Fixed default
      },
      audioLevel: 0,
      isTestingAudio: false,
      audioTestInterval: null,
      systemAudioSupported: false,
      platform: 'unknown'
    };
  },
  async mounted() {
    // Initialize configuration with props
    this.config = { ...this.config, ...this.currentConfig };
    
    // Get platform info
    if (window.electron) {
      this.platform = window.electron.platform || 'unknown';
      const capabilities = await window.electron.getRecordingCapabilities();
      this.systemAudioSupported = capabilities?.systemAudioSupported || false;
    }
  },
  beforeUnmount() {
    this.stopAudioTest();
  },
  computed: {
    canStartRecording() {
      return true; // Always can start with default settings
    }
  },
  methods: {
    onAudioSourceChange() {
      if (this.config.audioSource !== 'none') {
        this.startAudioTest();
      } else {
        this.stopAudioTest();
      }
    },

    async startAudioTest() {
      if (this.isTestingAudio || this.config.audioSource === 'none') return;
      
      try {
        this.isTestingAudio = true;
        
        // Simulate audio level for demonstration
        this.audioTestInterval = setInterval(() => {
          this.audioLevel = Math.random() * 60 + 20; // Random level between 20-80%
        }, 100);
        
        // Stop test after 3 seconds
        setTimeout(() => {
          this.stopAudioTest();
        }, 3000);
        
      } catch (error) {
        console.error('Audio test failed:', error);
        this.isTestingAudio = false;
      }
    },

    stopAudioTest() {
      if (this.audioTestInterval) {
        clearInterval(this.audioTestInterval);
        this.audioTestInterval = null;
      }
      this.isTestingAudio = false;
      this.audioLevel = 0;
    },

    async testAudio() {
      this.stopAudioTest();
      await this.startAudioTest();
    },

    getAudioDescription() {
      if (this.config.audioSource === 'none') return 'No audio recording';
      
      const device = this.audioDevices.find(d => d.id === this.config.audioSource);
      const deviceName = device ? device.label : 'Unknown device';
      return `${deviceName} (128 kbps)`;
    },

    getPlatformName() {
      const platforms = {
        win32: 'Windows',
        darwin: 'macOS', 
        linux: 'Linux'
      };
      return platforms[this.platform] || 'Unknown';
    },

    startRecording() {
      this.stopAudioTest();
      this.onStart(this.config);
    },

    cancel() {
      this.stopAudioTest();
      this.onCancel();
    }
  }
};
</script>

<style scoped>
.recording-config-content {
  width: 100%;
  max-width: 500px;
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

.warning-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(255, 193, 7, 0.2);
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

.warning-icon {
  font-size: 16px;
  color: #ffc107;
  margin-top: 2px;
}

.warning-content {
  flex: 1;
}

.warning-content strong {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}

.warning-content p {
  margin: 0;
  font-size: 11px;
  opacity: 0.9;
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
  min-width: 70px;
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
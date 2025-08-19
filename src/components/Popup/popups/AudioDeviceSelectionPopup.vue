<template>
  <div class="audio-device-selection-content">
    <div class="selection-header">
      <div class="header-icon">
        <i class="fas fa-microphone-alt"></i>
      </div>
      <div class="header-text">
        <h3>Select Audio Source</h3>
        <p>Choose an audio source for recording during the flythrough</p>
      </div>
    </div>

    <div class="device-list">
      <div 
        v-for="device in audioDevices" 
        :key="device.id"
        class="device-option"
        :class="{ 
          'selected': selectedDeviceId === device.id,
          'disabled': device.disabled
        }"
        @click="selectDevice(device)"
      >
        <div class="device-radio">
          <input 
            type="radio" 
            :id="device.id"
            :value="device.id"
            v-model="selectedDeviceId"
            :disabled="device.disabled"
            @change="selectDevice(device)"
          />
          <label :for="device.id" class="radio-label"></label>
        </div>
        
        <div class="device-info">
          <div class="device-name">{{ device.label }}</div>
          <div class="device-type">
            <i :class="getDeviceIcon(device.type)" class="type-icon"></i>
            <span>{{ getDeviceTypeText(device.type) }}</span>
          </div>
        </div>

        <div v-if="device.disabled" class="device-status">
          <i class="fas fa-exclamation-triangle warning-icon"></i>
          <span class="status-text">Not Available</span>
        </div>
      </div>
    </div>

    <div v-if="selectedDeviceId !== 'none'" class="audio-preview-section">
      <div class="preview-header">
        <i class="fas fa-volume-up"></i>
        <span>Audio Preview</span>
      </div>
      <div class="audio-level-display">
        <div class="level-meter">
          <div 
            class="level-bar"
            :style="{ width: audioLevel + '%' }"
            :class="{
              'level-low': audioLevel < 30,
              'level-medium': audioLevel >= 30 && audioLevel < 70,
              'level-high': audioLevel >= 70
            }"
          ></div>
        </div>
        <span class="level-text">{{ Math.round(audioLevel) }}%</span>
      </div>
      <button @click="testAudio" class="test-audio-button" :disabled="isTestingAudio">
        <i :class="isTestingAudio ? 'fas fa-spinner fa-spin' : 'fas fa-play'"></i>
        {{ isTestingAudio ? 'Testing...' : 'Test Audio' }}
      </button>
    </div>

    <div class="selection-actions">
      <button @click="cancel" class="action-button cancel-button">
        <i class="fas fa-times"></i>
        Cancel
      </button>
      <button 
        @click="confirmSelection" 
        class="action-button confirm-button"
        :disabled="!selectedDeviceId"
      >
        <i class="fas fa-check"></i>
        Continue
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AudioDeviceSelectionPopup',
  props: {
    audioDevices: {
      type: Array,
      default: () => []
    },
    onSelect: {
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
      selectedDeviceId: 'none', // Default to no audio
      audioLevel: 0,
      isTestingAudio: false,
      audioTestInterval: null,
      audioContext: null,
      audioStream: null
    };
  },
  mounted() {
    // Set default selection to 'none' if available
    if (this.audioDevices.length > 0) {
      const noneDevice = this.audioDevices.find(d => d.id === 'none');
      if (noneDevice) {
        this.selectedDeviceId = 'none';
      } else {
        this.selectedDeviceId = this.audioDevices[0].id;
      }
    }
  },
  beforeUnmount() {
    this.stopAudioTest();
  },
  methods: {
    selectDevice(device) {
      if (device.disabled) return;
      
      this.selectedDeviceId = device.id;
      this.stopAudioTest();
      
      if (device.id !== 'none') {
        // Auto-start audio test when selecting a device
        setTimeout(() => {
          this.testAudio();
        }, 300);
      }
    },

    async testAudio() {
      if (this.isTestingAudio || this.selectedDeviceId === 'none') return;

      this.stopAudioTest();
      this.isTestingAudio = true;

      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };

        // Add device ID constraint if not default
        if (this.selectedDeviceId !== 'default') {
          constraints.audio.deviceId = { exact: this.selectedDeviceId };
        }

        this.audioStream = await navigator.mediaDevices.getUserMedia(constraints);
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const source = this.audioContext.createMediaStreamSource(this.audioStream);
        const analyser = this.audioContext.createAnalyser();
        
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevel = () => {
          if (!this.isTestingAudio) return;
          
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average level
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          this.audioLevel = (average / 255) * 100;
          
          requestAnimationFrame(updateLevel);
        };

        updateLevel();

        // Auto-stop after 5 seconds
        setTimeout(() => {
          this.stopAudioTest();
        }, 5000);

      } catch (error) {
        console.error('Audio test failed:', error);
        this.audioLevel = 0;
        this.isTestingAudio = false;
        
        // Show error feedback
        this.$emit('audio-test-error', error.message);
      }
    },

    stopAudioTest() {
      this.isTestingAudio = false;
      this.audioLevel = 0;

      if (this.audioStream) {
        this.audioStream.getTracks().forEach(track => track.stop());
        this.audioStream = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }
    },

    getDeviceIcon(type) {
      switch (type) {
        case 'none':
          return 'fas fa-microphone-slash';
        case 'default':
          return 'fas fa-microphone';
        case 'bluetooth':
          return 'fab fa-bluetooth';
        case 'headset':
          return 'fas fa-headphones';
        case 'system':
          return 'fas fa-desktop';
        default:
          return 'fas fa-microphone';
      }
    },

    getDeviceTypeText(type) {
      switch (type) {
        case 'none':
          return 'No Audio Recording';
        case 'default':
          return 'Default Microphone';
        case 'bluetooth':
          return 'Bluetooth Device';
        case 'headset':
          return 'Headset/Headphones';
        case 'system':
          return 'System Audio';
        default:
          return 'Audio Device';
      }
    },

    confirmSelection() {
      this.stopAudioTest();
      this.onSelect(this.selectedDeviceId);
    },

    cancel() {
      this.stopAudioTest();
      this.onCancel();
    }
  }
};
</script>

<style scoped>
.audio-device-selection-content {
  width: 100%;
  max-width: 450px;
  color: white;
}

.selection-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.header-icon {
  font-size: 24px;
  color: #007bff;
  margin-right: 16px;
  background: rgba(0, 123, 255, 0.2);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.header-text h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
}

.header-text p {
  margin: 0;
  font-size: 13px;
  opacity: 0.8;
}

.device-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.device-option {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.device-option:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.device-option.selected {
  background: rgba(0, 123, 255, 0.2);
  border-color: #007bff;
}

.device-option.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.device-radio {
  position: relative;
  margin-right: 12px;
}

.device-radio input[type="radio"] {
  opacity: 0;
  position: absolute;
  width: 0;
  height: 0;
}

.radio-label {
  display: block;
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
}

.device-radio input[type="radio"]:checked + .radio-label {
  border-color: #007bff;
  background: #007bff;
}

.device-radio input[type="radio"]:checked + .radio-label::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: white;
  border-radius: 50%;
}

.device-info {
  flex: 1;
}

.device-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
}

.device-type {
  display: flex;
  align-items: center;
  font-size: 12px;
  opacity: 0.7;
}

.type-icon {
  margin-right: 6px;
  width: 12px;
}

.device-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #ffc107;
}

.warning-icon {
  font-size: 12px;
}

.audio-preview-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 500;
}

.audio-level-display {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.level-meter {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.level-bar {
  height: 100%;
  transition: width 0.1s ease;
  border-radius: 4px;
}

.level-bar.level-low {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.level-bar.level-medium {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

.level-bar.level-high {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.level-text {
  font-size: 12px;
  min-width: 35px;
  text-align: right;
  font-weight: 500;
}

.test-audio-button {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 8px 16px;
  color: white;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.test-audio-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
}

.test-audio-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.selection-actions {
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

.confirm-button {
  background: linear-gradient(135deg, #007bff, #0056b3);
  color: white;
  border: 1px solid transparent;
}

.confirm-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #0056b3, #004085);
  transform: translateY(-1px);
}

.confirm-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Focus styles for accessibility */
.device-option:focus,
.action-button:focus,
.test-audio-button:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}
</style>
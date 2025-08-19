<template>
  <div class="download-recording-content">
    <div class="download-header">
      <div class="header-icon">
        <i class="fas fa-download"></i>
      </div>
      <div class="header-text">
        <h3>Recording Complete!</h3>
        <p>Your flythrough has been recorded successfully</p>
      </div>
    </div>

    <div class="recording-details">
      <div class="detail-row">
        <div class="detail-label">
          <i class="fas fa-clock"></i>
          Duration
        </div>
        <div class="detail-value">{{ recordingInfo.durationFormatted }}</div>
      </div>
      
      <div class="detail-row">
        <div class="detail-label">
          <i class="fas fa-hdd"></i>
          File Size
        </div>
        <div class="detail-value">{{ recordingInfo.sizeFormatted }}</div>
      </div>
      
      <div class="detail-row">
        <div class="detail-label">
          <i class="fas fa-file-video"></i>
          Format
        </div>
        <div class="detail-value">{{ recordingInfo.format.toUpperCase() }}</div>
      </div>
      
      <div class="detail-row">
        <div class="detail-label">
          <i class="fas fa-microphone"></i>
          Audio
        </div>
        <div class="detail-value">{{ recordingInfo.hasAudio ? recordingInfo.audioSource : 'No Audio' }}</div>
      </div>
      
      <div class="detail-row">
        <div class="detail-label">
          <i class="fas fa-calendar-alt"></i>
          Recorded
        </div>
        <div class="detail-value">{{ formatTimestamp(recordingInfo.timestamp) }}</div>
      </div>
    </div>

    <div class="download-preview">
      <div class="preview-header">
        <i class="fas fa-eye"></i>
        <span>Recording Preview</span>
      </div>
      <div class="preview-info">
        <div class="quality-badge">
          <i class="fas fa-hd-video"></i>
          <span>High Quality</span>
        </div>
        <div class="file-info">
          <span class="filename">flythrough-{{ formatFilename(recordingInfo.timestamp) }}.{{ recordingInfo.format }}</span>
        </div>
      </div>
    </div>

    <div class="download-options">
      <div class="option-section">
        <h4>Download Options</h4>
        <div class="options-grid">
          <label class="option-item">
            <input type="radio" name="downloadType" value="immediate" v-model="downloadType" />
            <div class="option-content">
              <div class="option-icon">
                <i class="fas fa-download"></i>
              </div>
              <div class="option-text">
                <span class="option-title">Download Now</span>
                <span class="option-desc">Save to your Downloads folder</span>
              </div>
            </div>
          </label>
          
          <label class="option-item">
            <input type="radio" name="downloadType" value="choose-location" v-model="downloadType" />
            <div class="option-content">
              <div class="option-icon">
                <i class="fas fa-folder-open"></i>
              </div>
              <div class="option-text">
                <span class="option-title">Choose Location</span>
                <span class="option-desc">Select where to save the file</span>
              </div>
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="download-actions">
      <button @click="cancel" class="action-button cancel-button">
        <i class="fas fa-times"></i>
        Cancel
      </button>
      <button 
        @click="downloadRecording" 
        class="action-button download-button"
        :disabled="!downloadType"
      >
        <i class="fas fa-download"></i>
        {{ downloadType === 'choose-location' ? 'Save As...' : 'Download' }}
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DownloadRecordingPopup',
  props: {
    recordingInfo: {
      type: Object,
      required: true
    },
    onDownload: {
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
      downloadType: 'immediate'
    };
  },
  methods: {
    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatFilename(timestamp) {
      const date = new Date(timestamp);
      return date.toISOString().replace(/[:.]/g, '-').split('.')[0];
    },

    downloadRecording() {
      this.onDownload({
        type: this.downloadType,
        chooseLocation: this.downloadType === 'choose-location'
      });
    },

    cancel() {
      this.onCancel();
    }
  }
};
</script>

<style scoped>
.download-recording-content {
  width: 100%;
  max-width: 480px;
  color: white;
}

.download-header {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.header-icon {
  font-size: 24px;
  color: #28a745;
  margin-right: 16px;
  background: rgba(40, 167, 69, 0.2);
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

.recording-details {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  opacity: 0.8;
  font-weight: 500;
}

.detail-label i {
  width: 16px;
  text-align: center;
}

.detail-value {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
}

.download-preview {
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

.preview-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.quality-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(40, 167, 69, 0.2);
  color: #28a745;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.file-info {
  flex: 1;
  text-align: right;
}

.filename {
  font-family: monospace;
  font-size: 11px;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.download-options {
  margin-bottom: 20px;
}

.option-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.9;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: block;
  cursor: pointer;
}

.option-item input[type="radio"] {
  display: none;
}

.option-content {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  transition: all 0.3s ease;
}

.option-item input[type="radio"]:checked + .option-content {
  background: rgba(0, 123, 255, 0.2);
  border-color: #007bff;
}

.option-item:hover .option-content {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
}

.option-icon {
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  font-size: 14px;
}

.option-text {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.option-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}

.option-desc {
  font-size: 11px;
  opacity: 0.7;
}

.download-actions {
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

.download-button {
  background: linear-gradient(135deg, #28a745, #1e7e34);
  color: white;
  border: 1px solid transparent;
}

.download-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e7e34, #155724);
  transform: translateY(-1px);
}

.download-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

/* Focus styles for accessibility */
.option-item:focus-within .option-content,
.action-button:focus {
  outline: 2px solid #007bff;
  outline-offset: 2px;
}
</style>
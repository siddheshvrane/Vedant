<template>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <div class="flythrough-completion-popup">
    <div class="completion-header">
      <div class="success-animation">
        <div class="checkmark"><i class="fas fa-check-circle"></i></div>
      </div>
      <div class="header-content">
        <h2><i class="fas fa-helicopter"></i> Flythrough Complete!</h2>
        <p>Your aerial journey has been recorded successfully</p>
      </div>
    </div>

    <div class="completion-stats">
      <div class="stat-card">
        <div class="stat-icon"><i class="fas fa-clock"></i></div>
        <div class="stat-content">
          <div class="stat-label">Flight Duration</div>
          <div class="stat-value">{{ flightDuration }}s</div>
        </div>
      </div>
      
      <div class="stat-card" v-if="recordingInfo">
        <div class="stat-icon"><i class="fas fa-video"></i></div>
        <div class="stat-content">
          <div class="stat-label">Recording Duration</div>
          <div class="stat-value">{{ recordingInfo.durationFormatted }}</div>
        </div>
      </div>
      
      <div class="stat-card" v-if="recordingInfo">
        <div class="stat-icon"><i class="fas fa-hdd"></i></div>
        <div class="stat-content">
          <div class="stat-label">File Size</div>
          <div class="stat-value">{{ recordingInfo.sizeFormatted }}</div>
        </div>
      </div>
    </div>

    <div class="recording-section" v-if="recordingInfo">
      <div class="section-header">
        <span class="section-icon"><i class="fas fa-film"></i></span>
        <h3>Recording Details</h3>
      </div>
      
      <div class="recording-details">
        <div class="detail-row">
          <span class="detail-label">Format:</span>
          <span class="detail-value">{{ recordingInfo.format.toUpperCase() }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Audio:</span>
          <span class="detail-value">
            {{ recordingInfo.hasAudio ? recordingInfo.audioSource : 'No Audio' }}
          </span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Quality:</span>
          <span class="detail-value">{{ getQualityDescription() }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Recorded:</span>
          <span class="detail-value">{{ formatTimestamp(recordingInfo.timestamp) }}</span>
        </div>
      </div>

      <div class="download-section">
        <h4><i class="fas fa-download"></i> Download Options</h4>
        <div class="download-options">
          <div class="format-options">
            <div class="format-option" v-for="format in availableFormats" :key="format.value">
              <input 
                type="radio" 
                :id="`format-${format.value}`" 
                :value="format.value" 
                v-model="selectedFormat"
                class="format-radio"
              />
              <label :for="`format-${format.value}`" class="format-label">
                <span class="format-icon" v-html="format.icon"></span>
                <div class="format-info">
                  <div class="format-name">{{ format.name }}</div>
                  <div class="format-description">{{ format.description }}</div>
                </div>
              </label>
            </div>
          </div>
          
          <div class="filename-section">
            <label for="custom-filename">Custom Filename (optional):</label>
            <div class="filename-input-group">
              <input 
                id="custom-filename"
                v-model="customFilename" 
                type="text" 
                class="filename-input"
                :placeholder="getDefaultFilename()"
              />
              <span class="filename-extension">.{{ selectedFormat }}</span>
            </div>
          </div>
        </div>

        <div class="download-actions">
          <button @click="downloadRecording" class="download-button" :disabled="isDownloading">
            <span v-if="isDownloading"><i class="fas fa-spinner fa-spin"></i> Preparing Download...</span>
            <span v-else><i class="fas fa-download"></i> Download Recording</span>
          </button>
          <button @click="previewRecording" class="preview-button" v-if="canPreview">
            <i class="fas fa-search"></i> Preview Recording
          </button>
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <button @click="startNewFlythrough" class="new-flythrough-button">
        <i class="fas fa-helicopter"></i> Start New Flythrough
      </button>
      <button @click="shareRecording" class="share-button" v-if="recordingInfo">
        <i class="fas fa-share"></i> Share Recording
      </button>
      <button @click="closePopup" class="close-button">
        <i class="fas fa-times"></i> Close
      </button>
    </div>

    <!-- Preview Modal -->
    <div v-if="showPreview" class="preview-modal-overlay" @click="closePreview">
      <div class="preview-modal" @click.stop>
        <div class="preview-header">
          <h3><i class="fas fa-film"></i> Recording Preview</h3>
          <button @click="closePreview" class="preview-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="preview-content">
          <video 
            v-if="recordingInfo" 
            :src="recordingInfo.url" 
            controls 
            class="preview-video"
            @loadedmetadata="onVideoLoaded"
          >
            Your browser does not support the video tag.
          </video>
        </div>
        <div class="preview-controls">
          <button @click="downloadFromPreview" class="preview-download-btn">
            <i class="fas fa-download"></i> Download This Recording
          </button>
        </div>
      </div>
    </div>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="share-modal-overlay" @click="closeShareModal">
      <div class="share-modal" @click.stop>
        <div class="share-header">
          <h3><i class="fas fa-share"></i> Share Your Flythrough</h3>
          <button @click="closeShareModal" class="share-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="share-content">
          <div class="share-option">
            <label>Direct Link:</label>
            <div class="link-input-group">
              <input 
                type="text" 
                :value="shareUrl" 
                readonly 
                class="share-link-input"
                ref="shareUrlInput"
              />
              <button @click="copyShareUrl" class="copy-link-btn">
                <span v-html="linkCopied ? '<i class=\'fas fa-check\'></i> Copied!' : '<i class=\'fas fa-copy\'></i> Copy'"></span>
              </button>
            </div>
          </div>
          
          <div class="social-share">
            <h4>Share on Social Media:</h4>
            <div class="social-buttons">
              <button @click="shareOnTwitter" class="social-btn twitter">
                <i class="fab fa-twitter"></i> Twitter
              </button>
              <button @click="shareOnFacebook" class="social-btn facebook">
                <i class="fab fa-facebook"></i> Facebook
              </button>
              <button @click="shareOnLinkedIn" class="social-btn linkedin">
                <i class="fab fa-linkedin"></i> LinkedIn
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FlythroughCompletionPopup',
  props: {
    flightDuration: {
      type: Number,
      required: true
    },
    recordingInfo: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      selectedFormat: 'mp4',
      customFilename: '',
      isDownloading: false,
      showPreview: false,
      showShareModal: false,
      linkCopied: false,
      availableFormats: [
        {
          value: 'mp4',
          name: 'MP4',
          icon: '<i class="fas fa-film"></i>',
          description: 'Best for sharing and web playback'
        },
        {
          value: 'webm',
          name: 'WebM',
          icon: '<i class="fas fa-globe"></i>',
          description: 'Smaller file size, web optimized'
        },
        {
          value: 'mov',
          name: 'MOV',
          icon: '<i class="fas fa-video"></i>',
          description: 'High quality, good for editing'
        }
      ]
    }
  },
  computed: {
    canPreview() {
      return this.recordingInfo && this.recordingInfo.url;
    },
    shareUrl() {
      return this.recordingInfo ? 
        `${window.location.origin}/flythrough/${this.recordingInfo.id}` : 
        '';
    }
  },
  methods: {
    getQualityDescription() {
      if (!this.recordingInfo) return 'Unknown';
      
      const { width, height } = this.recordingInfo;
      if (width >= 3840) return '4K Ultra HD';
      if (width >= 1920) return '1080p Full HD';
      if (width >= 1280) return '720p HD';
      return `${width}x${height}`;
    },
    
    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    },
    
    getDefaultFilename() {
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
      return `flythrough_${dateStr}_${timeStr}`;
    },
    
    async downloadRecording() {
      if (!this.recordingInfo) return;
      
      this.isDownloading = true;
      
      try {
        const filename = this.customFilename || this.getDefaultFilename();
        const fullFilename = `${filename}.${this.selectedFormat}`;
        
        // Create download link
        const link = document.createElement('a');
        link.href = this.recordingInfo.url;
        link.download = fullFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Emit download event
        this.$emit('download', {
          format: this.selectedFormat,
          filename: fullFilename,
          recordingInfo: this.recordingInfo
        });
        
      } catch (error) {
        console.error('Download failed:', error);
        alert('Download failed. Please try again.');
      } finally {
        this.isDownloading = false;
      }
    },
    
    previewRecording() {
      this.showPreview = true;
    },
    
    closePreview() {
      this.showPreview = false;
    },
    
    onVideoLoaded(event) {
      // Video loaded successfully
      console.log('Preview video loaded');
    },
    
    downloadFromPreview() {
      this.closePreview();
      this.downloadRecording();
    },
    
    startNewFlythrough() {
      this.$emit('new-flythrough');
      this.closePopup();
    },
    
    shareRecording() {
      this.showShareModal = true;
    },
    
    closeShareModal() {
      this.showShareModal = false;
      this.linkCopied = false;
    },
    
    async copyShareUrl() {
      try {
        await navigator.clipboard.writeText(this.shareUrl);
        this.linkCopied = true;
        setTimeout(() => {
          this.linkCopied = false;
        }, 2000);
      } catch (error) {
        // Fallback for older browsers
        this.$refs.shareUrlInput.select();
        document.execCommand('copy');
        this.linkCopied = true;
        setTimeout(() => {
          this.linkCopied = false;
        }, 2000);
      }
    },
    
    shareOnTwitter() {
      const text = encodeURIComponent('Check out my awesome flythrough recording! 🚁✨');
      const url = encodeURIComponent(this.shareUrl);
      window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    },
    
    shareOnFacebook() {
      const url = encodeURIComponent(this.shareUrl);
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
    },
    
    shareOnLinkedIn() {
      const url = encodeURIComponent(this.shareUrl);
      const title = encodeURIComponent('My Flythrough Recording');
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`, '_blank');
    },
    
    closePopup() {
      this.$emit('close');
    }
  }
}
</script>

<style scoped>
.flythrough-completion-popup {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20px;
  padding: 30px;
  max-width: 600px;
  width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  color: white;
  z-index: 1000;
}

.completion-header {
  text-align: center;
  margin-bottom: 25px;
}

.success-animation {
  margin-bottom: 15px;
}

.checkmark {
  font-size: 48px;
  animation: bounce 0.6s ease-in-out;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
}

.header-content h2 {
  margin: 0 0 10px 0;
  font-size: 28px;
  font-weight: bold;
}

.header-content p {
  margin: 0;
  opacity: 0.9;
  font-size: 16px;
}

.completion-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 15px;
  margin-bottom: 25px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  backdrop-filter: blur(10px);
}

.stat-icon {
  font-size: 24px;
}

.stat-content {
  flex: 1;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: bold;
}

.recording-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  padding: 25px;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.section-icon {
  font-size: 24px;
}

.section-header h3 {
  margin: 0;
  font-size: 20px;
}

.recording-details {
  margin-bottom: 25px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.detail-label {
  opacity: 0.8;
}

.detail-value {
  font-weight: 500;
}

.download-section h4 {
  margin: 0 0 15px 0;
  font-size: 18px;
}

.format-options {
  margin-bottom: 20px;
}

.format-option {
  margin-bottom: 10px;
}

.format-radio {
  display: none;
}

.format-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.format-label:hover {
  background: rgba(255, 255, 255, 0.15);
}

.format-radio:checked + .format-label {
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.5);
}

.format-icon {
  font-size: 20px;
}

.format-info {
  flex: 1;
}

.format-name {
  font-weight: bold;
  margin-bottom: 2px;
}

.format-description {
  font-size: 12px;
  opacity: 0.8;
}

.filename-section {
  margin-bottom: 20px;
}

.filename-section label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
}

.filename-input-group {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.filename-input {
  flex: 1;
  padding: 12px;
  background: transparent;
  border: none;
  color: white;
  outline: none;
}

.filename-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.filename-extension {
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  font-weight: bold;
}

.download-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.download-button, .preview-button {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 140px;
}

.download-button {
  background: #4CAF50;
  color: white;
}

.download-button:hover:not(:disabled) {
  background: #45a049;
  transform: translateY(-2px);
}

.download-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.preview-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.preview-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.action-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.new-flythrough-button, .share-button, .close-button {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.new-flythrough-button {
  background: #FF9800;
  color: white;
}

.new-flythrough-button:hover {
  background: #e68900;
  transform: translateY(-2px);
}

.share-button {
  background: #2196F3;
  color: white;
}

.share-button:hover {
  background: #1976D2;
  transform: translateY(-2px);
}

.close-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

/* Modal Styles */
.preview-modal-overlay, .share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.preview-modal, .share-modal {
  background: white;
  border-radius: 15px;
  padding: 25px;
  max-width: 800px;
  width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
  color: #333;
}

.preview-header, .share-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #eee;
}

.preview-header h3, .share-header h3 {
  margin: 0;
  font-size: 24px;
}

.preview-close, .share-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 5px;
}

.preview-close:hover, .share-close:hover {
  color: #333;
}

.preview-video {
  width: 100%;
  max-height: 400px;
  border-radius: 8px;
}

.preview-controls {
  margin-top: 20px;
  text-align: center;
}

.preview-download-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
}

.preview-download-btn:hover {
  background: #45a049;
  transform: translateY(-2px);
}

.share-content {
  color: #333;
}

.share-option {
  margin-bottom: 25px;
}

.share-option label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #555;
}

.link-input-group {
  display: flex;
  gap: 10px;
}

.share-link-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-family: monospace;
}

.copy-link-btn {
  background: #2196F3;
  color: white;
  border: none;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.copy-link-btn:hover {
  background: #1976D2;
}

.social-share h4 {
  margin-bottom: 15px;
  color: #555;
}

.social-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.social-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  flex: 1;
  min-width: 100px;
}

.social-btn.twitter {
  background: #1DA1F2;
  color: white;
}

.social-btn.facebook {
  background: #4267B2;
  color: white;
}

.social-btn.linkedin {
  background: #0077B5;
  color: white;
}

.social-btn:hover {
  transform: translateY(-2px);
  opacity: 0.9;
}

@media (max-width: 600px) {
  .flythrough-completion-popup {
    padding: 20px;
    width: 95vw;
  }
  
  .completion-stats {
    grid-template-columns: 1fr;
  }
  
  .download-actions, .action-buttons {
    flex-direction: column;
  }
  
  .download-button, .preview-button,
  .new-flythrough-button, .share-button, .close-button {
    width: 100%;
  }
  
  .link-input-group {
    flex-direction: column;
  }
  
  .social-buttons {
    flex-direction: column;
  }
}
</style>
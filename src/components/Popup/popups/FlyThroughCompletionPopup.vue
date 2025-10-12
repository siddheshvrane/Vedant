<template>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
  <div class="flythrough-completion-popup">
    <div class="completion-header">
      <div class="success-animation">
        <div class="checkmark"><i class="fas fa-check-circle"></i></div>
      </div>
      <div class="header-content">
        <h2><i class="fas fa-helicopter"></i> Flythrough Complete!</h2>
        <p>Your aerial journey has been completed successfully</p>
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
          <span class="detail-label">Recorded:</span>
          <span class="detail-value">{{ formatTimestamp(recordingInfo.timestamp) }}</span>
        </div>
      </div>
    </div>

    <div class="action-buttons">
      <button @click="closePopup" class="close-button">
        <i class="fas fa-times"></i> Close
      </button>
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
  methods: {
    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
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
  max-width: 500px;
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
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
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
  margin-bottom: 15px;
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

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.close-button {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

@media (max-width: 600px) {
  .flythrough-completion-popup {
    padding: 20px;
    width: 95vw;
  }
  
  .completion-stats {
    grid-template-columns: 1fr;
  }
}
</style>
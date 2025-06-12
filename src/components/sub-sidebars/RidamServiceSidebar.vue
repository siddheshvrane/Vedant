<template>
  <div class="ridam-panel poppins-font">
    <div class="ridam-panel-header">
      <h5 class="ridam-panel-title">RIDaM</h5>
      <button @click="closeRidamMenu" class="btn btn-link text-white close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>
    <div class="ridam-panel-body">
      <hr class="sidebar-divider mb-4">

      <div class="form-group mb-3">
        <label for="baseURLInput">Base URL:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="baseURLInput"
          v-model="baseURL"
        >
      </div>
      <div class="form-group mb-3">
        <label for="argsInput">Args:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="argsInput"
          v-model="args"
        >
      </div>
      <div class="form-group mb-4">
        <label for="legendOptionsInput">Legend Options:</label>
        <input
          type="text"
          class="form-control custom-input"
          id="legendOptionsInput"
          v-model="legendOptions"
        >
      </div>
      <button class="btn btn-primary w-100" @click="addRidamService">
        <i class="fas fa-plus me-2"></i> Add Service
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RidamServiceSidebar',
  data() {
    return {
      baseURL: '',
      args: '',
      legendOptions: ''
    };
  },
  methods: {
    closeRidamMenu() {
      this.$emit('close-ridam-menu');
    },
    addRidamService() {
      console.log('Adding RIDaM Service:', {
        baseURL: this.baseURL,
        args: this.args,
        legendOptions: this.legendOptions
      });
      alert(`Adding RIDaM Service: Base URL - ${this.baseURL}`);
    }
  }
};
</script>

<style scoped>
.ridam-panel {
  width: 300px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(30, 30, 30, 1.0) !important; /* MADE FULLY OPAQUE */
  opacity: 1 !important; /* MADE FULLY OPAQUE */
  flex-shrink: 0;
}

.ridam-panel-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 15px 15px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 30, 30, 1.0) !important; /* MADE FULLY OPAQUE */
}

.ridam-panel-title {
  flex-grow: 1;
  text-align: center;
  margin-bottom: 0;
  font-size: 1.2em;
  color: white;
  margin-left: 30px;
}

.ridam-panel-body {
  flex-grow: 1;
  padding: 20px;
  overflow-y: auto;
  color: white;
}

.poppins-font {
  font-family: 'Poppins', sans-serif;
}

.close-btn {
  font-size: 1em;
  color: white !important;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
}

.sidebar-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.form-group label {
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 5px;
}

.custom-input {
    background-color: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.custom-input::placeholder {
    color: rgba(255, 255, 255, 0.6);
}

.custom-input:focus {
    background-color: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 0 0.25rem rgba(255, 255, 255, 0.25);
}

.btn-primary {
    background-color: #007bff;
    border-color: #007bff;
    color: white;
}
.btn-primary:hover {
    background-color: #0056b3;
    border-color: #004085;
}
</style>
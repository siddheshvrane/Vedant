<template>
  <div class="hello-world-popup">
    <h2>Hello World Plugin</h2>
    <p>This is a simple popup from the Hello World plugin.</p>
    <button @click="closePopup">Close</button>
  </div>
</template>

<script>
export default {
  name: "HelloWorldPopup",
  props: {
    onClose: {
      type: Function,
      required: true,
    },
  },
  methods: {
    closePopup() {
      this.onClose();
    },
  },
};
</script>

<style scoped>
.hello-world-popup {
  padding: 1rem;
  background-color: #222;
  color: #eee;
  border-radius: 8px;
  max-width: 300px;
  text-align: center;
}
button {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background-color: #0d6efd;
  border: none;
  color: white;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background-color: #0b5ed7;
}
</style>

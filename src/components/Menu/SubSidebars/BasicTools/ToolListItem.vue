<template>
  <li class="tool-item">
    <div class="form-check tool-radio-wrapper">
      <input
        class="form-check-input tool-radio"
        type="radio"
        :id="'toolRadio_' + tool.name"
        :name="'toolSelection'"
        :checked="tool.isActive"
        @change="emitActivateTool"
      >
      <label class="form-check-label tool-name" :for="'toolRadio_' + tool.name">
        {{ tool.name }}
      </label>
    </div>
  </li>
</template>

<script>
export default {
  name: 'ToolsListItem',
  props: {
    tool: {
      type: Object,
      required: true,
      validator: (value) => {
        return 'name' in value && 'isActive' in value;
      },
    },
  },
  emits: ['activate-tool'],
  methods: {
    emitActivateTool() {
      // Emit the tool's name to the parent component for activation handling
      this.$emit('activate-tool', this.tool.name);
    },
  },
};
</script>

<style scoped>
/* Styles specific to a single tool item */
.tool-item {
  display: flex;
  align-items: center;
  padding: 10px 0; /* Adjusted padding for better spacing with radio buttons */
  border-bottom: 1px solid rgba(255, 255, 255, 0.05); /* Lighter divider for items */
  font-size: 0.95em;
  color: white;
  cursor: pointer; /* Keep cursor pointer for the whole list item */
}

.tool-item:last-child {
  border-bottom: none; /* No border for the last item */
}

.tool-item:hover {
  background-color: rgba(255, 255, 255, 0.05); /* Subtle hover effect */
}

.tool-radio-wrapper {
  display: flex;
  align-items: center;
  margin-bottom: 0;
  flex-grow: 1;
  margin-left: 10px; /* Indent the radio button slightly */
}

.tool-radio {
  margin-right: 10px;
  width: 1.2em;
  height: 1.2em;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  cursor: pointer;
}

.tool-radio:checked {
  background-color: #007bff; /* Accent color for checked radio */
  border-color: #007bff;
}

.tool-radio:focus {
  box-shadow: 0 0 0 0.25rem rgba(0, 123, 255, 0.25); /* Focus outline */
}

.tool-name {
  color: white;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-grow: 1;
  cursor: pointer; /* Keep label clickable for radio selection */
}

/* Removed the .tool-toggle-icon styles as the icons are no longer used. */
</style>
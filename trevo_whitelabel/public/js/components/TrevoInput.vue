<template>
  <div class="trevo-input-wrapper">
    <label v-if="df.label" class="trevo-label">{{ df.label }}</label>
    <div class="trevo-input-container">
      <input
        :type="inputType"
        :value="value"
        @input="$emit('input', $event.target.value)"
        class="trevo-input"
        :placeholder="df.placeholder || ''"
        :disabled="read_only"
      />
    </div>
    <p v-if="df.description" class="trevo-description">{{ df.description }}</p>
  </div>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps(["df", "value", "read_only"]);

const inputType = computed(() => {
  if (props.df.fieldtype === "Password") return "password";
  if (props.df.fieldtype === "Int" || props.df.fieldtype === "Float") return "number";
  return "text";
});
</script>

<style scoped>
.trevo-input-wrapper {
  margin-bottom: 1rem;
}
.trevo-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 0.25rem;
}
.trevo-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: white;
  transition: all 0.2s ease;
  font-size: 14px;
}
.trevo-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.trevo-description {
  font-size: 12px;
  color: var(--text-light);
  margin-top: 0.25rem;
}
</style>

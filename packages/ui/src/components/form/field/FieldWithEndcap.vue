<script setup lang="ts">
const props = defineProps<{
  label?: string
  description?: string
  required?: boolean
}>()
</script>

<template>
  <div class="max-w-full w-full">
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-sm font-medium">
          <slot name="label">
            {{ props.label }}
          </slot>
          <span v-if="props.required" class="text-red-500">*</span>
        </div>
        <!-- End-cap/action slot next to label -->
        <div class="flex items-center">
          <slot name="endcap" />
        </div>
      </div>
      <div v-if="props.description || $slots.description" class="text-xs text-neutral-500 dark:text-neutral-400">
        <slot name="description">
          {{ props.description }}
        </slot>
      </div>
      <!-- Actual input control -->
      <slot />
    </div>
  </div>
</template>

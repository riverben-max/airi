<script setup lang="ts">
import { useSettings } from '@proj-airi/stage-ui/stores/settings'
import { usePositioningStore } from '@proj-airi/stage-ui/stores/settings/positioning'
import { FieldRange } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Section } from '../../../layouts'

const props = withDefaults(defineProps<{
  palette: string[]
  allowExtractColors?: boolean
  modelId?: string
}>(), {
  allowExtractColors: true,
})

const { stageModelSelected } = storeToRefs(useSettings())
const positioningStore = usePositioningStore()

const scale = computed({
  get: () => positioningStore.getPosition(props.modelId || stageModelSelected.value).scale,
  set: (val) => {
    const key = props.modelId || stageModelSelected.value
    const current = positioningStore.getPosition(key)
    positioningStore.setPosition(key, { ...current, scale: val })
  },
})

const positionX = computed({
  get: () => positioningStore.getPosition(props.modelId || stageModelSelected.value).x,
  set: (val) => {
    const key = props.modelId || stageModelSelected.value
    const current = positioningStore.getPosition(key)
    positioningStore.setPosition(key, { ...current, x: val })
  },
})

const positionY = computed({
  get: () => positioningStore.getPosition(props.modelId || stageModelSelected.value).y,
  set: (val) => {
    const key = props.modelId || stageModelSelected.value
    const current = positioningStore.getPosition(key)
    positioningStore.setPosition(key, { ...current, y: val })
  },
})
</script>

<template>
  <!-- Block 1: Scene -->
  <Section
    title="Scene"
    icon="i-solar:clapperboard-edit-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80  dark:bg-black/75',
      'backdrop-blur-lg',
    ]"
    size="sm"
    :expand="true"
  >
    <FieldRange v-model="scale" as="div" :min="0.1" :max="3" :step="0.01" label="Scale">
      <template #label>
        <div flex items-center>
          <div>Scale</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => scale = 1">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
    <FieldRange v-model="positionX" as="div" :min="-3000" :max="3000" :step="1" label="X Position">
      <template #label>
        <div flex items-center>
          <div>X Position</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => positionX = 0">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
    <FieldRange v-model="positionY" as="div" :min="-3000" :max="3000" :step="1" label="Y Position">
      <template #label>
        <div flex items-center>
          <div>Y Position</div>
          <button px-2 text-xs outline-none title="Reset value to default" @click="() => positionY = 0">
            <div i-solar:forward-linear transform-scale-x--100 text="neutral-500 dark:neutral-400" />
          </button>
        </div>
      </template>
    </FieldRange>
  </Section>
</template>

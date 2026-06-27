<script setup lang="ts">
import type { DisplayModel } from '@proj-airi/stage-ui/stores/display-models'

import { ModelSelectorDialog } from '@proj-airi/stage-ui/components/scenarios/dialogs/model-selector'
import { useDisplayModelsStore } from '@proj-airi/stage-ui/stores/display-models'
import { Select } from '@proj-airi/ui/components/form'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  consciousnessProviderOptions: { value: string, label: string }[]
  consciousnessModelOptions: { value: string, label: string }[]
  speechProviderOptions: { value: string, label: string }[]
  speechModelOptions: { value: string, label: string }[]
  speechVoiceOptions: { value: string, label: string }[]
  displayModelOptions: { value: string, label: string }[]
  sceneOptions: { value: string, label: string }[]
  consciousnessProviderPlaceholder: string
  defaultConsciousnessModelPlaceholder: string
  speechProviderPlaceholder: string
  defaultSpeechModelPlaceholder: string
  defaultSpeechVoiceIdPlaceholder: string
  defaultDisplayModelIdPlaceholder: string
  consciousnessProviderActive: boolean
  speechProviderActive: boolean
}>()
const selectedConsciousnessProvider = defineModel<string>('selectedConsciousnessProvider', { required: true })
const selectedConsciousnessModel = defineModel<string>('selectedConsciousnessModel', { required: true })
const selectedSpeechProvider = defineModel<string>('selectedSpeechProvider', { required: true })
const selectedSpeechModel = defineModel<string>('selectedSpeechModel', { required: true })
const selectedSpeechVoiceId = defineModel<string>('selectedSpeechVoiceId', { required: true })
const selectedDisplayModelId = defineModel<string>('selectedDisplayModelId', { required: true })
const selectedActiveBackgroundId = defineModel<string>('selectedActiveBackgroundId', { required: true })

const { t } = useI18n()
const displayModelsStore = useDisplayModelsStore()
const modelSelectorOpen = ref(false)

const selectedModel = computed<DisplayModel | undefined>(() => {
  return displayModelsStore.displayModels.find(m => m.id === selectedDisplayModelId.value)
})

const formatLabel = computed(() => {
  if (!selectedModel.value)
    return ''
  const fmt = selectedModel.value.format.toLowerCase()
  if (fmt.includes('live2d'))
    return 'Live2D'
  if (fmt === 'vrm')
    return 'VRM'
  if (fmt.includes('spine'))
    return 'Spine'
  if (fmt.includes('pmx') || fmt === 'pmd')
    return 'MMD'
  return selectedModel.value.format.toUpperCase()
})
</script>

<template>
  <div class="tab-content ml-auto mr-auto w-95%">
    <p class="mb-3">
      {{ t('settings.pages.card.creation.modules_info') }}
    </p>

    <div :class="['grid', 'grid-cols-1', 'sm:grid-cols-2', 'gap-4', 'ml-auto', 'mr-auto', 'w-90%']">
      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:brain />
          {{ t('settings.pages.card.chat.provider') }}
        </label>
        <Select
          v-model="selectedConsciousnessProvider"
          :options="consciousnessProviderOptions"
          :placeholder="consciousnessProviderPlaceholder"
          class="w-full"
        />
      </div>

      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:ghost />
          {{ t('settings.pages.card.consciousness.model') }}
        </label>
        <Select
          v-if="consciousnessModelOptions && consciousnessModelOptions.length > 0"
          v-slot
          v-model="selectedConsciousnessModel"
          :options="consciousnessModelOptions"
          :placeholder="defaultConsciousnessModelPlaceholder"
          :disabled="!selectedConsciousnessProvider && !consciousnessProviderActive"
          class="w-full"
        />
        <input
          v-else
          v-model="selectedConsciousnessModel"
          type="text"
          :disabled="!selectedConsciousnessProvider && !consciousnessProviderActive"
          class="w-full border border-neutral-200 rounded-lg border-solid bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-800 shadow-sm outline-none dark:border-neutral-800 focus:border-primary-300 dark:bg-neutral-950 focus:bg-neutral-50 dark:text-neutral-200 dark:focus:border-primary-400/50 dark:focus:bg-neutral-900"
          :placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.manual_model_placeholder')"
        >
      </div>

      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:radio />
          {{ t('settings.pages.card.speech.provider') }}
        </label>
        <Select
          v-model="selectedSpeechProvider"
          :options="speechProviderOptions"
          :placeholder="speechProviderPlaceholder"
          class="w-full"
        />
      </div>

      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:mic />
          {{ t('settings.pages.card.speech.model') }}
        </label>
        <Select
          v-model="selectedSpeechModel"
          :options="speechModelOptions"
          :placeholder="defaultSpeechModelPlaceholder"
          :disabled="!selectedSpeechProvider && !speechProviderActive"
          class="w-full"
        />
      </div>

      <div :class="['flex', 'flex-col', 'gap-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-lucide:music />
          {{ t('settings.pages.card.speech.voice') }}
        </label>
        <Select
          v-if="speechVoiceOptions && speechVoiceOptions.length > 0"
          v-model="selectedSpeechVoiceId"
          :options="speechVoiceOptions"
          :placeholder="defaultSpeechVoiceIdPlaceholder"
          :disabled="!selectedSpeechProvider && !speechProviderActive"
          class="w-full"
        />
        <input
          v-else
          v-model="selectedSpeechVoiceId"
          type="text"
          :disabled="!selectedSpeechProvider && !speechProviderActive"
          class="w-full border border-neutral-200 rounded-lg border-solid bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-800 shadow-sm outline-none dark:border-neutral-800 focus:border-primary-300 dark:bg-neutral-950 focus:bg-neutral-50 dark:text-neutral-200 dark:focus:border-primary-400/50 dark:focus:bg-neutral-900"
          :placeholder="t('settings.pages.modules.speech.sections.section.provider-voice-selection.custom_voice_placeholder')"
        >
      </div>

      <div :class="['flex', 'flex-col', 'gap-2', 'sm:col-span-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-solar:user-circle-bold-duotone />
          Models / Avatar
        </label>

        <div
          class="flex items-center justify-between border border-neutral-200 rounded-xl bg-neutral-50/50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/30"
        >
          <div class="flex items-center gap-3 overflow-hidden">
            <!-- Preview Image -->
            <div class="h-12 w-12 flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-950">
              <img
                v-if="selectedModel?.previewImage"
                :src="selectedModel.previewImage"
                class="h-full w-full object-cover"
              >
              <div v-else class="i-solar:gallery-bold text-xl text-neutral-300 dark:text-neutral-700" />
            </div>

            <!-- Model Info -->
            <div class="min-w-0 flex flex-col">
              <span class="truncate text-xs text-neutral-700 font-bold dark:text-neutral-200">
                {{ selectedModel?.name || 'Inherit Default' }}
              </span>
              <span
                v-if="selectedModel"
                class="mt-0.5 self-start rounded bg-primary-500/10 px-1.5 py-0.2 text-[8px] text-primary-500 font-bold uppercase"
              >
                {{ formatLabel }}
              </span>
              <span
                v-else
                class="mt-0.5 self-start rounded bg-neutral-200/50 px-1.5 py-0.2 text-[8px] text-neutral-500 font-bold uppercase dark:bg-neutral-800"
              >
                Default
              </span>
            </div>
          </div>

          <!-- Select Trigger Button -->
          <button
            type="button"
            class="h-8 flex items-center justify-center gap-1.5 border border-neutral-200 rounded-lg bg-white px-3 text-xs text-neutral-700 font-semibold shadow-sm transition-all dark:border-neutral-800 dark:bg-neutral-900 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
            @click="modelSelectorOpen = true"
          >
            <div class="i-solar:gallery-send-bold-duotone text-xs" />
            <span>Select Avatar</span>
          </button>
        </div>

        <!-- Model Selector Dialog Component -->
        <ModelSelectorDialog
          v-model:show="modelSelectorOpen"
          :selected-model="selectedModel"
          @pick="(model) => selectedDisplayModelId = model?.id || ''"
        />
      </div>

      <div :class="['flex', 'flex-col', 'gap-2', 'sm:col-span-2']">
        <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
          <div i-solar:gallery-bold-duotone />
          {{ t('settings.pages.card.creation.preferred_background') }}
        </label>
        <Select
          v-model="selectedActiveBackgroundId"
          :options="sceneOptions"
          placeholder="Select background preference"
          class="w-full"
        />
      </div>
    </div>
  </div>
</template>

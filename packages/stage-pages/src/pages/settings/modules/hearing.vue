<script setup lang="ts">
import type { MicToggleHotkey } from '@proj-airi/stage-shared/shortcuts'

import workletUrl from '@proj-airi/stage-ui/workers/vad/process.worklet?worker&url'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import {
  electronGetMicToggleHotkey,
  electronSetMicToggleHotkey,

} from '@proj-airi/stage-shared/shortcuts'
import { Alert, ErrorContainer, LevelMeter, RadioCardManySelect, RadioCardSimple, TestDummyMarker, ThresholdMeter, TimeSeriesChart } from '@proj-airi/stage-ui/components'
import { useAnalytics, useAudioAnalyzer, useAudioRecorder } from '@proj-airi/stage-ui/composables'
import { useVAD } from '@proj-airi/stage-ui/stores/ai/models/vad'
import { useAudioContext } from '@proj-airi/stage-ui/stores/audio'
import { useHearingSpeechInputPipeline, useHearingStore } from '@proj-airi/stage-ui/stores/modules/hearing'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { useSettingsAudioDevice } from '@proj-airi/stage-ui/stores/settings'
import { Button, FieldCheckbox, FieldInput, FieldRange, FieldSelect } from '@proj-airi/ui'
import { until } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const hearingStore = useHearingStore()
const {
  activeTranscriptionProvider,
  activeTranscriptionModel,
  providerModels,
  activeProviderModelError,
  isLoadingActiveProviderModels,
  supportsModelListing,
  transcriptionModelSearchQuery,
  activeCustomModelName,
  autoSendEnabled,
  autoSendDelay,
  hearingDetectionMode,
} = storeToRefs(hearingStore)
const providersStore = useProvidersStore()
const { configuredTranscriptionProvidersMetadata } = storeToRefs(providersStore)

const { trackProviderClick } = useAnalytics()
const { stopStream, startStream } = useSettingsAudioDevice()
const { audioInputs, selectedAudioInput, stream } = storeToRefs(useSettingsAudioDevice())
const { startRecord, stopRecord, onStopRecord } = useAudioRecorder(stream)
const { startAnalyzer, stopAnalyzer, onAnalyzerUpdate, volumeLevel } = useAudioAnalyzer()
const { audioContext } = storeToRefs(useAudioContext())
const hearingSpeechInputPipeline = useHearingSpeechInputPipeline()
const {
  transcribeForRecording,
  transcribeForMediaStream,
  stopStreamingTranscription,
} = hearingSpeechInputPipeline
const {
  supportsStreamInput,
  error: transcriptionPipelineError,
} = storeToRefs(hearingSpeechInputPipeline)

const animationFrame = ref<number>()

const error = ref<string>('')
const isMonitoring = ref(false)

const transcriptions = ref<string[]>([])
const audios = ref<Blob[]>([])
const audioCleanups = ref<(() => void)[]>([])
const audioURLs = computed(() => {
  return audios.value.map((blob) => {
    const url = URL.createObjectURL(blob)
    audioCleanups.value.push(() => URL.revokeObjectURL(url))
    return url
  })
})

// Speech-to-Text test state
const isTestingSTT = ref(false)
const testTranscriptionText = ref<string>('')
const testTranscriptionError = ref<string>('')
const isTranscribing = ref(false)
const testStreamingText = ref<string>('')
const testStatusMessage = ref<string>('')
const testStreamWasStarted = ref(false) // Track if we started the stream for testing

const useVADThreshold = ref(0.6) // 0.1 - 0.9
const useVADModel = ref(true) // Toggle between VAD and volume-based detection
const shouldUseStreamInput = computed(() => supportsStreamInput.value && !!stream.value)

const isElectron = typeof window !== 'undefined' && !!(window as any).electron
const getMicToggleHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronGetMicToggleHotkey) : null
const setMicToggleHotkeyInvoke = isElectron ? useElectronEventaInvoke(electronSetMicToggleHotkey) : null

const selectedHotkey = ref<MicToggleHotkey>('Scroll')
const instanceId = Math.random().toString(36).slice(2, 9)
const isFetched = ref(false)

onMounted(async () => {
  if (isElectron) {
    console.log('[Hearing Page] Mounting, fetching hotkey from main process...')
    const hotkey = await getMicToggleHotkeyInvoke?.()
    console.log('[Hearing Page] Fetched hotkey from main:', hotkey)
    if (hotkey) {
      selectedHotkey.value = hotkey as MicToggleHotkey
    }
    isFetched.value = true
  }
  else {
    isFetched.value = true
  }
})

watch(selectedHotkey, async (newHotkey, oldHotkey) => {
  console.log('[Hearing Page] selectedHotkey watch triggered:', oldHotkey, '->', newHotkey)
  // Only save if we've already performed the initial fetch and it's a real change
  if (isElectron && isFetched.value && newHotkey !== oldHotkey) {
    console.log('[Hearing Page] User changed hotkey, saving to main process:', newHotkey)
    await setMicToggleHotkeyInvoke?.(newHotkey)
  }
  else {
    console.log('[Hearing Page] Watch skipped save (initialization or no change)')
  }
})

async function handleSpeechStart() {
  if (shouldUseStreamInput.value && stream.value) {
    // Use both callbacks to support incremental updates and final transcript replacement.
    // ChatArea uses only onSentenceEnd to avoid re-adding deleted text.
    await transcribeForMediaStream(stream.value, {
      onSentenceEnd: (delta) => {
        transcriptions.value.push(delta)
      },
      onSpeechEnd: (text) => {
        transcriptions.value = [text]
      },
    })
    return
  }

  startRecord()
}

async function handleSpeechEnd() {
  if (shouldUseStreamInput.value) {
    // For streaming providers, keep the session alive; idle timer will handle teardown.
    return
  }

  stopRecord()
}

const {
  init: initVAD,
  dispose: disposeVAD,
  isSpeech: isSpeechVAD,
  isSpeechProb,
  isSpeechHistory,
  inferenceError: vadModelError,
  start: startVAD,
  loaded: loadedVAD,
  loading: loadingVAD,
} = useVAD(workletUrl, {
  threshold: useVADThreshold,
  onSpeechStart: () => {
    void handleSpeechStart()
  },
  onSpeechEnd: () => {
    void handleSpeechEnd()
  },
})

const isSpeechVolume = ref(false) // Volume-based speaking detection
const isSpeech = computed(() => {
  if (useVADModel.value && loadedVAD.value) {
    return isSpeechVAD.value
  }

  return isSpeechVolume.value
})

async function setupAudioMonitoring() {
  try {
    if (!selectedAudioInput.value) {
      console.warn('No audio input device selected')
      return
    }

    await stopAudioMonitoring()

    await startStream()
    if (!stream.value) {
      console.warn('No audio stream available')
      return
    }

    const source = audioContext.value.createMediaStreamSource(stream.value)

    // Fallback speaking detection (when VAD model is not used)
    const analyzer = startAnalyzer(audioContext.value)
    onAnalyzerUpdate((volumeLevel) => {
      if (!useVADModel.value || !loadedVAD.value) {
        isSpeechVolume.value = volumeLevel > useVADThreshold.value
      }
    })
    if (analyzer)
      source.connect(analyzer)

    if (useVADModel.value) {
      await initVAD()
      await startVAD(stream.value)
    }
  }
  catch (error) {
    console.error('Error setting up audio monitoring:', error)
    vadModelError.value = error instanceof Error ? error.message : String(error)
  }
}

async function stopAudioMonitoring() {
  if (animationFrame.value) { // Stop animation frame
    cancelAnimationFrame(animationFrame.value)
    animationFrame.value = undefined
  }

  await stopStreamingTranscription(true, activeTranscriptionProvider.value)
  if (stream.value) { // Stop media stream
    stopStream()
  }

  stopAnalyzer()
  disposeVAD()
}

// Monitoring toggle
async function toggleMonitoring() {
  if (!isMonitoring.value) {
    await setupAudioMonitoring()
    isMonitoring.value = true
  }
  else {
    await stopAudioMonitoring()
    isMonitoring.value = false
  }
}

// Speaking indicator with enhanced VAD visualization
const speakingIndicatorClass = computed(() => {
  if (!useVADModel.value || !loadedVAD.value) {
    // Volume-based: simple green/white
    return isSpeechVolume.value
      ? 'bg-green-500 shadow-lg shadow-green-500/50'
      : 'bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600'
  }

  // VAD-based: color intensity based on probability
  const prob = isSpeechProb.value
  const threshold = useVADThreshold.value

  if (prob > threshold) {
    // Speaking: green (could add intensity in future)
    return `bg-green-500 shadow-lg shadow-green-500/50`
  }
  else if (prob > threshold * 0.5) {
    // Close to threshold: yellow
    return 'bg-yellow-500 shadow-lg shadow-yellow-500/30'
  }
  else {
    // Low probability: neutral
    return 'bg-white dark:bg-neutral-900 border-2 border-neutral-300 dark:border-neutral-600'
  }
})

function updateCustomModelName(value: string | undefined) {
  const modelValue = value || ''
  activeCustomModelName.value = modelValue
  activeTranscriptionModel.value = modelValue
}

// Sync OpenAI Compatible model from provider config
function syncOpenAICompatibleSettings() {
  if (activeTranscriptionProvider.value !== 'openai-compatible-audio-transcription')
    return

  const providerConfig = providersStore.getProviderConfig(activeTranscriptionProvider.value)
  // Always sync model from provider config (override any existing value from previous provider)
  if (providerConfig?.model) {
    activeTranscriptionModel.value = providerConfig.model as string
    updateCustomModelName(providerConfig.model as string)
  }
  else {
    // If no model in provider config, use default
    const defaultModel = 'whisper-1'
    activeTranscriptionModel.value = defaultModel
    updateCustomModelName(defaultModel)
  }
}

onStopRecord(async (recording) => {
  if (shouldUseStreamInput.value)
    return

  if (!recording || recording.size === 0)
    return

  // Handle STT test transcription directly here
  if (isTestingSTT.value) {
    testStatusMessage.value = t('settings.pages.modules.hearing.test.status.transcribing-recording')
    isTranscribing.value = true

    try {
      const result = await transcribeForRecording(recording)
      if (result) {
        testTranscriptionText.value = result
        testStatusMessage.value = t('settings.pages.modules.hearing.test.status.complete')
        console.info('STT test transcription result:', result)
      }
      else {
        testTranscriptionError.value = transcriptionPipelineError.value || t('settings.pages.modules.hearing.test.errors.no-result')
        testStatusMessage.value = t('settings.pages.modules.hearing.test.status.failed')
      }
    }
    catch (err) {
      testTranscriptionError.value = err instanceof Error ? err.message : String(err)
      testStatusMessage.value = t('settings.pages.modules.hearing.test.status.error', { error: testTranscriptionError.value })
      console.error('STT test transcription error:', err)
    }
    finally {
      isTranscribing.value = false
      isTestingSTT.value = false
    }
    return
  }

  // Normal monitoring mode - add to audios and transcribe
  audios.value.push(recording)

  const res = await transcribeForRecording(recording)

  if (res) {
    transcriptions.value.push(res)
    error.value = ''
  }
  else if (transcriptionPipelineError.value) {
    error.value = transcriptionPipelineError.value
  }
})

// Speech-to-Text test functions
async function startSTTTest() {
  if (!activeTranscriptionProvider.value) {
    testTranscriptionError.value = t('settings.pages.modules.hearing.test.errors.select-provider')
    return
  }

  if (!selectedAudioInput.value) {
    testTranscriptionError.value = t('settings.pages.modules.hearing.test.errors.select-device')
    return
  }

  testTranscriptionError.value = ''
  testTranscriptionText.value = ''
  testStreamingText.value = ''
  testStatusMessage.value = ''
  error.value = ''
  isTestingSTT.value = true
  isTranscribing.value = true

  try {
    // Ensure audio stream is available
    if (!stream.value) {
      testStatusMessage.value = t('settings.pages.modules.hearing.test.status.starting-stream')
      testStreamWasStarted.value = true
      await startStream()

      // Wait for the stream to become available with a 3-second timeout.
      try {
        await until(stream).toBeTruthy({ timeout: 3000, throwOnTimeout: true })
      }
      catch {
        handleStreamStartError()
        return
      }

      // Type guard: until guarantees stream.value is truthy, but TypeScript doesn't know this
      if (!stream.value) {
        handleStreamStartError()
        return
      }
    }
    else {
      testStreamWasStarted.value = false // Stream was already running
    }

    // Check if provider supports streaming input
    if (shouldUseStreamInput.value && stream.value) {
      testStatusMessage.value = t('settings.pages.modules.hearing.test.status.starting-streaming-transcription')
      console.info('Starting STT test with streaming input for provider:', activeTranscriptionProvider.value)

      await transcribeForMediaStream(stream.value, {
        onSentenceEnd: (delta) => {
          if (delta && delta.trim()) {
            testStreamingText.value += `${delta} `
            testStatusMessage.value = t('settings.pages.modules.hearing.test.status.transcribing-stream')
            isTranscribing.value = true
            console.info('STT test received sentence:', delta)
          }
        },
        onSpeechEnd: (text) => {
          if (text) {
            testTranscriptionText.value = text
            testStreamingText.value = ''
            testStatusMessage.value = t('settings.pages.modules.hearing.test.status.complete')
            isTranscribing.value = false
            console.info('STT test completed with text:', text)
          }
          else {
            testStatusMessage.value = t('settings.pages.modules.hearing.test.status.waiting-for-speech')
            isTranscribing.value = false
          }
        },
      })

      testStatusMessage.value = t('settings.pages.modules.hearing.test.status.listening-stream')
      isTranscribing.value = false // Not actively transcribing yet, just listening
    }
    else {
      // Fallback to recording-based transcription
      testStatusMessage.value = t('settings.pages.modules.hearing.test.status.recording')
      console.info('Starting STT test with recording-based transcription for provider:', activeTranscriptionProvider.value)

      startRecord()

      // Wait a bit for recording to start, then stop it after a delay
      setTimeout(async () => {
        stopRecord()
        testStatusMessage.value = t('settings.pages.modules.hearing.test.status.processing')
      }, 3000) // Record for 3 seconds
    }
  }
  catch (err) {
    testTranscriptionError.value = err instanceof Error ? err.message : String(err)
    testStatusMessage.value = t('settings.pages.modules.hearing.test.status.error', { error: testTranscriptionError.value })
    isTranscribing.value = false
    isTestingSTT.value = false
    console.error('STT test error:', err)
  }
}

async function stopSTTTest() {
  isTestingSTT.value = false
  isTranscribing.value = false
  testStatusMessage.value = t('settings.pages.modules.hearing.test.status.stopped')

  try {
    // Stop streaming transcription if active
    if (shouldUseStreamInput.value) {
      await stopStreamingTranscription(false, activeTranscriptionProvider.value)
    }
    else {
      stopRecord()
    }
  }
  catch (err) {
    console.error('Error stopping STT test:', err)
  }

  // Finalize transcription if we have streaming text
  if (testStreamingText.value.trim() && !testTranscriptionText.value) {
    testTranscriptionText.value = testStreamingText.value.trim()
  }

  // Stop the stream if we started it for testing (and monitoring is not active)
  if (testStreamWasStarted.value && !isMonitoring.value) {
    try {
      stopStream()
      testStreamWasStarted.value = false
    }
    catch (err) {
      console.error('Error stopping test stream:', err)
    }
  }
}

// Note: STT test transcription is now handled directly in onStopRecord handler above
// This watch is kept for potential future use but is no longer needed for STT tests

watch(selectedAudioInput, async () => isMonitoring.value && await setupAudioMonitoring())

function handleStreamStartError() {
  testTranscriptionError.value = t('settings.pages.modules.hearing.test.errors.stream-start')
  testStatusMessage.value = t('settings.pages.modules.hearing.test.status.stream-start-error')
  isTranscribing.value = false
  isTestingSTT.value = false
  testStreamWasStarted.value = false
}

watch(activeTranscriptionProvider, async (provider) => {
  if (!provider)
    return

  await hearingStore.loadModelsForProvider(provider)
  syncOpenAICompatibleSettings()

  // Auto-select first model for Web Speech API if no model is selected
  if (provider === 'browser-web-speech-api' && !activeTranscriptionModel.value) {
    const models = providerModels.value
    if (models.length > 0) {
      activeTranscriptionModel.value = models[0].id
      console.info('Auto-selected Web Speech API model:', models[0].id)
    }
  }
}, { immediate: true })

onMounted(async () => {
  // Audio devices are loaded on demand when user requests them
  syncOpenAICompatibleSettings()
})

onUnmounted(() => {
  stopSTTTest()
  stopAudioMonitoring()
  disposeVAD()

  // Clean up any active transcription sessions when leaving the page
  // This prevents stale sessions from interfering with other pages
  if (shouldUseStreamInput.value) {
    stopStreamingTranscription(true, activeTranscriptionProvider.value).catch((err) => {
      console.warn('[Hearing Module] Error cleaning up transcription session on unmount:', err)
    })
  }

  audioCleanups.value.forEach(cleanup => cleanup())
})
</script>

<template>
  <div flex="~ col md:row gap-6">
    <div bg="neutral-100 dark:[rgba(0,0,0,0.3)]" rounded-xl p-4 flex="~ col gap-4" class="h-fit w-full md:w-[40%]">
      <div flex="~ col gap-4">
        <!-- Audio Input Selection -->
        <div>
          <FieldSelect
            v-model="selectedAudioInput"
            label="音频输入设备"
            description="为听觉模块选择音频输入设备。"
            :options="audioInputs.map(input => ({
              label: input.label || input.deviceId,
              value: input.deviceId,
            }))"
            placeholder="选择音频输入设备"
            layout="vertical"
          />
        </div>

        <div flex="~ col gap-4">
          <div>
            <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
              {{ t('settings.pages.providers.title') }}
            </h2>
            <div text="neutral-400 dark:neutral-400">
              <span>{{ t('settings.pages.modules.hearing.sections.section.provider-selection.description') }}</span>
            </div>
          </div>
          <div max-w-full>
            <!--
            fieldset has min-width set to --webkit-min-container, in order to use over flow scroll,
            we need to set the min-width to 0.
            See also: https://stackoverflow.com/a/33737340
          -->
            <fieldset
              v-if="configuredTranscriptionProvidersMetadata.length > 0"
              flex="~ row gap-4"
              :style="{ 'scrollbar-width': 'none' }"
              min-w-0 of-x-scroll scroll-smooth
              role="radiogroup"
            >
              <RadioCardSimple
                v-for="metadata in configuredTranscriptionProvidersMetadata"
                :id="metadata.id"
                :key="metadata.id"
                v-model="activeTranscriptionProvider"
                name="provider"
                :value="metadata.id"
                :title="metadata.localizedName || t('settings.pages.providers.unknown')"
                :description="metadata.localizedDescription"
                class="shrink-0 !w-80"
                @click="trackProviderClick(metadata.id, 'hearing')"
              />
              <RouterLink
                to="/settings/providers#transcription"
                :aria-label="t('settings.pages.modules.hearing.actions.add-provider')"
                border="2px solid"
                class="border-neutral-100 bg-white dark:border-neutral-900 hover:border-primary-500/30 dark:bg-neutral-900/20 dark:hover:border-primary-400/30"

                flex="~ col items-center justify-center"

                transition="all duration-200 ease-in-out"
                relative min-w-50 w-fit rounded-xl p-4
              >
                <div i-solar:add-circle-line-duotone class="text-2xl text-neutral-500 dark:text-neutral-500" />
                <div
                  class="bg-dotted-neutral-200/80 dark:bg-dotted-neutral-700/50"
                  absolute inset-0 z--1
                  style="background-size: 10px 10px; mask-image: linear-gradient(165deg, white 30%, transparent 50%);"
                />
              </RouterLink>
            </fieldset>
            <div v-else>
              <RouterLink
                class="flex items-center gap-3 rounded-lg p-4"
                border="2 dashed neutral-200 dark:neutral-800"
                bg="neutral-50 dark:neutral-800"
                transition="colors duration-200 ease-in-out"
                to="/settings/providers"
              >
                <div i-solar:warning-circle-line-duotone class="text-2xl text-amber-500 dark:text-amber-400" />
                <div class="flex flex-col">
                  <span class="font-medium">{{ t('settings.pages.modules.hearing.empty.title') }}</span>
                  <span class="text-sm text-neutral-400 dark:text-neutral-500">{{ t('settings.pages.modules.hearing.empty.description') }}</span>
                </div>
                <div i-solar:arrow-right-line-duotone class="ml-auto text-xl text-neutral-400 dark:text-neutral-500" />
              </RouterLink>
            </div>
          </div>
        </div>

        <!-- Model selection section -->
        <div v-if="activeTranscriptionProvider">
          <div flex="~ col gap-4">
            <div>
              <h2 class="text-lg md:text-2xl">
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.title') }}
              </h2>
              <div class="flex flex-col items-start gap-1 text-neutral-400 md:flex-row md:items-center md:justify-between dark:text-neutral-400">
                <span v-if="supportsModelListing && providerModels.length > 0">
                  {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.subtitle') }}
                </span>
                <span v-else>
                  {{ t('settings.pages.modules.hearing.model.manual-description') }}
                </span>
                <span v-if="activeTranscriptionModel" class="text-sm text-neutral-400 font-medium dark:text-neutral-400">{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.current_model_label') }} {{ activeTranscriptionModel }}</span>
              </div>
            </div>

            <!-- Loading state -->
            <div v-if="isLoadingActiveProviderModels && supportsModelListing" class="flex items-center justify-center py-4">
              <div class="mr-2 animate-spin">
                <div i-solar:spinner-line-duotone text-xl />
              </div>
              <span>{{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.loading') }}</span>
            </div>

            <!-- Error state -->
            <template v-else-if="activeProviderModelError && supportsModelListing">
              <ErrorContainer
                :title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.error')"
                :error="activeProviderModelError"
              />

              <div v-if="activeTranscriptionProvider === 'openai-compatible-audio-transcription'" class="mt-2">
                <FieldInput
                  :model-value="activeTranscriptionModel || activeCustomModelName || ''"
                  placeholder="whisper-1"
                  @update:model-value="updateCustomModelName"
                />
              </div>
            </template>

            <!-- Manual input for providers without model listing or when no models are available -->
            <div
              v-else-if="!supportsModelListing || (activeTranscriptionProvider === 'openai-compatible-audio-transcription' && providerModels.length === 0 && !isLoadingActiveProviderModels)"
              class="mt-2"
            >
              <FieldInput
                :model-value="activeTranscriptionModel || activeCustomModelName || ''"
                placeholder="whisper-1"
                @update:model-value="updateCustomModelName"
              />
            </div>

            <!-- No models available (for other providers with model listing but no models) -->
            <Alert
              v-else-if="providerModels.length === 0 && !isLoadingActiveProviderModels && supportsModelListing"
              type="warning"
            >
              <template #title>
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models') }}
              </template>
              <template #content>
                {{ t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_models_description') }}
              </template>
            </Alert>

            <!-- Using the new RadioCardManySelect component for providers with models -->
            <template v-else-if="providerModels.length > 0 && supportsModelListing">
              <RadioCardManySelect
                v-model="activeTranscriptionModel"
                v-model:search-query="transcriptionModelSearchQuery"
                :items="providerModels.sort((a, b) => a.id === activeTranscriptionModel ? -1 : b.id === activeTranscriptionModel ? 1 : 0)"
                :searchable="true"
                :search-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_placeholder')"
                :search-no-results-title="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results')"
                :search-no-results-description="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.no_search_results_description', { query: transcriptionModelSearchQuery })"
                :search-results-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.search_results', { count: '{count}', total: '{total}' })"
                :custom-input-placeholder="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.custom_model_placeholder')"
                :expand-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.expand')"
                :collapse-button-text="t('settings.pages.modules.consciousness.sections.section.provider-model-selection.collapse')"
                @update:custom-value="updateCustomModelName"
              />
            </template>
          </div>
        </div>

        <!-- Auto-send settings -->
        <div class="border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <div class="mb-4">
            <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
              自动发送设置
            </h2>
            <div text="neutral-400 dark:neutral-400">
              配置将转录文本自动发送到聊天的行为
            </div>
          </div>

          <div class="space-y-4">
            <FieldCheckbox
              v-model="autoSendEnabled"
              label="自动发送转录文本"
              description="延迟后自动将转录文本发送到聊天。此操作可能消耗 token；如果你想在发送前手动检查和编辑转录内容，请关闭此选项。"
            />

            <FieldRange
              v-if="autoSendEnabled"
              v-model="autoSendDelay"
              label="自动发送延迟"
              description="自动发送转录文本前的延迟毫秒数（0 = 立即发送，建议 1000-3000 毫秒）"
              :min="0"
              :max="10000"
              :step="100"
              :format-value="value => value === 0 ? '立即' : `${(value / 1000).toFixed(1)} 秒`"
            />
          </div>
        </div>

        <!-- Detection Mode -->
        <div class="border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <div class="mb-4">
            <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-500">
              检测模式
            </h2>
            <div text="neutral-400 dark:neutral-400">
              选择检测语音并触发录音的方式
            </div>
          </div>

          <div flex="~ row gap-4">
            <RadioCardSimple
              id="detection-mode-vad"
              v-model="hearingDetectionMode"
              name="detection-mode"
              value="vad"
              title="VAD（默认）"
              description="使用 AI 语音检测自动开始和停止录音。"
              class="flex-1"
            />
            <RadioCardSimple
              id="detection-mode-manual"
              v-model="hearingDetectionMode"
              name="detection-mode"
              value="manual"
              title="手动（纯麦克风）"
              description="不进行自动检测，手动切换麦克风来录音。"
              class="flex-1"
            />
          </div>
        </div>
      </div>
    </div>

    <div flex="~ col gap-6" class="w-full md:w-[60%]">
      <!-- Audio Monitoring Section -->
      <div w-full rounded-xl>
        <h2 class="mb-4 text-lg text-neutral-500 md:text-2xl dark:text-neutral-400" w-full>
          <div class="inline-flex items-center gap-4">
            <TestDummyMarker />
            <div>
              {{ t('settings.pages.providers.provider.elevenlabs.playground.title') }}
            </div>
          </div>
        </h2>

        <ErrorContainer v-if="error" title="发生错误" :error="error" mb-4 />

        <Button class="mb-4" w-full @click="toggleMonitoring">
          {{ isMonitoring ? '停止监测' : '开始监测' }}
        </Button>

        <div>
          <div v-for="(transcription, index) in transcriptions" :key="index" class="mb-2">
            <audio v-if="audioURLs[index]" :src="audioURLs[index]" controls class="w-full" />
            <div v-if="transcription" class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {{ transcription }}
            </div>
          </div>
        </div>

        <div flex="~ col gap-4">
          <div class="space-y-4">
            <!-- Audio Level Visualization -->
            <div class="space-y-3">
              <!-- Volume Meter -->
              <LevelMeter :level="volumeLevel" label="输入音量" />

              <!-- VAD Probability Meter (when VAD model is active) -->
              <ThresholdMeter
                v-if="useVADModel && loadedVAD"
                :value="isSpeechProb"
                :threshold="useVADThreshold"
                label="语音概率"
                below-label="静音"
                above-label="语音"
                threshold-label="检测阈值"
              />

              <!-- Threshold Controls -->
              <div v-if="useVADModel && loadedVAD" class="space-y-3">
                <FieldRange
                  v-model="useVADThreshold"
                  label="灵敏度"
                  description="调整语音检测阈值"
                  :min="0.1"
                  :max="0.9"
                  :step="0.05"
                  :format-value="value => `${(value * 100).toFixed(0)}%`"
                />
              </div>

              <div v-else class="space-y-3">
                <FieldRange
                  v-model="useVADThreshold"
                  label="灵敏度"
                  description="调整语音检测阈值"
                  :min="1"
                  :max="80"
                  :step="1"
                  :format-value="value => `${value}%`"
                />
              </div>

              <!-- Speaking Indicator -->
              <div class="flex items-center gap-3">
                <div
                  class="h-4 w-4 rounded-full transition-all duration-200"
                  :class="speakingIndicatorClass"
                />
                <span class="text-sm font-medium">
                  {{ isSpeech ? '检测到语音' : '静音' }}
                </span>
                <span class="ml-auto text-xs text-neutral-500">
                  {{ useVADModel && loadedVAD ? '基于模型' : '基于音量' }}
                </span>
              </div>

              <!-- VAD Method Selection -->
              <div class="border-t border-neutral-200 pt-3 dark:border-neutral-700">
                <FieldCheckbox
                  v-model="useVADModel"
                  label="基于模型"
                  description="使用 AI 模型进行更准确的语音检测"
                />

                <!-- VAD Model Status -->
                <div v-if="useVADModel" class="mt-3 space-y-2">
                  <div v-if="loadingVAD" class="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                    <div class="animate-spin text-sm" i-solar:spinner-line-duotone />
                    <span class="text-sm">加载中……</span>
                  </div>

                  <ErrorContainer
                    v-else-if="vadModelError"
                    title="推理错误"
                    :error="vadModelError"
                  />

                  <div v-else-if="loadedVAD" class="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <div class="text-sm" i-solar:check-circle-bold-duotone />
                    <span class="text-sm">已启用</span>
                    <span class="ml-auto text-xs text-neutral-500">
                      概率：{{ (isSpeechProb * 100).toFixed(1) }}%
                    </span>
                  </div>
                </div>
              </div>

              <!-- VAD timeline visualization -->
              <TimeSeriesChart
                v-if="useVADModel && loadedVAD"
                :history="isSpeechHistory"
                :current-value="isSpeechProb"
                :threshold="useVADThreshold"
                :is-active="isSpeech"
                :title="t('settings.pages.modules.hearing.voice-activity.title')"
                :subtitle="t('settings.pages.modules.hearing.voice-activity.subtitle')"
                :active-label="t('settings.pages.modules.hearing.voice-activity.speaking')"
                :active-legend-label="t('settings.pages.modules.hearing.voice-activity.detected')"
                :inactive-legend-label="t('settings.pages.modules.hearing.voice-activity.silence')"
                :threshold-label="t('settings.pages.modules.hearing.voice-activity.threshold')"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Mic Toggle Hotkey (Desktop Only) -->
      <div v-if="isElectron" w-full rounded-xl bg="neutral-50 dark:[rgba(0,0,0,0.3)]" p-4 flex="~ col gap-4">
        <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
          {{ t('settings.pages.modules.hearing.sections.section.hotkey.title') }}
        </h2>
        <div text="sm neutral-400 dark:neutral-500" mb-2>
          {{ t('settings.pages.modules.hearing.sections.section.hotkey.description') }}
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <RadioCardSimple
            id="Scroll"
            v-model="selectedHotkey"
            :name="`mic-toggle-hotkey-${instanceId}`"
            value="Scroll"
            :title="t('settings.pages.modules.hearing.sections.section.hotkey.options.scroll')"
          />
          <RadioCardSimple
            id="Caps"
            v-model="selectedHotkey"
            :name="`mic-toggle-hotkey-${instanceId}`"
            value="Caps"
            :title="t('settings.pages.modules.hearing.sections.section.hotkey.options.caps')"
          />
          <RadioCardSimple
            id="Num"
            v-model="selectedHotkey"
            :name="`mic-toggle-hotkey-${instanceId}`"
            value="Num"
            :title="t('settings.pages.modules.hearing.sections.section.hotkey.options.num')"
          />
        </div>
      </div>

      <!-- Speech-to-Text Test Section -->
      <div w-full rounded-xl bg="neutral-50 dark:[rgba(0,0,0,0.3)]" p-4 flex="~ col gap-4">
        <h2 class="text-lg text-neutral-500 md:text-2xl dark:text-neutral-400">
          语音转文字测试
        </h2>
        <div text="sm neutral-400 dark:neutral-500" mb-2>
          使用所选音频设备测试转录服务，确认语音转文字功能正常工作。
        </div>

        <div v-if="!activeTranscriptionProvider" class="border border-amber-200 rounded-lg bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <div i-solar:warning-circle-line-duotone class="text-lg" />
            <span class="text-sm font-medium">请先在上方选择转录服务来源</span>
          </div>
        </div>

        <div v-else-if="!selectedAudioInput" class="border border-amber-200 rounded-lg bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div class="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <div i-solar:warning-circle-line-duotone class="text-lg" />
            <span class="text-sm font-medium">请先选择音频输入设备</span>
          </div>
        </div>

        <div v-else class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <Button
              :disabled="isTranscribing && !isTestingSTT"
              class="flex-1"
              @click="isTestingSTT ? stopSTTTest() : startSTTTest()"
            >
              <div v-if="isTranscribing" class="mr-2 animate-spin">
                <div i-solar:spinner-line-duotone text-lg />
              </div>
              <div v-else-if="isTestingSTT" class="mr-2">
                <div i-solar:stop-circle-line-duotone text-lg />
              </div>
              <div v-else class="mr-2">
                <div i-solar:microphone-line-duotone text-lg />
              </div>
              {{ isTestingSTT ? '停止测试' : isTranscribing ? '转录中……' : '开始语音转文字测试' }}
            </Button>
          </div>

          <ErrorContainer v-if="testTranscriptionError" title="转录错误" :error="testTranscriptionError" />

          <div v-if="testStatusMessage" class="border border-primary-200 rounded-lg bg-primary-50 p-3 dark:border-primary-800 dark:bg-primary-900/20">
            <div class="flex items-center gap-2 text-primary-700 dark:text-primary-400">
              <div v-if="isTranscribing" class="animate-spin text-sm" i-solar:spinner-line-duotone />
              <div v-else class="text-sm" i-solar:info-circle-line-duotone />
              <span class="text-sm font-medium">{{ testStatusMessage }}</span>
            </div>
          </div>

          <div v-if="shouldUseStreamInput" class="border border-blue-200 rounded-lg bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div class="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <div i-solar:info-circle-line-duotone class="text-sm" />
              <span class="text-xs">流式模式：说话时会实时显示转录内容</span>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <label class="mb-1 block text-sm text-neutral-700 font-medium dark:text-neutral-300">
                转录结果
              </label>
              <div
                v-if="testTranscriptionText || testStreamingText"
                class="min-h-[100px] border border-neutral-200 rounded-lg bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <div v-if="testStreamingText && shouldUseStreamInput" class="text-neutral-600 dark:text-neutral-400">
                  <div class="mb-2 font-medium">
                    当前转录（流式）：
                  </div>
                  <div class="whitespace-pre-wrap">
                    {{ testStreamingText }}
                  </div>
                </div>
                <div v-if="testTranscriptionText" class="text-neutral-700 dark:text-neutral-200">
                  <div v-if="testStreamingText && shouldUseStreamInput" class="mb-2 mt-3 border-t border-neutral-200 pt-2 font-medium dark:border-neutral-700">
                    最终转录：
                  </div>
                  <div class="whitespace-pre-wrap">
                    {{ testTranscriptionText }}
                  </div>
                </div>
              </div>
              <div
                v-else
                class="min-h-[100px] border border-neutral-300 rounded-lg border-dashed bg-neutral-50 p-3 text-sm text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-500"
              >
                尚无转录内容。点击“开始语音转文字测试”，然后对着麦克风说话。
              </div>
            </div>

            <div v-if="activeTranscriptionProvider" class="text-xs text-neutral-500 dark:text-neutral-400">
              <div>服务来源：<span class="font-medium">{{ configuredTranscriptionProvidersMetadata.find(p => p.id === activeTranscriptionProvider)?.localizedName || activeTranscriptionProvider }}</span></div>
              <div v-if="activeTranscriptionModel">
                模型：<span class="font-medium">{{ activeTranscriptionModel }}</span>
              </div>
              <div>模式：<span class="font-medium">{{ shouldUseStreamInput ? '流式（实时）' : '录音（文件）' }}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.hearing.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
</route>

<script setup lang="ts">
import type { VoiceProfile } from '../../../../stores/providers/types'

import {
  FieldCheckbox,
  FieldInput,
  FieldRange,
  Textarea,
} from '@proj-airi/ui'
import { generateSpeech } from '@xsai/generate-speech'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { applyVoiceProfileEffects } from '../../../../composables/audio/audio-effects'
import { useAudioContext } from '../../../../stores/audio'
import { useSpeechStore } from '../../../../stores/modules/speech'
import { useProvidersStore } from '../../../../stores/providers'

const { t } = useI18n()

const providersStore = useProvidersStore()
const speechStore = useSpeechStore()
const { audioContext } = useAudioContext()

const { savedVoiceProfiles } = storeToRefs(speechStore)
const { allAudioSpeechProvidersMetadata } = storeToRefs(providersStore)

// Active selected profile
const activeProfileId = ref<string>('')
const activeProfile = computed(() => savedVoiceProfiles.value.find(p => p.id === activeProfileId.value))

// UI Form State representing the active profile
const form = ref<VoiceProfile>({
  id: '',
  name: '',
  baseProvider: 'speech-noop',
  baseModel: '',
  baseVoice: '',
  effects: {
    pitch: 0,
    rate: 1,
    volume: 100,
    asmr: 0,
    radio: 0,
    robot: 0,
    reverb: 0,
    spatial: 0,
  },
  ust: {
    enabled: true,
    asterisks: 'flatten',
    squareBrackets: 'mute',
    parentheses: 'ignore',
    angleBrackets: 'flatten',
    customBracketEnabled: false,
    customBracketStart: '',
    customBracketEnd: '',
    customBracketAction: 'ignore',
    stripEmojis: true,
    stripSymbols: true,
    tildeReplacement: 'nyan',
    customReplacements: [],
  },
})

// Available options for the form based on selection

const availableModels = ref<any[]>([])
const availableVoices = ref<any[]>([])
const isLoadingModels = ref(false)
const isLoadingVoices = ref(false)

async function loadBaseProviderModelsAndVoices() {
  const providerId = form.value.baseProvider
  if (!providerId || providerId === 'speech-noop') {
    availableModels.value = []
    availableVoices.value = []
    return
  }

  isLoadingModels.value = true
  isLoadingVoices.value = true

  try {
    const models = await providersStore.getModelsForProvider(providerId) || []
    availableModels.value = models

    // Attempt to load and fetch voices for base provider
    const voices = await speechStore.loadVoicesForProvider(providerId) || []
    availableVoices.value = voices
  }
  catch (e) {
    console.error('Failed to load base provider choices:', e)
  }
  finally {
    isLoadingModels.value = false
    isLoadingVoices.value = false
  }
}

watch(() => form.value.baseProvider, () => {
  void loadBaseProviderModelsAndVoices()
})

// Load profile data into form when selected profile changes
watch(activeProfile, (newProfile) => {
  if (newProfile) {
    const loaded = JSON.parse(JSON.stringify(newProfile))

    // Auto-migrate old profiles so the UI lights up
    if (loaded.ust.enabled && !loaded.ust.asterisks && !loaded.ust.squareBrackets) {
      const legacyMode = loaded.ust.mode || 'mute'
      const defaultAction = legacyMode === 'custom' ? 'ignore' : legacyMode

      loaded.ust.asterisks = defaultAction
      loaded.ust.squareBrackets = defaultAction
      loaded.ust.parentheses = defaultAction
      loaded.ust.angleBrackets = defaultAction
      loaded.ust.customBracketEnabled = false
      loaded.ust.customBracketStart = ''
      loaded.ust.customBracketEnd = ''
      loaded.ust.customBracketAction = 'ignore'
      loaded.ust.customReplacements = loaded.ust.customReplacements || []
    }

    form.value = loaded
  }
}, { immediate: true })

// Initialize list
onMounted(async () => {
  const firstReal = savedVoiceProfiles.value.find(p => p.id !== 'voice_profile_auto_preview')
  if (firstReal && !activeProfileId.value) {
    activeProfileId.value = firstReal.id
  }
  else if (!firstReal) {
    createNewProfile()
  }
})

// Actions
function createNewProfile() {
  const id = `voice_profile_${Date.now()}`
  const newProfile: VoiceProfile = {
    id,
    name: t('settings.model-settings.audio-studio.new-profile-name'),
    baseProvider: 'speech-noop',
    baseModel: '',
    baseVoice: '',
    effects: {
      pitch: 0,
      rate: 1,
      volume: 100,
      asmr: 0,
      radio: 0,
      robot: 0,
      reverb: 0,
      spatial: 0,
    },
    ust: {
      enabled: true,
      asterisks: 'flatten',
      squareBrackets: 'mute',
      parentheses: 'ignore',
      angleBrackets: 'flatten',
      customBracketEnabled: false,
      customBracketStart: '',
      customBracketEnd: '',
      customBracketAction: 'ignore',
      stripEmojis: true,
      stripSymbols: true,
      tildeReplacement: 'nyan',
      customReplacements: [],
    },
  }
  speechStore.saveVoiceProfile(newProfile)
  activeProfileId.value = id
}

function addCustomReplacement() {
  if (!form.value.ust.customReplacements) {
    form.value.ust.customReplacements = []
  }
  form.value.ust.customReplacements.push({
    id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'text',
    pattern: '',
    replacement: '',
    caseSensitive: false,
    wholeWord: false,
  })
  saveProfile()
}

function removeCustomReplacement(index: number) {
  if (form.value.ust.customReplacements) {
    form.value.ust.customReplacements.splice(index, 1)
    saveProfile()
  }
}

function saveProfile() {
  if (!form.value.id)
    return
  speechStore.saveVoiceProfile(JSON.parse(JSON.stringify(form.value)))
}

function deleteProfile(id: string) {
  speechStore.deleteVoiceProfile(id)
  const remaining = savedVoiceProfiles.value.filter(p => p.id !== 'voice_profile_auto_preview')
  if (activeProfileId.value === id) {
    activeProfileId.value = remaining[0]?.id || ''
  }
  if (remaining.length === 0) {
    createNewProfile()
  }
}

function duplicateProfile(profile: VoiceProfile) {
  const duplicated: VoiceProfile = JSON.parse(JSON.stringify(profile))
  duplicated.id = `voice_profile_${Date.now()}`
  duplicated.name = t('settings.model-settings.audio-studio.copy-suffix', { name: profile.name })
  speechStore.saveVoiceProfile(duplicated)
  activeProfileId.value = duplicated.id
}

// Playground Logic
const translatedDefaultTestText = computed(() => t('settings.model-settings.audio-studio.playground.default-text'))
const testText = ref(translatedDefaultTestText.value)
watch(translatedDefaultTestText, (nextDefault, previousDefault) => {
  if (testText.value === previousDefault)
    testText.value = nextDefault
})
const isGenerating = ref(false)
const audioUrl = ref('')
let currentPlayNode: AudioBufferSourceNode | null = null
let currentEffectsCleanup: (() => void) | undefined

async function playTestVoice() {
  if (!testText.value.trim() || isGenerating.value)
    return

  isGenerating.value = true

  try {
    stopTestAudio()

    const providerId = form.value.baseProvider
    const model = form.value.baseModel
    const voiceId = form.value.baseVoice

    if (providerId === 'speech-noop' || !model || !voiceId) {
      console.warn('Sandbox requires provider, model, and voice options to be set')
      isGenerating.value = false
      return
    }

    const provider = await providersStore.getProviderInstance(providerId) as any
    const providerConfig = providersStore.getProviderConfig(providerId)

    // Apply the UST text stripping rules configured in our form to the text
    const transformedText = speechStore.transformTextForSpeech(testText.value, 'virtual-audio-studio')

    const response = await generateSpeech({
      ...provider.speech(model, providerConfig),
      input: transformedText,
      voice: voiceId,
    })

    if (!response || response.byteLength === 0) {
      isGenerating.value = false
      return
    }

    // Set downloadable audio source URL
    audioUrl.value = URL.createObjectURL(new Blob([response], { type: 'audio/mpeg' }))

    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    const audioBuffer = await audioContext.decodeAudioData(response.slice(0)) // Slice to clone since decodeAudioData detaches the buffer
    const source = audioContext.createBufferSource()
    source.buffer = audioBuffer
    currentPlayNode = source

    // Connect Xvan's Web Audio API effect nodes
    const effectsResult = applyVoiceProfileEffects(audioContext, source, form.value.effects)
    currentEffectsCleanup = effectsResult.cleanup

    effectsResult.lastNode.connect(audioContext.destination)

    source.start(0)

    source.onended = () => {
      stopTestAudio(false) // Don't clear audioUrl when natural end happens so user can still download/use native controls
    }
  }
  catch (error) {
    console.error('Playground generation error:', error)
  }
  finally {
    isGenerating.value = false
  }
}

function stopTestAudio(clearUrl = true) {
  if (currentPlayNode) {
    try {
      currentPlayNode.stop()
    }
    catch {}
    currentPlayNode = null
  }
  if (currentEffectsCleanup) {
    currentEffectsCleanup()
    currentEffectsCleanup = undefined
  }
  if (clearUrl && audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = ''
  }
}

function formatPan(value: number) {
  if (value === 0)
    return t('settings.model-settings.audio-studio.pan.center')
  return value < 0
    ? t('settings.model-settings.audio-studio.pan.left', { value: Math.abs(value) })
    : t('settings.model-settings.audio-studio.pan.right', { value })
}

function formatBracketAction(action: string) {
  const key = action === 'token' ? 'convert-to-token' : action
  return t(`settings.model-settings.audio-studio.transformer.actions.${key}`)
}

onUnmounted(() => {
  if (audioUrl.value) {
    URL.revokeObjectURL(audioUrl.value)
  }
})
</script>

<template>
  <div flex="~ col lg:row gap-6" class="w-full text-sm">
    <!-- Profile List Sidebar -->
    <div class="min-w-[240px] flex flex-col gap-4 rounded-2xl bg-neutral-100/50 p-4 lg:w-[30%] dark:bg-neutral-900/30">
      <div flex="~ row items-center justify-between">
        <h3 class="text-base text-neutral-500 font-bold dark:text-neutral-400">
          {{ t('settings.model-settings.audio-studio.library') }}
        </h3>
        <button
          class="flex items-center gap-1 border border-neutral-300 rounded-lg bg-neutral-200/50 px-2 py-1 text-xs text-neutral-700 font-medium dark:border-neutral-800 dark:bg-neutral-800/40 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
          @click="createNewProfile"
        >
          <div i-solar:add-circle-bold-duotone />
          <span>{{ t('settings.model-settings.audio-studio.new-profile') }}</span>
        </button>
      </div>

      <div class="max-h-[350px] flex flex-col gap-2 overflow-y-auto lg:max-h-[500px]">
        <div
          v-for="profile in savedVoiceProfiles.filter(p => p.id !== 'voice_profile_auto_preview')"
          :key="profile.id"
          class="group flex cursor-pointer items-center justify-between border rounded-xl p-3 transition-all duration-200"
          :class="[
            activeProfileId === profile.id
              ? 'border-primary-500/50 bg-primary-500/10 text-primary-600 dark:text-primary-400'
              : 'border-neutral-200/70 bg-white/70 dark:border-neutral-800/60 dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40',
          ]"
          @click="activeProfileId = profile.id"
        >
          <div flex="~ col gap-0.5">
            <span class="font-semibold">{{ profile.name }}</span>
            <span class="text-xs opacity-60">{{ profile.baseProvider !== 'speech-noop' ? `${profile.baseProvider} / ${profile.baseVoice}` : t('settings.model-settings.audio-studio.not-bound') }}</span>
          </div>

          <div class="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              class="rounded p-1 hover:bg-neutral-200 dark:hover:bg-neutral-700/60"
              :aria-label="t('settings.model-settings.audio-studio.duplicate-profile', { name: profile.name })"
              @click.stop="duplicateProfile(profile)"
            >
              <div i-solar:copy-bold-duotone class="text-sm text-neutral-400 dark:text-neutral-500" />
            </button>
            <button
              class="rounded p-1 hover:bg-red-500/10"
              :aria-label="t('settings.model-settings.audio-studio.delete-profile', { name: profile.name })"
              @click.stop="deleteProfile(profile.id)"
            >
              <div i-solar:trash-bin-trash-bold-duotone class="text-sm text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Configuration Panels -->
    <div flex="~ col gap-6" class="flex-1">
      <!-- Base Settings Card -->
      <div class="flex flex-col gap-6 rounded-2xl bg-neutral-100/50 p-6 dark:bg-neutral-900/30">
        <div>
          <h3 class="text-base text-neutral-500 font-bold dark:text-neutral-400">
            {{ t('settings.model-settings.audio-studio.profile.title') }}
          </h3>
          <p class="text-xs text-neutral-400 dark:text-neutral-500">
            {{ t('settings.model-settings.audio-studio.profile.description') }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FieldInput
            v-model="form.name"
            :label="t('settings.model-settings.audio-studio.profile.name')"
            :description="t('settings.model-settings.audio-studio.profile.name-description')"
            :placeholder="t('settings.model-settings.audio-studio.profile.name-placeholder')"
            @update:model-value="saveProfile"
          />

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-neutral-500 font-medium dark:text-neutral-400">{{ t('settings.model-settings.audio-studio.profile.base-provider') }}</label>
            <select
              v-model="form.baseProvider"
              class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
              @change="saveProfile"
            >
              <option value="speech-noop">
                {{ t('settings.model-settings.audio-studio.profile.no-provider') }}
              </option>
              <option
                v-for="provider in allAudioSpeechProvidersMetadata.filter(p => p.id !== 'virtual-audio-studio' && p.id !== 'speech-noop')"
                :key="provider.id"
                :value="provider.id"
              >
                {{ provider.name }}
              </option>
            </select>
          </div>

          <div v-if="form.baseProvider !== 'speech-noop'" class="flex flex-col gap-1.5">
            <label class="text-sm text-neutral-500 font-medium dark:text-neutral-400">{{ t('settings.model-settings.audio-studio.profile.model') }}</label>
            <div v-if="isLoadingModels" class="animate-pulse text-xs text-neutral-400">
              {{ t('settings.model-settings.audio-studio.profile.loading-models') }}
            </div>
            <select
              v-else
              v-model="form.baseModel"
              class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
              @change="saveProfile"
            >
              <option value="">
                {{ t('settings.model-settings.audio-studio.profile.select-model') }}
              </option>
              <option
                v-for="model in availableModels"
                :key="model.id"
                :value="model.id"
              >
                {{ model.name || model.id }}
              </option>
            </select>
          </div>

          <div v-if="form.baseProvider !== 'speech-noop'" class="flex flex-col gap-1.5">
            <label class="text-sm text-neutral-500 font-medium dark:text-neutral-400">{{ t('settings.model-settings.audio-studio.profile.voice') }}</label>
            <div v-if="isLoadingVoices" class="animate-pulse text-xs text-neutral-400">
              {{ t('settings.model-settings.audio-studio.profile.loading-voices') }}
            </div>
            <template v-else>
              <!-- Dropdown when the provider can list voices -->
              <select
                v-if="availableVoices.length > 0"
                v-model="form.baseVoice"
                class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
                @change="saveProfile"
              >
                <option value="">
                  {{ t('settings.model-settings.audio-studio.profile.select-voice') }}
                </option>
                <option
                  v-for="voice in availableVoices"
                  :key="voice.id"
                  :value="voice.id"
                >
                  {{ voice.name || voice.id }}
                </option>
              </select>
              <!-- Free-text fallback when voice list couldn't be fetched -->
              <input
                v-else
                v-model="form.baseVoice"
                type="text"
                :placeholder="t('settings.model-settings.audio-studio.profile.manual-voice-placeholder')"
                class="w-full border border-neutral-300 rounded-xl bg-white px-3 py-2 text-sm outline-none dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-900"
                @change="saveProfile"
              >
            </template>
          </div>
        </div>
      </div>

      <!-- Effects Sliders Panel -->
      <div class="flex flex-col gap-6 rounded-2xl bg-neutral-100/50 p-6 dark:bg-neutral-900/30">
        <div>
          <h3 class="text-base text-neutral-500 font-bold dark:text-neutral-400">
            {{ t('settings.model-settings.audio-studio.effects.title') }}
          </h3>
          <p class="text-xs text-neutral-400 dark:text-neutral-500">
            {{ t('settings.model-settings.audio-studio.effects.description') }}
          </p>
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FieldRange
            v-model="form.effects.pitch"
            :label="t('settings.model-settings.audio-studio.effects.pitch.label')"
            :description="t('settings.model-settings.audio-studio.effects.pitch.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
            @update:model-value="saveProfile"
          />

          <FieldRange
            v-model="form.effects.rate"
            :label="t('settings.model-settings.audio-studio.effects.speed.label')"
            :description="t('settings.model-settings.audio-studio.effects.speed.description')"
            :min="0.5"
            :max="2.5"
            :step="0.05"
            :format-value="val => `${val}x`"
            @update:model-value="saveProfile"
          />

          <FieldRange
            v-model="form.effects.asmr"
            :label="t('settings.model-settings.audio-studio.effects.asmr.label')"
            :description="t('settings.model-settings.audio-studio.effects.asmr.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
            @update:model-value="saveProfile"
          />

          <FieldRange
            v-model="form.effects.radio"
            :label="t('settings.model-settings.audio-studio.effects.radio.label')"
            :description="t('settings.model-settings.audio-studio.effects.radio.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
            @update:model-value="saveProfile"
          />

          <FieldRange
            v-model="form.effects.robot"
            :label="t('settings.model-settings.audio-studio.effects.robot.label')"
            :description="t('settings.model-settings.audio-studio.effects.robot.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
            @update:model-value="saveProfile"
          />

          <FieldRange
            v-model="form.effects.reverb"
            :label="t('settings.model-settings.audio-studio.effects.reverb.label')"
            :description="t('settings.model-settings.audio-studio.effects.reverb.description')"
            :min="0"
            :max="100"
            :step="1"
            :format-value="val => `${val}%`"
            @update:model-value="saveProfile"
          />

          <FieldRange
            v-model="form.effects.spatial"
            :label="t('settings.model-settings.audio-studio.effects.panning.label')"
            :description="t('settings.model-settings.audio-studio.effects.panning.description')"
            :min="-100"
            :max="100"
            :step="1"
            :format-value="formatPan"
            @update:model-value="saveProfile"
          />
        </div>
      </div>

      <!-- UST Settings Panel -->
      <div class="flex flex-col gap-6 rounded-2xl bg-neutral-100/50 p-6 dark:bg-neutral-900/30">
        <div flex="~ row items-center justify-between">
          <div>
            <h3 class="text-base text-neutral-500 font-bold dark:text-neutral-400">
              {{ t('settings.model-settings.audio-studio.transformer.title') }}
            </h3>
            <p class="text-xs text-neutral-400 dark:text-neutral-500">
              {{ t('settings.model-settings.audio-studio.transformer.description') }}
            </p>
          </div>
          <FieldCheckbox
            v-model="form.ust.enabled"
            hide-description
            @update:model-value="saveProfile"
          />
        </div>

        <div v-if="form.ust.enabled" class="flex flex-col gap-6">
          <!-- Option A: Bracket-by-Bracket Action Mapper -->
          <div class="flex flex-col gap-3">
            <div class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">
              {{ t('settings.model-settings.audio-studio.transformer.bracket-rules') }}
            </div>
            <div class="grid grid-cols-1 gap-4 border border-neutral-200/60 rounded-xl bg-white p-4 dark:border-neutral-800/60 dark:bg-neutral-900/60">
              <!-- Asterisks -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">{{ t('settings.model-settings.audio-studio.transformer.asterisks') }}</span>
                  <span class="text-[10px] text-neutral-400">{{ t('settings.model-settings.audio-studio.transformer.asterisks-description') }}</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['mute', 'flatten', 'ignore'] as const)"
                    :key="act"
                    type="button"
                    class="border rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all"
                    :class="[
                      form.ust.asterisks === act
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800',
                    ]"
                    @click="form.ust.asterisks = act; saveProfile()"
                  >
                    {{ formatBracketAction(act) }}
                  </button>
                </div>
              </div>

              <!-- Square Brackets -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">{{ t('settings.model-settings.audio-studio.transformer.square-brackets') }}</span>
                  <span class="text-[10px] text-neutral-400">{{ t('settings.model-settings.audio-studio.transformer.square-brackets-description') }}</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['mute', 'flatten', 'ignore', 'token'] as const)"
                    :key="act"
                    type="button"
                    class="border rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all"
                    :class="[
                      form.ust.squareBrackets === act
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800',
                    ]"
                    @click="form.ust.squareBrackets = act; saveProfile()"
                  >
                    {{ formatBracketAction(act) }}
                  </button>
                </div>
              </div>

              <!-- Parentheses -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">{{ t('settings.model-settings.audio-studio.transformer.parentheses') }}</span>
                  <span class="text-[10px] text-neutral-400">{{ t('settings.model-settings.audio-studio.transformer.parentheses-description') }}</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['mute', 'flatten', 'ignore'] as const)"
                    :key="act"
                    type="button"
                    class="border rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all"
                    :class="[
                      form.ust.parentheses === act
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800',
                    ]"
                    @click="form.ust.parentheses = act; saveProfile()"
                  >
                    {{ formatBracketAction(act) }}
                  </button>
                </div>
              </div>

              <!-- Angle Brackets -->
              <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div class="flex flex-col">
                  <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">{{ t('settings.model-settings.audio-studio.transformer.angle-brackets') }}</span>
                  <span class="text-[10px] text-neutral-400">{{ t('settings.model-settings.audio-studio.transformer.angle-brackets-description') }}</span>
                </div>
                <div class="flex gap-1.5">
                  <button
                    v-for="act in (['mute', 'flatten', 'ignore'] as const)"
                    :key="act"
                    type="button"
                    class="border rounded-lg px-2.5 py-1 text-[10px] font-semibold capitalize transition-all"
                    :class="[
                      form.ust.angleBrackets === act
                        ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800',
                    ]"
                    @click="form.ust.angleBrackets = act; saveProfile()"
                  >
                    {{ formatBracketAction(act) }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Bracket Definition -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs text-neutral-700 font-bold dark:text-neutral-300">{{ t('settings.model-settings.audio-studio.transformer.enable-custom-bracket') }}</span>
              <FieldCheckbox
                v-model="form.ust.customBracketEnabled"
                hide-description
                @update:model-value="saveProfile"
              />
            </div>
            <div v-if="form.ust.customBracketEnabled" class="grid grid-cols-3 gap-3 border border-neutral-200/60 rounded-xl bg-white p-4 dark:border-neutral-800/60 dark:bg-neutral-900/60">
              <FieldInput
                v-model="form.ust.customBracketStart"
                :label="t('settings.model-settings.audio-studio.transformer.start-symbol')"
                placeholder="e.g. {"
                @update:model-value="saveProfile"
              />
              <FieldInput
                v-model="form.ust.customBracketEnd"
                :label="t('settings.model-settings.audio-studio.transformer.end-symbol')"
                placeholder="e.g. }"
                @update:model-value="saveProfile"
              />
              <div class="flex flex-col gap-1.5">
                <label class="text-xs text-neutral-500 font-semibold">{{ t('settings.model-settings.audio-studio.transformer.action') }}</label>
                <select
                  v-model="form.ust.customBracketAction"
                  class="w-full border border-neutral-200 rounded-xl bg-white px-3 py-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900 focus:outline-none"
                  @change="saveProfile"
                >
                  <option value="mute">
                    {{ t('settings.model-settings.audio-studio.transformer.actions.mute') }}
                  </option>
                  <option value="flatten">
                    {{ t('settings.model-settings.audio-studio.transformer.actions.flatten') }}
                  </option>
                  <option value="ignore">
                    {{ t('settings.model-settings.audio-studio.transformer.actions.ignore') }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- Emoji, Symbol & Tilde Replacements -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FieldCheckbox
              v-model="form.ust.stripEmojis"
              :label="t('settings.model-settings.audio-studio.transformer.strip-emojis')"
              :description="t('settings.model-settings.audio-studio.transformer.strip-emojis-description')"
              @update:model-value="saveProfile"
            />

            <FieldCheckbox
              v-model="form.ust.stripSymbols"
              :label="t('settings.model-settings.audio-studio.transformer.strip-symbols')"
              :description="t('settings.model-settings.audio-studio.transformer.strip-symbols-description')"
              @update:model-value="saveProfile"
            />

            <FieldInput
              v-model="form.ust.tildeReplacement"
              :label="t('settings.model-settings.audio-studio.transformer.tilde-replacement')"
              :description="t('settings.model-settings.audio-studio.transformer.tilde-replacement-description')"
              placeholder="e.g. nyan"
              @update:model-value="saveProfile"
            />
          </div>

          <!-- Custom Replacement Rules Builder -->
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between border-t border-neutral-200/50 pt-4 dark:border-neutral-800/50">
              <span class="text-sm text-neutral-600 font-semibold dark:text-neutral-300">{{ t('settings.model-settings.audio-studio.transformer.custom-rules') }}</span>
              <button
                type="button"
                class="flex items-center gap-1 border border-primary-500 rounded-lg bg-primary-500/10 px-2 py-1 text-xs text-primary-600 font-semibold hover:bg-primary-500/20 dark:text-primary-400"
                @click="addCustomReplacement"
              >
                <span class="text-xs">{{ t('settings.model-settings.audio-studio.transformer.add-rule') }}</span>
              </button>
            </div>

            <div v-if="form.ust.customReplacements && form.ust.customReplacements.length > 0" class="flex flex-col gap-3">
              <div
                v-for="(rule, index) in form.ust.customReplacements"
                :key="rule.id"
                class="flex flex-col gap-3 border border-neutral-200/60 rounded-xl bg-white p-4 dark:border-neutral-800/60 dark:bg-neutral-900/60"
              >
                <div class="flex items-center justify-between gap-3">
                  <div class="flex gap-1.5">
                    <button
                      type="button"
                      class="border rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all"
                      :class="[
                        rule.type === 'text'
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800',
                      ]"
                      @click="rule.type = 'text'; saveProfile()"
                    >
                      {{ t('settings.model-settings.audio-studio.transformer.rule-type-text') }}
                    </button>
                    <button
                      type="button"
                      class="border rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all"
                      :class="[
                        rule.type === 'regex'
                          ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800',
                      ]"
                      @click="rule.type = 'regex'; saveProfile()"
                    >
                      {{ t('settings.model-settings.audio-studio.transformer.rule-type-regex') }}
                    </button>
                  </div>

                  <button
                    type="button"
                    class="text-[10px] text-red-500 font-bold hover:underline"
                    :aria-label="t('settings.model-settings.audio-studio.transformer.remove-rule', { index: index + 1 })"
                    @click="removeCustomReplacement(index)"
                  >
                    {{ t('settings.model-settings.common.actions.remove') }}
                  </button>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <FieldInput
                    v-model="rule.pattern"
                    :label="t('settings.model-settings.audio-studio.transformer.search-pattern')"
                    :placeholder="rule.type === 'regex' ? 'e.g. /nya/i' : 'e.g. Nya'"
                    @update:model-value="saveProfile"
                  />
                  <FieldInput
                    v-model="rule.replacement"
                    :label="t('settings.model-settings.audio-studio.transformer.replacement')"
                    placeholder="e.g. meow"
                    @update:model-value="saveProfile"
                  />
                </div>

                <div v-if="rule.type === 'text'" class="flex items-center gap-4">
                  <FieldCheckbox
                    v-model="rule.caseSensitive"
                    :label="t('settings.model-settings.audio-studio.transformer.case-sensitive')"
                    hide-description
                    @update:model-value="saveProfile"
                  />
                  <FieldCheckbox
                    v-model="rule.wholeWord"
                    :label="t('settings.model-settings.audio-studio.transformer.whole-word')"
                    hide-description
                    @update:model-value="saveProfile"
                  />
                </div>
              </div>
            </div>
            <p v-else class="py-2 text-center text-xs text-neutral-400 italic">
              {{ t('settings.model-settings.audio-studio.transformer.empty') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Dynamic Test Playground -->
      <div class="flex flex-col gap-4 border border-primary-500/20 rounded-2xl bg-primary-500/5 p-6">
        <div>
          <h3 class="text-base text-primary-600 font-bold dark:text-primary-400">
            {{ t('settings.model-settings.audio-studio.playground.title') }}
          </h3>
          <p class="text-xs text-neutral-400 dark:text-neutral-500">
            {{ t('settings.model-settings.audio-studio.playground.description') }}
          </p>
        </div>

        <Textarea
          v-model="testText"
          h-20
          w-full
          :placeholder="t('settings.model-settings.audio-studio.playground.placeholder')"
        />

        <div flex="~ row gap-3">
          <button
            class="flex items-center gap-2 border border-primary-500 rounded-xl bg-primary-500 px-4 py-2 text-sm text-white font-semibold transition-opacity"
            :disabled="isGenerating || form.baseProvider === 'speech-noop' || !form.baseVoice"
            :class="{ 'opacity-50 cursor-not-allowed': isGenerating || form.baseProvider === 'speech-noop' || !form.baseVoice }"
            @click="playTestVoice"
          >
            <div v-if="isGenerating" class="mr-1 animate-spin">
              <div i-solar:spinner-line-duotone class="text-base" />
            </div>
            <div v-else i-solar:play-circle-bold class="text-base" />
            <span>{{ isGenerating ? t('settings.model-settings.audio-studio.playground.generating') : t('settings.model-settings.audio-studio.playground.test') }}</span>
          </button>

          <button
            class="flex items-center gap-2 border border-neutral-300 rounded-xl bg-transparent px-4 py-2 text-sm text-neutral-500 transition-colors dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="stopTestAudio(true)"
          >
            <div i-solar:stop-circle-bold class="text-base" />
            <span>{{ t('settings.model-settings.audio-studio.playground.stop') }}</span>
          </button>
        </div>

        <div v-if="audioUrl" class="mt-2 flex flex-col gap-2">
          <span class="text-xs text-neutral-400 font-medium dark:text-neutral-500">{{ t('settings.model-settings.audio-studio.playground.generated-file') }}</span>
          <audio :src="audioUrl" controls class="w-full border border-neutral-200 rounded-lg bg-white/50 p-1 dark:border-neutral-800 dark:bg-neutral-900/50" />
        </div>
      </div>
    </div>
  </div>
</template>

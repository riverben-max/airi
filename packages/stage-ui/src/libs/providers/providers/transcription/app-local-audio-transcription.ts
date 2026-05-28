import type { ProviderDefinition } from '../../types'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { z } from 'zod'

import whisperWorkerUrl from '../../../workers/whisper/whisper.worker?worker&url'

import { createWhisperAdapter } from '../../../inference/adapters/whisper'

const localTranscriptionConfigSchema = z.object({})
type LocalTranscriptionConfig = z.input<typeof localTranscriptionConfigSchema>

// Whisper Models list supported locally
export const WHISPER_MODELS = [
  { id: 'onnx-community/whisper-tiny.en', name: 'Whisper Tiny (English)', size: '40MB' },
  { id: 'onnx-community/whisper-base.en', name: 'Whisper Base (English)', size: '80MB' },
  { id: 'onnx-community/whisper-small.en', name: 'Whisper Small (English)', size: '250MB' },
  { id: 'onnx-community/whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo (High Perf)', size: '800MB' },
] as const

export function whisperModelsToModelInfo(models: typeof WHISPER_MODELS) {
  return models.map(m => ({
    id: m.id,
    name: m.name,
    provider: 'app-local-audio-transcription',
    description: `Local Whisper model (${m.size})`,
    contextLength: 0,
    deprecated: false,
  }))
}

// Single adapter instance reused for local transcription
const whisperAdapter = createWhisperAdapter(whisperWorkerUrl)
const loadedModels = new Set<string>()
const loadingPromises = new Map<string, Promise<void>>()

const definition: ProviderDefinition<LocalTranscriptionConfig> = {
  id: 'app-local-audio-transcription',
  name: 'App (Local)',
  nameKey: 'settings.pages.providers.provider.app-local-audio-transcription.title',
  descriptionKey: 'settings.pages.providers.provider.app-local-audio-transcription.description',
  category: 'transcription',
  nameLocalize: ({ t }: { t: any }) => t('settings.pages.providers.provider.app-local-audio-transcription.title'),
  descriptionLocalize: ({ t }: { t: any }) => t('settings.pages.providers.provider.app-local-audio-transcription.description'),
  // @ts-ignore - settingsComponent is dynamic and cross-package
  settingsComponent: () => import('@proj-airi/stage-pages/pages/settings/providers/transcription/app-local-audio-transcription.vue'),
  icon: 'i-lobe-icons:huggingface',
  description: 'Native AI - High-performance local Whisper transcription',
  pricing: 'free',
  deployment: 'local',
  beginnerRecommended: true,
  tasks: ['speech-to-text', 'automatic-speech-recognition', 'asr', 'stt'],
  isAvailableBy: isStageTamagotchi,
  defaultOptions: () => ({}),
  createProviderConfig: () => localTranscriptionConfigSchema as any,
  createProvider: async (_config: LocalTranscriptionConfig) => {
    const transcribe = async (audioInput: any, model: string) => {
      console.group(`[App Local Transcription] Transcribing with model ${model}`)

      const audio = (audioInput && typeof audioInput === 'object' && 'file' in audioInput)
        ? (audioInput as any).file
        : audioInput

      // Ensure model is loaded before transcribing
      if (!loadedModels.has(model)) {
        console.warn(`[App Local Transcription] Model ${model} not loaded. Triggering auto-load...`)
        try {
          const capabilities = definition.capabilities as any
          if (capabilities?.loadModel) {
            await capabilities.loadModel(model)
          }
          else {
            throw new Error('loadModel capability is missing')
          }
        }
        catch (err) {
          console.error(`[App Local Transcription] Auto-load failed:`, err)
          console.groupEnd()
          throw err
        }
      }

      try {
        let audioData: string | ArrayBuffer | Float32Array | undefined

        if (audio instanceof Blob) {
          audioData = await audio.arrayBuffer()
        }
        else if (audio instanceof ArrayBuffer) {
          audioData = audio
        }
        else if (audio instanceof Float32Array) {
          audioData = audio
        }
        else if (typeof audio === 'string') {
          audioData = audio
        }
        else {
          throw new TypeError(`Unsupported audio format: ${audio?.constructor?.name || typeof audio}`)
        }

        const text = await whisperAdapter.transcribe({
          audio: (audioData instanceof ArrayBuffer || typeof audioData === 'string') ? audioData : undefined,
          audioFloat32: audioData instanceof Float32Array ? audioData : undefined,
          language: 'en',
        })

        return { text }
      }
      catch (err) {
        console.error(`[App Local Transcription] Transcription failed:`, err)
        throw err
      }
      finally {
        console.groupEnd()
      }
    }

    return {
      transcription: (model: string) => ({
        provider: 'app-local-audio-transcription',
        model,
        baseURL: 'http://app-local-transcription.invalid',
        fetch: async (input: any, init?: any) => {
          const url = (typeof input === 'string')
            ? input
            : (input instanceof URL)
                ? input.href
                : (input && typeof input === 'object' && 'url' in input)
                    ? input.url
                    : String(input)

          if (url.includes('audio/transcriptions')) {
            console.info('[App Local Transcription] Intercepting transcription request', { url })
            const body = init?.body as any
            const file = body?.get?.('file')
            const result = await transcribe(file, model)
            return new Response(JSON.stringify(result), {
              headers: { 'Content-Type': 'application/json' },
            })
          }
          return globalThis.fetch(input, init)
        },
        transcribe: (audioInput: any) => transcribe(audioInput, model),
      }),
    } as any
  },
  capabilities: {
    listModels: async () => whisperModelsToModelInfo(WHISPER_MODELS as any),
    loadModel: async (_config: any, _provider: any, hooks?: { onProgress?: (progress: any) => void }) => {
      const modelId = WHISPER_MODELS[0].id
      const effectiveModelId = typeof _config === 'string' ? _config : modelId

      if (loadedModels.has(effectiveModelId)) {
        console.info(`[App Local Transcription] Model ${effectiveModelId} already loaded.`)
        return
      }

      if (loadingPromises.has(effectiveModelId)) {
        console.info(`[App Local Transcription] Model ${effectiveModelId} is already loading...`)
        return loadingPromises.get(effectiveModelId)
      }

      console.info(`[App Local Transcription] Starting load for ${effectiveModelId}`)

      const loadPromise = (async () => {
        try {
          await whisperAdapter.load(effectiveModelId, (progress) => {
            if (hooks?.onProgress) {
              hooks.onProgress({ progress: progress.percent / 100 })
            }
          })
          loadedModels.add(effectiveModelId)
          loadingPromises.delete(effectiveModelId)
          console.info(`[App Local Transcription] Model ${effectiveModelId} loaded successfully.`)
        }
        catch (error) {
          loadingPromises.delete(effectiveModelId)
          console.error(`[App Local Transcription] Load failed:`, error)
          throw error
        }
      })()

      loadingPromises.set(effectiveModelId, loadPromise)
      return loadPromise
    },
    transcription: {
      protocol: 'http',
      generateOutput: true,
      streamOutput: false,
      streamInput: false,
    },
  } as any,
  validators: {
    validateProviderConfig: () => ({
      errors: [],
      reason: '',
      valid: true,
    }),
    validateConfig: [],
    validateProvider: [],
  } as any,
} as any

export const appLocalAudioTranscription = definition

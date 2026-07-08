import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useProvidersStore } from '../providers'
import { toSignedPercent, useSpeechStore } from './speech'

vi.mock('../providers', async () => {
  const { defineStore } = await vi.importActual<typeof import('pinia')>('pinia')
  const { computed, reactive } = await vi.importActual<typeof import('vue')>('vue')

  const providerMetadata = reactive<Record<string, any>>({})
  const providers = reactive<Record<string, Record<string, unknown>>>({})
  const providerRuntimeState = reactive<Record<string, { models: any[] }>>({})

  return {
    useProvidersStore: defineStore('providers', () => {
      const allAudioSpeechProvidersMetadata = computed(() => Object.values(providerMetadata))

      function getProviderConfig(providerId: string) {
        return providers[providerId] || {}
      }

      function getProviderMetadata(providerId: string) {
        return providerMetadata[providerId]
      }

      function getModelsForProvider(providerId: string) {
        return providerRuntimeState[providerId]?.models || []
      }

      async function fetchModelsForProvider(_providerId: string) {
        return []
      }

      return {
        allAudioSpeechProvidersMetadata,
        fetchModelsForProvider,
        getModelsForProvider,
        getProviderConfig,
        getProviderMetadata,
        providerMetadata,
        providers,
        isLoadingModels: {},
        modelLoadError: {},
      }
    }),
  }
})

vi.mock('../onboarding', async () => {
  const { defineStore } = await vi.importActual<typeof import('pinia')>('pinia')

  return {
    useOnboardingStore: defineStore('onboarding', () => ({
      needsOnboarding: false,
    })),
  }
})

vi.mock('../proactivity', async () => {
  const { defineStore } = await vi.importActual<typeof import('pinia')>('pinia')

  return {
    useProactivityStore: defineStore('proactivity', () => ({
      incrementMetric: vi.fn(),
    })),
  }
})

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')

  return {
    ...actual,
    onMounted: vi.fn(),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}))

describe('speech store helpers', () => {
  it('formats positive percentages with a plus sign', () => {
    expect(toSignedPercent(25)).toBe('+25%')
  })

  it('formats negative percentages without a double minus', () => {
    expect(toSignedPercent(-20)).toBe('-20%')
    expect(toSignedPercent(-20)).not.toContain('--')
  })

  it('formats zero as 0%', () => {
    expect(toSignedPercent(0)).toBe('0%')
  })
})

describe('speech store voice loading', () => {
  beforeEach(() => {
    setActivePinia(createPinia())

    const providersStore = useProvidersStore()
    for (const key of Object.keys(providersStore.providerMetadata))
      delete providersStore.providerMetadata[key]
    for (const key of Object.keys(providersStore.providers))
      delete providersStore.providers[key]

    providersStore.providerMetadata['speech-noop'] = {
      id: 'speech-noop',
      category: 'speech',
      tasks: ['text-to-speech'],
      nameKey: 'speech-noop',
      name: 'None',
      descriptionKey: 'speech-noop',
      description: 'No speech output.',
      createProvider: async () => ({
        speech: () => ({ baseURL: 'https://example.test/v1', model: 'noop' }),
      }),
      capabilities: {
        listVoices: async () => [],
      },
      validators: {
        validateProviderConfig: () => ({ errors: [], reason: '', valid: true }),
      },
    }
    providersStore.providers['speech-noop'] = {}
  })

  it('passes an explicit selected model when loading provider voices', async () => {
    const providersStore = useProvidersStore()
    const listVoices = vi.fn(async () => [])

    providersStore.providerMetadata['test-speech'] = {
      id: 'test-speech',
      category: 'speech',
      tasks: ['text-to-speech'],
      nameKey: 'test',
      name: 'Test Speech',
      descriptionKey: 'test',
      description: 'Test speech provider',
      createProvider: async () => ({
        speech: () => ({ baseURL: 'https://example.test/v1', model: 'test-model' }),
      }),
      capabilities: {
        listVoices,
      },
      validators: {
        validateProviderConfig: () => ({ errors: [], reason: '', valid: true }),
      },
    }
    providersStore.providers['test-speech'] = {}

    const speechStore = useSpeechStore()

    await speechStore.loadVoicesForProvider('test-speech', 'volcengine/seed-tts-2.0')

    expect(listVoices).toHaveBeenCalledWith({}, 'volcengine/seed-tts-2.0')
  })
})

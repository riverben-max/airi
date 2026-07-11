import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSettingsAudioDevice } from './audio-device'

const audioDeviceMock = vi.hoisted(() => ({
  askPermission: vi.fn(),
  audioInputs: undefined as unknown as { value: MediaDeviceInfo[] },
  selectedAudioInput: undefined as unknown as { value: string },
  startStream: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('@proj-airi/stage-shared/composables', async () => {
  const { ref } = await import('vue')

  return {
    useLocalStorageManualReset: <T>(_key: string, initialValue: T) => {
      const value = ref(initialValue)
      return Object.assign(value, {
        reset: () => {
          value.value = initialValue
        },
      })
    },
  }
})

vi.mock('../audio', async () => {
  const { computed, ref, shallowRef } = await import('vue')
  audioDeviceMock.audioInputs = ref([])
  audioDeviceMock.selectedAudioInput = ref('')

  return {
    useAudioDevice: () => ({
      audioInputs: audioDeviceMock.audioInputs,
      deviceConstraints: computed(() => ({ audio: true })),
      selectedAudioInput: audioDeviceMock.selectedAudioInput,
      selectedAudioInputLabel: computed(() => ''),
      startStream: audioDeviceMock.startStream,
      stopStream: audioDeviceMock.stopStream,
      stream: shallowRef<MediaStream>(),
      askPermission: audioDeviceMock.askPermission,
    }),
  }
})

describe('useSettingsAudioDevice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    audioDeviceMock.audioInputs.value = []
    audioDeviceMock.selectedAudioInput.value = ''
    audioDeviceMock.askPermission.mockReset()
    audioDeviceMock.startStream.mockReset()
    audioDeviceMock.stopStream.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists the microphone selected while refreshing permissions', async () => {
    audioDeviceMock.askPermission.mockImplementation(async () => {
      audioDeviceMock.selectedAudioInput.value = 'microphone-array'
      return true
    })

    const store = useSettingsAudioDevice()

    await store.askPermission()

    expect(store.selectedAudioInput).toBe('microphone-array')
  })
})

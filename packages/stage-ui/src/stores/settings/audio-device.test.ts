import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useSettingsAudioDevice } from './audio-device'

const audioDeviceMock = vi.hoisted(() => ({
  askPermission: vi.fn(),
  audioInputs: undefined as unknown as { value: MediaDeviceInfo[] },
  selectedAudioInput: undefined as unknown as { value: string },
  startStream: vi.fn(),
  stopStream: vi.fn(),
  stream: undefined as unknown as { value: MediaStream | undefined },
}))

const storageMock = vi.hoisted(() => ({
  enabled: false,
  selectedAudioInput: '',
}))

vi.mock('@proj-airi/stage-shared/composables', async () => {
  const { ref } = await import('vue')

  return {
    useLocalStorageManualReset: <T>(_key: string, initialValue: T) => {
      let storedValue = initialValue
      if (typeof initialValue === 'boolean')
        storedValue = storageMock.enabled as T
      else if (typeof initialValue === 'string')
        storedValue = storageMock.selectedAudioInput as T

      const value = ref(storedValue)
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
  audioDeviceMock.stream = shallowRef<MediaStream>()

  return {
    useAudioDevice: () => ({
      audioInputs: audioDeviceMock.audioInputs,
      deviceConstraints: computed(() => ({ audio: true })),
      selectedAudioInput: audioDeviceMock.selectedAudioInput,
      selectedAudioInputLabel: computed(() => ''),
      startStream: audioDeviceMock.startStream,
      stopStream: audioDeviceMock.stopStream,
      stream: audioDeviceMock.stream,
      askPermission: audioDeviceMock.askPermission,
    }),
  }
})

function createAudioInput(deviceId: string, label: string): MediaDeviceInfo {
  return {
    deviceId,
    groupId: 'group-1',
    kind: 'audioinput',
    label,
    toJSON: () => ({}),
  }
}

describe('useSettingsAudioDevice', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    audioDeviceMock.audioInputs.value = []
    audioDeviceMock.selectedAudioInput.value = ''
    audioDeviceMock.stream.value = undefined
    audioDeviceMock.askPermission.mockReset()
    audioDeviceMock.startStream.mockReset()
    audioDeviceMock.startStream.mockImplementation(async () => {
      const mediaStream = {} as MediaStream
      audioDeviceMock.stream.value = mediaStream
      return mediaStream
    })
    audioDeviceMock.stopStream.mockReset()
    audioDeviceMock.stopStream.mockImplementation(() => {
      audioDeviceMock.stream.value = undefined
    })
    storageMock.enabled = false
    storageMock.selectedAudioInput = ''
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persists the microphone selected while refreshing permissions', async () => {
    const microphone = createAudioInput('microphone-array', 'Microphone Array')
    audioDeviceMock.askPermission.mockImplementation(async () => {
      audioDeviceMock.audioInputs.value = [microphone]
      audioDeviceMock.selectedAudioInput.value = 'microphone-array'
      return true
    })

    const store = useSettingsAudioDevice()

    await store.askPermission()

    expect(store.selectedAudioInput).toBe('microphone-array')
  })

  it('initializes the runtime selection from persisted state before refreshing permissions', async () => {
    const persistedMicrophone = createAudioInput('persisted-microphone', 'USB Microphone')
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.askPermission.mockImplementation(async () => {
      audioDeviceMock.audioInputs.value = [persistedMicrophone]
      return true
    })

    const store = useSettingsAudioDevice()

    expect(audioDeviceMock.selectedAudioInput.value).toBe('persisted-microphone')

    await store.askPermission()

    expect(audioDeviceMock.selectedAudioInput.value).toBe('persisted-microphone')
    expect(store.selectedAudioInput).toBe('persisted-microphone')
  })

  it('preserves a hidden persisted selection and does not start a stream when permission is denied', async () => {
    const visibleMicrophone = createAudioInput('visible-microphone', 'Microphone Array')
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [visibleMicrophone]
    audioDeviceMock.askPermission.mockResolvedValue(false)

    const store = useSettingsAudioDevice()

    expect(audioDeviceMock.selectedAudioInput.value).toBe('persisted-microphone')

    await store.askPermission()

    expect(audioDeviceMock.selectedAudioInput.value).toBe('persisted-microphone')
    expect(store.selectedAudioInput).toBe('persisted-microphone')
    expect(audioDeviceMock.startStream).not.toHaveBeenCalled()
  })

  it('does not persist runtime changes from a denied refresh after prior success', async () => {
    const persistedMicrophone = createAudioInput('persisted-microphone', 'USB Microphone')
    const selectedMicrophone = createAudioInput('selected-microphone', 'Microphone Array')
    const deniedMicrophone = createAudioInput('denied-microphone', 'Webcam Microphone')
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [persistedMicrophone, selectedMicrophone, deniedMicrophone]
    audioDeviceMock.askPermission.mockResolvedValueOnce(true)

    const store = useSettingsAudioDevice()
    await store.askPermission()

    audioDeviceMock.selectedAudioInput.value = 'selected-microphone'
    await nextTick()
    expect(store.selectedAudioInput).toBe('selected-microphone')

    audioDeviceMock.startStream.mockClear()
    audioDeviceMock.askPermission.mockImplementationOnce(async () => {
      audioDeviceMock.selectedAudioInput.value = 'denied-microphone'
      return false
    })

    await expect(store.askPermission()).resolves.toBe(false)
    await nextTick()

    expect(store.selectedAudioInput).toBe('selected-microphone')
    expect(audioDeviceMock.startStream).not.toHaveBeenCalled()
  })

  it('awaits one stream start after a successful refresh when persisted audio is enabled', async () => {
    const microphone = createAudioInput('persisted-microphone', 'USB Microphone')
    let resolveStart!: () => void
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [microphone]
    audioDeviceMock.askPermission.mockResolvedValue(true)
    audioDeviceMock.startStream.mockReturnValue(new Promise<void>((resolve) => {
      resolveStart = resolve
    }))

    const store = useSettingsAudioDevice()
    let refreshSettled = false
    const refresh = store.askPermission().then(() => {
      refreshSettled = true
    })
    await Promise.resolve()

    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()
    expect(refreshSettled).toBe(false)

    resolveStart()
    await refresh

    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()
  })

  it('persists a valid fallback while stream startup is pending', async () => {
    const persistedMicrophone = createAudioInput('persisted-microphone', 'USB Microphone')
    const fallbackMicrophone = createAudioInput('fallback-microphone', 'Microphone Array')
    let resolveStart!: () => void
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [persistedMicrophone]
    audioDeviceMock.askPermission.mockResolvedValue(true)
    audioDeviceMock.startStream.mockReturnValue(new Promise<void>((resolve) => {
      resolveStart = resolve
    }))

    const store = useSettingsAudioDevice()
    const refresh = store.askPermission()
    await Promise.resolve()
    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()

    audioDeviceMock.audioInputs.value = [fallbackMicrophone]
    audioDeviceMock.selectedAudioInput.value = 'fallback-microphone'
    await nextTick()

    resolveStart()
    await refresh

    expect(store.selectedAudioInput).toBe('fallback-microphone')
  })

  it('starts the stream once when enabling and refreshing permissions overlap', async () => {
    const microphone = createAudioInput('persisted-microphone', 'USB Microphone')
    let resolveStart!: () => void
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [microphone]
    audioDeviceMock.askPermission.mockResolvedValue(true)
    audioDeviceMock.startStream.mockReturnValue(new Promise<void>((resolve) => {
      resolveStart = () => {
        audioDeviceMock.stream.value = {} as MediaStream
        resolve()
      }
    }))

    const store = useSettingsAudioDevice()
    store.enabled = true
    const refresh = store.askPermission()
    await nextTick()

    resolveStart()
    await refresh

    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()
  })

  it.each(['disable', 'reset'] as const)('clears a late stream when %s happens during startup', async (action) => {
    const microphone = createAudioInput('persisted-microphone', 'USB Microphone')
    let resolveStart!: () => void
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [microphone]
    audioDeviceMock.askPermission.mockResolvedValue(true)
    audioDeviceMock.startStream.mockReturnValue(new Promise<void>((resolve) => {
      resolveStart = () => {
        audioDeviceMock.stream.value = {} as MediaStream
        resolve()
      }
    }))

    const store = useSettingsAudioDevice()
    const refresh = store.askPermission()
    await Promise.resolve()
    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()

    if (action === 'disable')
      store.enabled = false
    else
      store.resetState()
    await nextTick()

    resolveStart()
    await refresh
    await nextTick()

    expect(audioDeviceMock.stream.value).toBeUndefined()
  })

  it.each(['stop', 'reset'] as const)('cancels a pending public stream start when %s is called', async (action) => {
    const lateStream = { id: 'late-stream' } as unknown as MediaStream
    let resolveStart!: () => void
    audioDeviceMock.startStream.mockReturnValue(new Promise<MediaStream>((resolve) => {
      resolveStart = () => {
        audioDeviceMock.stream.value = lateStream
        resolve(lateStream)
      }
    }))

    const store = useSettingsAudioDevice()
    const startRequest = store.startStream()

    if (action === 'stop')
      store.stopStream()
    else
      store.resetState()

    resolveStart()
    const result = await startRequest

    expect({
      result,
      stream: audioDeviceMock.stream.value,
    }).toEqual({
      result: undefined,
      stream: undefined,
    })
  })

  it('restarts after a pending public stream start is stopped', async () => {
    const canceledStream = { id: 'canceled-stream' } as unknown as MediaStream
    const activeStream = { id: 'active-stream' } as unknown as MediaStream
    let resolveCanceledStart!: () => void
    let resolveActiveStart!: () => void
    audioDeviceMock.startStream
      .mockReturnValueOnce(new Promise<MediaStream>((resolve) => {
        resolveCanceledStart = () => {
          audioDeviceMock.stream.value = canceledStream
          resolve(canceledStream)
        }
      }))
      .mockReturnValueOnce(new Promise<MediaStream>((resolve) => {
        resolveActiveStart = () => {
          audioDeviceMock.stream.value = activeStream
          resolve(activeStream)
        }
      }))

    const store = useSettingsAudioDevice()
    const canceledRequest = store.startStream()
    store.stopStream()
    const restartedRequest = store.startStream()

    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()

    resolveCanceledStart()
    await Promise.resolve()
    expect(audioDeviceMock.startStream).toHaveBeenCalledTimes(2)

    resolveActiveStart()
    const [, restartedResult] = await Promise.all([canceledRequest, restartedRequest])

    expect(restartedResult).toBe(activeStream)
    expect(audioDeviceMock.stream.value).toBe(activeStream)
  })

  it('restarts when a canceled public stream start rejects', async () => {
    const staleStartError = new Error('stale start failed')
    const activeStream = { id: 'active-stream' } as unknown as MediaStream
    let rejectCanceledStart!: () => void
    let resolveActiveStart!: () => void
    audioDeviceMock.startStream
      .mockReturnValueOnce(new Promise<MediaStream>((_resolve, reject) => {
        rejectCanceledStart = () => reject(staleStartError)
      }))
      .mockReturnValueOnce(new Promise<MediaStream>((resolve) => {
        resolveActiveStart = () => {
          audioDeviceMock.stream.value = activeStream
          resolve(activeStream)
        }
      }))

    const store = useSettingsAudioDevice()
    const canceledRequest = store.startStream()
    store.stopStream()
    const restartedRequest = store.startStream()
    const sharedResult = Promise.all([canceledRequest, restartedRequest])
    void sharedResult.catch(() => {})

    expect(audioDeviceMock.startStream).toHaveBeenCalledOnce()

    rejectCanceledStart()
    await Promise.resolve()
    expect(audioDeviceMock.startStream).toHaveBeenCalledTimes(2)

    resolveActiveStart()
    await expect(sharedResult).resolves.toEqual([activeStream, activeStream])
    expect(audioDeviceMock.stream.value).toBe(activeStream)
  })

  it('deduplicates concurrent permission workflows and refreshes again after settlement', async () => {
    const microphone = createAudioInput('persisted-microphone', 'USB Microphone')
    let resolvePermission!: (granted: boolean) => void
    let resolveStart!: () => void
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [microphone]
    audioDeviceMock.askPermission.mockReturnValue(new Promise<boolean>((resolve) => {
      resolvePermission = resolve
    }))
    audioDeviceMock.startStream.mockReturnValue(new Promise<void>((resolve) => {
      resolveStart = resolve
    }))

    const store = useSettingsAudioDevice()
    const firstRefresh = store.askPermission()
    const concurrentRefresh = store.askPermission()

    resolvePermission(true)
    await Promise.resolve()
    resolveStart()
    await expect(Promise.all([firstRefresh, concurrentRefresh])).resolves.toEqual([true, true])

    audioDeviceMock.stream.value = {} as MediaStream
    await expect(store.askPermission()).resolves.toBe(true)

    expect({
      permissionCalls: audioDeviceMock.askPermission.mock.calls.length,
      startCalls: audioDeviceMock.startStream.mock.calls.length,
    }).toEqual({
      permissionCalls: 2,
      startCalls: 1,
    })
  })

  it('invalidates an in-flight permission workflow when state is reset', async () => {
    const microphone = createAudioInput('runtime-microphone', 'USB Microphone')
    let resolvePermission!: (granted: boolean) => void
    storageMock.enabled = true
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.askPermission.mockReturnValue(new Promise<boolean>((resolve) => {
      resolvePermission = resolve
    }))

    const store = useSettingsAudioDevice()
    const refresh = store.askPermission()
    audioDeviceMock.audioInputs.value = [microphone]
    audioDeviceMock.selectedAudioInput.value = 'runtime-microphone'
    await nextTick()

    store.resetState()
    resolvePermission(true)
    const result = await refresh

    audioDeviceMock.selectedAudioInput.value = 'runtime-microphone'
    await nextTick()

    expect({
      persistedSelection: store.selectedAudioInput,
      result,
      startCalls: audioDeviceMock.startStream.mock.calls.length,
    }).toEqual({
      persistedSelection: '',
      result: false,
      startCalls: 0,
    })
  })

  it('keeps a newer permission request cached when a stale request settles', async () => {
    let resolveStalePermission!: (granted: boolean) => void
    let resolveCurrentPermission!: (granted: boolean) => void
    audioDeviceMock.askPermission
      .mockReturnValueOnce(new Promise<boolean>((resolve) => {
        resolveStalePermission = resolve
      }))
      .mockReturnValueOnce(new Promise<boolean>((resolve) => {
        resolveCurrentPermission = resolve
      }))

    const store = useSettingsAudioDevice()
    const staleRefresh = store.askPermission()
    store.resetState()
    const currentRefresh = store.askPermission()

    expect(audioDeviceMock.askPermission).toHaveBeenCalledTimes(2)

    resolveStalePermission(true)
    await expect(staleRefresh).resolves.toBe(false)

    const concurrentCurrentRefresh = store.askPermission()
    expect(audioDeviceMock.askPermission).toHaveBeenCalledTimes(2)

    resolveCurrentPermission(false)
    await expect(Promise.all([currentRefresh, concurrentCurrentRefresh])).resolves.toEqual([false, false])
  })

  it('allows a permission workflow retry after a rejection', async () => {
    const microphone = createAudioInput('persisted-microphone', 'USB Microphone')
    const permissionError = new Error('permission failed')
    storageMock.selectedAudioInput = 'persisted-microphone'
    audioDeviceMock.audioInputs.value = [microphone]
    audioDeviceMock.askPermission
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(true)

    const store = useSettingsAudioDevice()

    await expect(store.askPermission()).rejects.toBe(permissionError)
    await expect(store.askPermission()).resolves.toBe(true)

    expect(audioDeviceMock.askPermission).toHaveBeenCalledTimes(2)
  })

  it('persists a valid runtime fallback after a successful permission refresh', async () => {
    const fallbackMicrophone = createAudioInput('fallback-microphone', 'Microphone Array')
    storageMock.selectedAudioInput = 'disconnected-microphone'
    audioDeviceMock.audioInputs.value = [fallbackMicrophone]
    audioDeviceMock.askPermission.mockResolvedValue(true)

    const store = useSettingsAudioDevice()

    expect(store.selectedAudioInput).toBe('disconnected-microphone')

    await store.askPermission()
    audioDeviceMock.selectedAudioInput.value = 'fallback-microphone'
    await nextTick()

    expect(store.selectedAudioInput).toBe('fallback-microphone')
  })
})

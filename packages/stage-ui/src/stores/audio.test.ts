import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const audioDeviceMock = vi.hoisted(() => ({
  devices: undefined as unknown as { value: MediaDeviceInfo[] },
  permissionGranted: undefined as unknown as { value: boolean },
  ensurePermissions: vi.fn(),
  enumerateDevices: vi.fn(),
  startStream: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('@vueuse/core', async () => {
  const { computed, ref, shallowRef } = await import('vue')

  return {
    useDevicesList: () => {
      const devices = ref<MediaDeviceInfo[]>([])
      const permissionGranted = shallowRef(false)
      audioDeviceMock.devices = devices
      audioDeviceMock.permissionGranted = permissionGranted

      return {
        devices,
        audioInputs: computed(() => devices.value.filter(device => device.kind === 'audioinput')),
        permissionGranted,
        ensurePermissions: async () => {
          const granted = await audioDeviceMock.ensurePermissions()
          permissionGranted.value = granted
          return granted
        },
      }
    },
    useUserMedia: () => ({
      stream: shallowRef<MediaStream>(),
      start: audioDeviceMock.startStream,
      stop: audioDeviceMock.stopStream,
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

describe('useAudioDevice', () => {
  beforeEach(() => {
    vi.resetModules()
    audioDeviceMock.ensurePermissions.mockReset()
    audioDeviceMock.enumerateDevices.mockReset()
    audioDeviceMock.startStream.mockReset()
    audioDeviceMock.stopStream.mockReset()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: audioDeviceMock.enumerateDevices,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('refreshes and selects audio inputs when permission was already granted', async () => {
    const microphone = createAudioInput('microphone-array', 'Microphone Array')
    audioDeviceMock.ensurePermissions.mockResolvedValue(true)
    audioDeviceMock.enumerateDevices.mockResolvedValue([microphone])

    const { useAudioDevice } = await import('./audio')
    const { askPermission, audioInputs, selectedAudioInput } = useAudioDevice()

    expect(audioInputs.value).toEqual([])

    await askPermission()

    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledOnce()
    expect(audioInputs.value).toEqual([microphone])
    expect(selectedAudioInput.value).toBe('microphone-array')
  })

  it('preserves the selected input when a granted refresh still enumerates it', async () => {
    const persistedMicrophone = createAudioInput('persisted-microphone', 'USB Microphone')
    const fallbackMicrophone = createAudioInput('fallback-microphone', 'Microphone Array')
    audioDeviceMock.ensurePermissions.mockResolvedValue(true)
    audioDeviceMock.enumerateDevices.mockResolvedValue([fallbackMicrophone, persistedMicrophone])

    const { useAudioDevice } = await import('./audio')
    const { askPermission, selectedAudioInput } = useAudioDevice()
    selectedAudioInput.value = 'persisted-microphone'

    await askPermission()

    expect(selectedAudioInput.value).toBe('persisted-microphone')
  })

  it('confirms a late missing-device list before replacing a persisted input', async () => {
    const persistedMicrophone = createAudioInput('persisted-microphone', 'USB Microphone')
    const fallbackMicrophone = createAudioInput('fallback-microphone', 'Microphone Array')
    let resolveConfirmation!: (devices: MediaDeviceInfo[]) => void
    audioDeviceMock.ensurePermissions.mockResolvedValue(true)
    audioDeviceMock.enumerateDevices
      .mockResolvedValueOnce([fallbackMicrophone, persistedMicrophone])
      .mockReturnValueOnce(new Promise<MediaDeviceInfo[]>((resolve) => {
        resolveConfirmation = resolve
      }))

    const { useAudioDevice } = await import('./audio')
    const { askPermission, audioInputs, selectedAudioInput } = useAudioDevice()
    selectedAudioInput.value = 'persisted-microphone'
    await askPermission()

    audioDeviceMock.devices.value = [fallbackMicrophone]
    await nextTick()

    expect(selectedAudioInput.value).toBe('persisted-microphone')
    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledTimes(2)

    audioDeviceMock.devices.value = [fallbackMicrophone]
    await nextTick()
    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledTimes(2)

    resolveConfirmation([fallbackMicrophone, persistedMicrophone])
    await vi.waitFor(() => {
      expect(audioInputs.value).toEqual([fallbackMicrophone, persistedMicrophone])
      expect(selectedAudioInput.value).toBe('persisted-microphone')
    })
  })

  it('replaces a missing selected input after a granted refresh', async () => {
    const fallbackMicrophone = createAudioInput('fallback-microphone', 'Microphone Array')
    audioDeviceMock.ensurePermissions.mockResolvedValue(true)
    audioDeviceMock.enumerateDevices.mockResolvedValue([fallbackMicrophone])

    const { useAudioDevice } = await import('./audio')
    const { askPermission, selectedAudioInput } = useAudioDevice()
    selectedAudioInput.value = 'disconnected-microphone'

    await askPermission()

    expect(selectedAudioInput.value).toBe('fallback-microphone')
  })

  it('does not replace a hidden selected input before permission is granted', async () => {
    const visibleMicrophone = createAudioInput('visible-microphone', 'Microphone Array')
    const { useAudioDevice } = await import('./audio')
    const { selectedAudioInput } = useAudioDevice()
    selectedAudioInput.value = 'persisted-microphone'

    audioDeviceMock.devices.value = [visibleMicrophone]
    await nextTick()

    expect(selectedAudioInput.value).toBe('persisted-microphone')
  })

  it('does not trust a stale eager enumeration before a granted refresh completes', async () => {
    const staleMicrophone = createAudioInput('stale-microphone', 'Microphone Array')
    const { useAudioDevice } = await import('./audio')
    const { selectedAudioInput } = useAudioDevice()
    selectedAudioInput.value = 'persisted-microphone'

    audioDeviceMock.permissionGranted.value = true
    audioDeviceMock.devices.value = [staleMicrophone]
    await nextTick()

    expect(selectedAudioInput.value).toBe('persisted-microphone')
  })

  it('falls back when the selected input disappears after permission is granted', async () => {
    const selectedMicrophone = createAudioInput('selected-microphone', 'USB Microphone')
    const fallbackMicrophone = createAudioInput('fallback-microphone', 'Microphone Array')
    audioDeviceMock.ensurePermissions.mockResolvedValue(true)
    audioDeviceMock.enumerateDevices
      .mockResolvedValueOnce([selectedMicrophone, fallbackMicrophone])
      .mockResolvedValueOnce([fallbackMicrophone])

    const { useAudioDevice } = await import('./audio')
    const { askPermission, selectedAudioInput } = useAudioDevice()
    await askPermission()
    selectedAudioInput.value = 'selected-microphone'

    audioDeviceMock.devices.value = [fallbackMicrophone]
    await vi.waitFor(() => {
      expect(selectedAudioInput.value).toBe('fallback-microphone')
    })

    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledTimes(2)
  })

  it('shares an in-flight permission refresh and refreshes again after it settles', async () => {
    const microphone = createAudioInput('microphone-array', 'Microphone Array')
    let resolvePermission!: (granted: boolean) => void
    audioDeviceMock.ensurePermissions.mockReturnValue(new Promise<boolean>((resolve) => {
      resolvePermission = resolve
    }))
    audioDeviceMock.enumerateDevices.mockResolvedValue([microphone])

    const { useAudioDevice } = await import('./audio')
    const { askPermission } = useAudioDevice()
    const firstRefresh = askPermission()
    const concurrentRefresh = askPermission()

    expect(audioDeviceMock.ensurePermissions).toHaveBeenCalledOnce()
    resolvePermission(true)
    await expect(Promise.all([firstRefresh, concurrentRefresh])).resolves.toEqual([true, true])
    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledOnce()

    await askPermission()

    expect(audioDeviceMock.ensurePermissions).toHaveBeenCalledTimes(2)
    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledTimes(2)
  })

  it('allows a permission refresh retry after a rejection', async () => {
    const microphone = createAudioInput('microphone-array', 'Microphone Array')
    const permissionError = new Error('permission failed')
    audioDeviceMock.ensurePermissions
      .mockRejectedValueOnce(permissionError)
      .mockResolvedValueOnce(true)
    audioDeviceMock.enumerateDevices.mockResolvedValue([microphone])
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { useAudioDevice } = await import('./audio')
    const { askPermission } = useAudioDevice()

    await expect(askPermission()).rejects.toBe(permissionError)
    await expect(askPermission()).resolves.toBe(true)

    expect(audioDeviceMock.ensurePermissions).toHaveBeenCalledTimes(2)
    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledOnce()
  })
})

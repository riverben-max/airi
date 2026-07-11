import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audioDeviceMock = vi.hoisted(() => ({
  devices: undefined as unknown as { value: MediaDeviceInfo[] },
  ensurePermissions: vi.fn(),
  enumerateDevices: vi.fn(),
  startStream: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('@vueuse/core', async () => {
  const { computed, ref, shallowRef } = await import('vue')
  audioDeviceMock.devices = ref([])

  return {
    useDevicesList: () => ({
      devices: audioDeviceMock.devices,
      audioInputs: computed(() => audioDeviceMock.devices.value.filter(device => device.kind === 'audioinput')),
      ensurePermissions: audioDeviceMock.ensurePermissions,
    }),
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
    if (audioDeviceMock.devices)
      audioDeviceMock.devices.value = []
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
})

import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { onMounted, watch } from 'vue'

import { useAudioDevice } from '../audio'

export const useSettingsAudioDevice = defineStore('settings-audio-devices', () => {
  const {
    audioInputs,
    deviceConstraints,
    selectedAudioInput: selectedAudioInputNonPersist,
    selectedAudioInputLabel,
    startStream: startRawStream,
    stopStream: stopRawStream,
    stream,
    askPermission: askAudioInputPermission,
  } = useAudioDevice()

  const selectedAudioInputPersist = useLocalStorageManualReset<string>('settings/audio/input', selectedAudioInputNonPersist.value)
  const selectedAudioInputEnabledPersist = useLocalStorageManualReset<boolean>('settings/audio/input/enabled', false)
  let canPersistRuntimeSelection = false
  let isPermissionRefreshInProgress = false
  let permissionGeneration = 0

  function hasValidRuntimeSelection() {
    return !!selectedAudioInputNonPersist.value
      && audioInputs.value.some(device => device.deviceId === selectedAudioInputNonPersist.value)
  }

  function syncRuntimeSelectionToPersisted() {
    if (hasValidRuntimeSelection() && selectedAudioInputPersist.value !== selectedAudioInputNonPersist.value)
      selectedAudioInputPersist.value = selectedAudioInputNonPersist.value
  }

  let streamDesired = false
  let streamGeneration = 0

  async function runStreamStartLoop() {
    while (streamDesired) {
      const generation = streamGeneration
      let startedStream: Awaited<ReturnType<typeof startRawStream>>
      try {
        startedStream = await startRawStream()
      }
      catch (error) {
        if (generation === streamGeneration)
          throw error
        if (streamDesired)
          continue

        return undefined
      }

      if (!streamDesired || generation !== streamGeneration) {
        stopRawStream()
        if (streamDesired)
          continue

        return undefined
      }

      return startedStream
    }

    return undefined
  }

  let streamStartRequest: ReturnType<typeof startRawStream> | undefined
  function startStream() {
    if (!streamDesired) {
      streamDesired = true
      streamGeneration += 1
    }

    if (!streamStartRequest) {
      const trackedRequest = runStreamStartLoop().finally(() => {
        if (streamStartRequest === trackedRequest)
          streamStartRequest = undefined
      })
      streamStartRequest = trackedRequest
    }

    return streamStartRequest
  }

  function stopStream() {
    streamDesired = false
    streamGeneration += 1
    stopRawStream()
  }

  async function startStreamWhileEnabled() {
    if (!selectedAudioInputEnabledPersist.value)
      return

    await startStream()
    if (!selectedAudioInputEnabledPersist.value)
      stopStream()
  }

  function startStreamWhileEnabledInBackground() {
    void startStreamWhileEnabled().catch((error) => {
      console.error('Error starting audio input stream:', error)
    })
  }

  async function refreshPermission(generation: number) {
    const granted = await askAudioInputPermission()
    if (!granted || generation !== permissionGeneration)
      return false

    canPersistRuntimeSelection = true
    syncRuntimeSelectionToPersisted()
    isPermissionRefreshInProgress = false

    if (selectedAudioInputEnabledPersist.value && !stream.value && hasValidRuntimeSelection())
      await startStreamWhileEnabled()

    return generation === permissionGeneration
  }

  let permissionRequest: Promise<boolean> | undefined
  function askPermission() {
    if (!permissionRequest) {
      const generation = permissionGeneration
      isPermissionRefreshInProgress = true
      const trackedRequest = refreshPermission(generation).finally(() => {
        if (permissionRequest === trackedRequest) {
          isPermissionRefreshInProgress = false
          permissionRequest = undefined
        }
      })
      permissionRequest = trackedRequest
    }

    return permissionRequest
  }

  watch(selectedAudioInputPersist, (newValue) => {
    selectedAudioInputNonPersist.value = newValue
  }, { immediate: true })

  watch(selectedAudioInputNonPersist, () => {
    if (canPersistRuntimeSelection && !isPermissionRefreshInProgress)
      syncRuntimeSelectionToPersisted()
  })

  watch(selectedAudioInputEnabledPersist, (val) => {
    if (val) {
      startStreamWhileEnabledInBackground()
    }
    else {
      stopStream()
    }
  })

  onMounted(() => {
    const hasSelectedInput = selectedAudioInputPersist.value
      && audioInputs.value.some(device => device.deviceId === selectedAudioInputPersist.value)

    if (selectedAudioInputEnabledPersist.value && hasSelectedInput) {
      startStreamWhileEnabledInBackground()
    }
    if (selectedAudioInputNonPersist.value && !selectedAudioInputEnabledPersist.value) {
      selectedAudioInputPersist.value = selectedAudioInputNonPersist.value
    }
  })

  function resetState() {
    permissionGeneration += 1
    canPersistRuntimeSelection = false
    isPermissionRefreshInProgress = false
    permissionRequest = undefined
    selectedAudioInputPersist.reset()
    selectedAudioInputNonPersist.value = ''
    selectedAudioInputEnabledPersist.reset()
    stopStream()
  }

  return {
    audioInputs,
    deviceConstraints,
    selectedAudioInput: selectedAudioInputPersist,
    selectedAudioInputLabel,
    enabled: selectedAudioInputEnabledPersist,

    stream,

    askPermission,
    startStream,
    stopStream,
    resetState,
  }
})

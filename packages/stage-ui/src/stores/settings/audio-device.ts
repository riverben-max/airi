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
    startStream,
    stopStream,
    stream,
    askPermission: askAudioInputPermission,
  } = useAudioDevice()

  const selectedAudioInputPersist = useLocalStorageManualReset<string>('settings/audio/input', selectedAudioInputNonPersist.value)
  const selectedAudioInputEnabledPersist = useLocalStorageManualReset<boolean>('settings/audio/input/enabled', false)

  async function askPermission() {
    const granted = await askAudioInputPermission()
    if (selectedAudioInputNonPersist.value && selectedAudioInputPersist.value !== selectedAudioInputNonPersist.value)
      selectedAudioInputPersist.value = selectedAudioInputNonPersist.value

    return granted
  }

  watch(selectedAudioInputPersist, (newValue) => {
    selectedAudioInputNonPersist.value = newValue
  })

  watch(selectedAudioInputEnabledPersist, (val) => {
    if (val) {
      startStream()
    }
    else {
      stopStream()
    }
  })

  onMounted(() => {
    const hasSelectedInput = selectedAudioInputPersist.value
      && audioInputs.value.some(device => device.deviceId === selectedAudioInputPersist.value)

    if (selectedAudioInputEnabledPersist.value && hasSelectedInput) {
      startStream()
    }
    if (selectedAudioInputNonPersist.value && !selectedAudioInputEnabledPersist.value) {
      selectedAudioInputPersist.value = selectedAudioInputNonPersist.value
    }
  })

  function resetState() {
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

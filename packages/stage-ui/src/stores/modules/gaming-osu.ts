import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'
import { computed } from 'vue'

import { useConfiguratorByModsChannelServer } from '../configurator'

export const useOsuStore = defineStore('osu', () => {
  const configurator = useConfiguratorByModsChannelServer()

  const enabled = useLocalStorageManualReset<boolean>('settings/osu/enabled', false)
  const serverAddress = useLocalStorageManualReset<string>('settings/osu/server-address', '')
  const serverPort = useLocalStorageManualReset<number | null>('settings/osu/server-port', 24050)
  const username = useLocalStorageManualReset<string>('settings/osu/username', '')
  const playMode = useLocalStorageManualReset<'memory' | 'visual'>('settings/osu/play-mode', 'memory')

  function saveSettings() {
    configurator.updateFor('osu', {
      enabled: enabled.value,
      serverAddress: serverAddress.value,
      serverPort: serverPort.value,
      username: username.value,
      playMode: playMode.value,
    })
  }

  function resetState() {
    enabled.reset()
    serverAddress.reset()
    serverPort.reset()
    username.reset()
    playMode.reset()
    saveSettings()
  }

  const configured = computed(() => {
    return !!(serverAddress.value.trim() && username.value.trim() && serverPort.value !== null)
  })

  return { enabled, serverAddress, serverPort, username, playMode, configured, saveSettings, resetState }
})

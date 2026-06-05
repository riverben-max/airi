<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Select } from '@proj-airi/ui/components/form'

import GamingModuleSettings from './GamingModuleSettings.vue'
import { useOsuStore } from '../../stores/modules/gaming-osu'

const osuStore = useOsuStore()
const { playMode } = storeToRefs(osuStore)


const playModeOptions = [
  { value: 'memory', label: 'Beatmap Parsing (Memory/File)' },
  { value: 'visual', label: 'Visual Model (YOLO/OpenCV)' }
]
</script>

<template>
  <GamingModuleSettings
    :store="osuStore"
    i18n-key-prefix="settings.pages.modules.gaming-osu"
  >
    <div :class="['flex', 'flex-col', 'gap-2']">
      <label :class="['flex', 'flex-row', 'items-center', 'gap-2', 'text-sm', 'text-neutral-500', 'dark:text-neutral-400']">
        <div i-lucide:eye />
        Play Mode
      </label>
      <Select
        v-model="playMode"
        :options="playModeOptions"
        placeholder="Select the bot interaction mode"
        class="w-full"
      />
      <div class="text-xs text-neutral-400">
        {{ playMode === 'visual' ? 'Uses Computer Vision (YOLO/OpenCV) to play by watching the screen.' : 'Parses memory/files directly for absolute accuracy.' }}
      </div>
    </div>
  </GamingModuleSettings>
</template>

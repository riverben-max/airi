<script setup lang="ts">
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

import { Button } from '@proj-airi/ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSyncEngineStore } from '../../../../stores/sync-engine'

interface Props {
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}

interface SyncLogDescriptor {
  key: string
  params?: Record<string, string | number>
}

const props = defineProps<Props>()
const { t } = useI18n()

const progress = ref(0)
const logs = ref<SyncLogDescriptor[]>([])
const syncComplete = ref(false)

const logPool: SyncLogDescriptor[] = [
  { key: 'settings.dialogs.onboarding.sync-progress.logs.connecting' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.fetching-metadata' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.downloading-data' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.applying-migrations' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.verifying-schema' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.retrieving-characters' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.downloading-assets' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.decompressing-assets' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.synchronizing-vectors' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.reindexing-search' },
  { key: 'settings.dialogs.onboarding.sync-progress.logs.restoration-complete' },
]

let intervalId: any

onMounted(() => {
  logs.value.push(logPool[0])

  intervalId = setInterval(() => {
    if (progress.value < 90) {
      progress.value += Math.floor(Math.random() * 8) + 4
      if (progress.value > 90)
        progress.value = 90

      // Add logs at different milestones
      const poolIndex = Math.floor((progress.value / 100) * logPool.length)
      if (poolIndex < logPool.length && !logs.value.some(log => log.key === logPool[poolIndex].key)) {
        logs.value.push(logPool[poolIndex])
      }
    }
  }, 350)

  // Start real restore process
  void (async () => {
    try {
      const syncStore = useSyncEngineStore()
      // Enable sync
      syncStore.syncEnabled = true

      // Also enable remoteSyncEnabled in general settings so useAuthStore fetches active user profile
      const { useSettingsGeneral } = await import('../../../../stores/settings')
      const settings = useSettingsGeneral()
      settings.remoteSyncEnabled = true

      // Perform force restore from remote setup
      const success = await syncStore.forceRestoreFromRemote({ skipReload: true })
      if (success) {
        logs.value.push({ key: 'settings.dialogs.onboarding.sync-progress.logs.storage-updated' })
      }
      else {
        logs.value.push({ key: 'settings.dialogs.onboarding.sync-progress.logs.completed-with-warnings' })
      }
    }
    catch (e: any) {
      console.error('[StepSyncProgress] Failed to restore from cloud:', e)
      logs.value.push({
        key: 'settings.dialogs.onboarding.sync-progress.logs.restore-error',
        params: { error: e.message || String(e) },
      })
    }
    finally {
      if (intervalId) {
        clearInterval(intervalId)
      }
      progress.value = 100
      syncComplete.value = true
    }
  })()
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})

function handleFinish() {
  props.onNext()
}

function localizeLog(log: SyncLogDescriptor) {
  return t(log.key, log.params ?? {})
}
</script>

<template>
  <div class="h-full flex flex-col gap-6 font-sans">
    <!-- Header -->
    <div
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      class="flex items-center gap-2"
    >
      <div class="flex-1 text-center text-xl text-neutral-800 font-semibold md:text-left md:text-2xl dark:text-neutral-100">
        {{ t('settings.dialogs.onboarding.sync-progress.title') }}
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex flex-1 flex-col justify-center gap-6 overflow-y-auto px-1">
      <!-- Progress Ring/Bar -->
      <div class="flex flex-col items-center gap-4 text-center">
        <div class="relative h-3 w-full overflow-hidden border border-neutral-200/40 rounded-full bg-neutral-100 dark:border-neutral-800/40 dark:bg-neutral-900">
          <div
            class="h-full rounded-full from-primary-500 via-indigo-500 to-purple-500 bg-gradient-to-r transition-all duration-300 ease-out"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <div class="w-full flex justify-between text-xs text-neutral-500 font-mono">
          <span>{{ syncComplete ? t('settings.dialogs.onboarding.sync-progress.complete') : t('settings.dialogs.onboarding.sync-progress.syncing') }}</span>
          <span>{{ progress }}%</span>
        </div>
      </div>

      <!-- Simulated Logs -->
      <div class="max-h-[180px] flex flex-1 flex-col gap-1.5 overflow-y-auto border border-neutral-200/50 rounded-xl bg-black/5 p-4 text-xs text-neutral-600 font-mono scrollbar-none dark:border-neutral-800/50 dark:bg-black/35 dark:text-neutral-400">
        <div v-for="(log, idx) in logs" :key="idx" class="flex gap-2">
          <span class="text-neutral-400 dark:text-neutral-600">[{{ 100 + idx }}]</span>
          <span :class="{ 'text-primary-500 dark:text-primary-400 font-bold': idx === logs.length - 1 && !syncComplete, 'text-emerald-500 font-bold': idx === logs.length - 1 && syncComplete }">
            {{ localizeLog(log) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Footer Action -->
    <Button
      v-motion
      :initial="{ opacity: 0, y: 10 }"
      :enter="{ opacity: 1, y: 0 }"
      :duration="400"
      :delay="300"
      :disabled="!syncComplete"
      :label="t('settings.dialogs.onboarding.sync-progress.finish')"
      @click="handleFinish"
    />
  </div>
</template>

<script setup lang="ts">
import type { OnboardingStepNextHandler, OnboardingStepPrevHandler } from './types'

import { Button } from '@proj-airi/ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSyncEngineStore } from '../../../../stores/sync-engine'

interface Props {
  onNext: OnboardingStepNextHandler
  onPrevious: OnboardingStepPrevHandler
}

const props = defineProps<Props>()
const isSearching = ref(true)
const simulateEmpty = ref(false)

interface BackupTarget {
  id: string
  name: string
  provider: 'amazon-s3' | 'cloudflare-r2' | 'local'
  icon: string
  lastSync: string
  size: 'local' | 's3'
  region?: string
}

const backups = ref<BackupTarget[]>([])
const selectedBackupId = ref('')

const syncStore = useSyncEngineStore()
const { locale, t } = useI18n()

// Helper to format lastSync ISO string to a human-friendly relative format
function formatRelativeTime(isoString: string): string {
  if (!isoString)
    return t('settings.dialogs.onboarding.provider-resolver.never')
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.round(diffMs / (1000 * 60))
    const diffHours = Math.round(diffMs / (1000 * 60 * 60))
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1)
      return t('settings.dialogs.onboarding.provider-resolver.just-now')
    if (diffMins === 1)
      return t('settings.dialogs.onboarding.provider-resolver.minute-ago')
    if (diffMins < 60)
      return t('settings.dialogs.onboarding.provider-resolver.minutes-ago', { count: diffMins })
    if (diffHours === 1)
      return t('settings.dialogs.onboarding.provider-resolver.hour-ago')
    if (diffHours < 24)
      return t('settings.dialogs.onboarding.provider-resolver.hours-ago', { count: diffHours })
    if (diffDays === 1)
      return t('settings.dialogs.onboarding.provider-resolver.yesterday')
    if (diffDays < 7)
      return t('settings.dialogs.onboarding.provider-resolver.days-ago', { count: diffDays })

    return date.toLocaleDateString(locale.value, { month: 'short', day: 'numeric', year: 'numeric' })
  }
  catch {
    return isoString
  }
}

function formatProvider(provider: BackupTarget['provider']) {
  if (provider === 'local')
    return t('settings.dialogs.onboarding.provider-resolver.local-file-system')
  return provider === 'cloudflare-r2' ? 'Cloudflare R2' : 'Amazon S3'
}

function formatBackupSize(size: BackupTarget['size']) {
  return t(size === 's3'
    ? 'settings.dialogs.onboarding.provider-resolver.s3-bucket'
    : 'settings.dialogs.onboarding.provider-resolver.local-directory')
}

async function loadBackups() {
  isSearching.value = true
  try {
    if (simulateEmpty.value) {
      backups.value = []
      selectedBackupId.value = ''
      isSearching.value = false
      return
    }

    const manifest = await syncStore.fetchGDriveManifest()
    const providersList = manifest?.providers || []

    backups.value = providersList.map((p: any) => {
      let icon = 'i-solar:database-bold-duotone'
      let provider: BackupTarget['provider'] = 'amazon-s3'

      if (p.type === 'local') {
        icon = 'i-solar:laptop-bold-duotone'
        provider = 'local'
      }
      else if (p.type === 's3') {
        // If s3 endpoint includes r2.cloudflarestorage.com, call it Cloudflare R2
        if (p.config?.endpoint?.includes('r2.cloudflarestorage.com')) {
          provider = 'cloudflare-r2'
          icon = 'i-solar:cloud-bold-duotone'
        }
        else {
          provider = 'amazon-s3'
        }
      }

      return {
        id: p.id,
        name: p.type === 's3' ? p.config?.bucket || p.name : p.config?.path || p.name,
        provider,
        icon,
        lastSync: p.lastSync,
        size: p.type === 's3' ? 's3' : 'local',
        region: p.config?.region,
      }
    })

    if (backups.value.length > 0) {
      selectedBackupId.value = backups.value[0].id
    }
    else {
      selectedBackupId.value = ''
    }
  }
  catch (err) {
    console.error('[StepProviderResolver] Error loading backups from AppData:', err)
  }
  finally {
    isSearching.value = false
  }
}

onMounted(() => {
  loadBackups()
})

function triggerEmptySimulation() {
  simulateEmpty.value = true
  isSearching.value = true
  setTimeout(() => {
    backups.value = []
    selectedBackupId.value = ''
    isSearching.value = false
  }, 1000)
}

function handleNext() {
  if (backups.value.length === 0) {
    props.onNext({ manualFallback: true })
  }
  else {
    props.onNext({ selectedBackupId: selectedBackupId.value })
  }
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
      <button class="outline-none" :aria-label="t('settings.dialogs.onboarding.common.back')" @click="props.onPrevious">
        <div class="i-solar:alt-arrow-left-line-duotone h-5 w-5 transition-colors hover:text-primary-500" />
      </button>
      <h2 class="flex-1 text-center text-xl text-neutral-800 font-semibold md:text-left md:text-2xl dark:text-neutral-100">
        {{ t('settings.dialogs.onboarding.provider-resolver.title') }}
      </h2>
      <div class="h-5 w-5" />
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-y-auto px-1">
      <!-- Searching State -->
      <div v-if="isSearching" class="h-full flex flex-col items-center justify-center gap-4 text-center">
        <div class="relative h-16 w-16 flex items-center justify-center">
          <div class="absolute inset-0 animate-ping border-4 border-primary-500/20 rounded-full dark:border-primary-400/20" />
          <div class="absolute inset-2 animate-spin border-4 border-b-transparent border-l-transparent border-r-transparent border-t-primary-500 rounded-full" />
        </div>
        <div>
          <h3 class="text-sm text-neutral-800 font-bold dark:text-neutral-100">
            {{ t('settings.dialogs.onboarding.provider-resolver.scanning') }}
          </h3>
          <p class="mt-1 text-xs text-neutral-500">
            {{ t('settings.dialogs.onboarding.provider-resolver.scanning-description') }}
          </p>
        </div>
      </div>

      <!-- Backup List -->
      <div v-else-if="backups.length > 0" class="flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('settings.dialogs.onboarding.provider-resolver.found-description') }}
          </p>
          <button
            class="border border-neutral-200 rounded px-2 py-0.5 text-[10px] text-neutral-400 dark:border-neutral-800 hover:text-neutral-500"
            @click="triggerEmptySimulation"
          >
            {{ t('settings.dialogs.onboarding.provider-resolver.simulate-empty') }}
          </button>
        </div>

        <div class="flex flex-col gap-3">
          <div
            v-for="backup in backups"
            :key="backup.id"
            class="flex cursor-pointer items-center gap-4 border rounded-xl p-4 transition-all duration-200"
            :class="[
              selectedBackupId === backup.id
                ? 'bg-gradient-to-r from-primary-500/5 to-indigo-500/5 border-primary-500 dark:border-primary-400 shadow-md shadow-primary-500/5'
                : 'bg-white/40 dark:bg-neutral-900/40 border-neutral-200/60 dark:border-neutral-800/80 hover:border-primary-500/30',
            ]"
            @click="selectedBackupId = backup.id"
          >
            <div
              class="rounded-xl p-3"
              :class="[
                selectedBackupId === backup.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300',
              ]"
            >
              <div :class="backup.icon" class="h-6 w-6" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate text-sm text-neutral-800 font-bold dark:text-neutral-100">
                  {{ backup.name }}
                </span>
                <span class="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  {{ formatProvider(backup.provider) }}
                </span>
              </div>
              <div class="mt-1 flex items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
                <span>{{ t('settings.dialogs.onboarding.provider-resolver.size', { size: formatBackupSize(backup.size) }) }}</span>
                <span v-if="backup.region">{{ t('settings.dialogs.onboarding.provider-resolver.region', { region: backup.region }) }}</span>
                <span>• {{ t('settings.dialogs.onboarding.provider-resolver.sync', { time: formatRelativeTime(backup.lastSync) }) }}</span>
              </div>
            </div>

            <div
              class="h-5 w-5 flex items-center justify-center border-2 rounded-full transition-colors"
              :class="selectedBackupId === backup.id ? 'border-primary-500 dark:border-primary-400' : 'border-neutral-300 dark:border-neutral-600'"
            >
              <div v-if="selectedBackupId === backup.id" class="h-2.5 w-2.5 rounded-full bg-primary-500 dark:bg-primary-400" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty Handed / No Backups State -->
      <div v-else class="h-full flex flex-col items-center justify-center gap-4 py-8 text-center">
        <div class="rounded-2xl bg-amber-500/10 p-4 text-amber-500">
          <div class="i-solar:sad-ellipse-bold-duotone h-10 w-10" />
        </div>
        <div>
          <h3 class="text-base text-neutral-800 font-bold dark:text-neutral-100">
            {{ t('settings.dialogs.onboarding.provider-resolver.no-saved-title') }}
          </h3>
          <p class="mx-auto mt-1.5 max-w-xs text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
            {{ t('settings.dialogs.onboarding.provider-resolver.no-saved-description') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Footer Action -->
    <div class="flex flex-col gap-3">
      <Button
        v-motion
        :initial="{ opacity: 0, y: 10 }"
        :enter="{ opacity: 1, y: 0 }"
        :duration="400"
        :delay="300"
        :disabled="isSearching"
        :label="backups.length === 0 ? t('settings.dialogs.onboarding.provider-resolver.configure-manually') : t('settings.dialogs.onboarding.provider-resolver.next-selective-sync')"
        @click="handleNext"
      />
      <button
        v-if="backups.length === 0 && !isSearching"
        class="text-xs text-neutral-500 underline outline-none dark:text-neutral-400 hover:text-neutral-600"
        @click="props.onPrevious"
      >
        {{ t('settings.dialogs.onboarding.provider-resolver.different-account') }}
      </button>
    </div>
  </div>
</template>

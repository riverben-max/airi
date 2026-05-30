<script setup lang="ts">
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { useDataMaintenance } from '@proj-airi/stage-ui/composables/use-data-maintenance'
import { useBackupStore } from '@proj-airi/stage-ui/stores/backup'
import { Button, DoubleCheckButton } from '@proj-airi/ui'
import {
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Restore backup states
const showRestoreModal = ref(false)
const showConfirmWarning = ref(false)
const backupsList = ref<{ name: string, date: string, path: string }[]>([])
const selectedBackupDir = ref('')
const restoreOptions = ref({
  characters: true,
  sessions: true,
  memory: true,
  localStorage: true,
})
const restoring = ref(false)
const restoreErrorMessage = ref('')

async function openRestoreModal() {
  restoreErrorMessage.value = ''
  backupsList.value = await backupStore.listBackups()
  if (backupsList.value.length > 0) {
    selectedBackupDir.value = backupsList.value[0].path
  }
  else {
    selectedBackupDir.value = ''
  }
  showRestoreModal.value = true
}

function triggerRestoreConfirm() {
  if (!selectedBackupDir.value)
    return
  showConfirmWarning.value = true
}

async function handlePerformRestore() {
  restoring.value = true
  restoreErrorMessage.value = ''
  try {
    const result = await backupStore.restoreBackup(selectedBackupDir.value, restoreOptions.value)
    if (result.success) {
      showConfirmWarning.value = false
      showRestoreModal.value = false
      setStatus('Backup restored successfully! Reloading application...', 'success')
      setTimeout(() => {
        location.reload()
      }, 1500)
    }
    else {
      restoreErrorMessage.value = result.error || 'Failed to restore backup'
    }
  }
  catch (err: any) {
    restoreErrorMessage.value = err.message || 'Restore failed'
  }
  finally {
    restoring.value = false
  }
}
const {
  deleteAllModels,
  resetProvidersSettings,
  resetModulesSettings,
  deleteAllChatSessions,
  exportChatSessions,
  importChatSessions,
  exportAllCharacters,
  importAllCharacters,
  exportMemory,
  importMemory,
  exportBackgrounds,
  importBackgrounds,
  deleteAllData,
  resetDesktopApplicationState,
} = useDataMaintenance()

const backupStore = useBackupStore()

const statusMessage = ref('')
const statusTone = ref<'neutral' | 'success' | 'error'>('neutral')
const importError = ref('')
const importFileInput = ref<HTMLInputElement>()
const importType = ref<'chats' | 'characters' | 'memory' | 'backgrounds'>('chats')
const isDesktop = computed(() => isStageTamagotchi())

function setStatus(message: string, tone: 'neutral' | 'success' | 'error' = 'success') {
  statusMessage.value = message
  statusTone.value = tone
}

async function runAction(action: () => Promise<void> | void, successKey: string) {
  try {
    await action()
    setStatus(t(successKey), 'success')
  }
  catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
}

async function triggerExport(type: 'chats' | 'characters' | 'memory' | 'backgrounds') {
  try {
    let blob: Blob
    let filename: string

    switch (type) {
      case 'characters':
        blob = await exportAllCharacters()
        filename = `airi-characters-${new Date().toISOString()}.json`
        break
      case 'memory':
        blob = await exportMemory()
        filename = `airi-memory-${new Date().toISOString()}.json`
        break
      case 'backgrounds':
        blob = await exportBackgrounds()
        filename = `airi-backgrounds-${new Date().toISOString()}.json`
        break
      default:
        blob = await exportChatSessions()
        filename = `airi-chat-sessions-${new Date().toISOString()}.json`
    }

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus(t('settings.pages.data.status.exported'))
  }
  catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
}

function triggerImportPicker(type: 'chats' | 'characters' | 'memory' | 'backgrounds') {
  importError.value = ''
  importType.value = type
  importFileInput.value?.click()
}

async function handleImport(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file)
    return

  try {
    const raw = await file.text()
    const parsed = JSON.parse(raw) as Record<string, unknown>

    switch (importType.value) {
      case 'characters':
        await importAllCharacters(parsed)
        break
      case 'memory':
        await importMemory(parsed)
        break
      case 'backgrounds':
        await importBackgrounds(parsed)
        break
      default:
        await importChatSessions(parsed)
    }

    setStatus(t('settings.pages.data.status.imported'))
    importError.value = ''
  }
  catch (error) {
    console.error(error)
    importError.value = t('settings.pages.data.status.import_error')
    setStatus(error instanceof Error ? error.message : String(error), 'error')
  }
  finally {
    target.value = ''
  }
}

const formattedLastBackupTime = computed(() => {
  if (!backupStore.lastBackupTime)
    return 'Never'
  return new Date(backupStore.lastBackupTime).toLocaleString()
})

async function handleTriggerBackup() {
  const backupPathResult = await backupStore.triggerBackup()
  if (backupPathResult) {
    setStatus(`Backup completed successfully at: ${backupPathResult}`)
  }
  else {
    setStatus('Backup failed!', 'error')
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 pb-4">
    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg font-medium">
            {{ t('settings.pages.data.sections.chats.title') }}
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('settings.pages.data.sections.chats.description') }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" @click="triggerExport('chats')">
              {{ t('settings.pages.data.sections.chats.export') }}
            </Button>
            <Button variant="primary" @click="triggerImportPicker('chats')">
              {{ t('settings.pages.data.sections.chats.import') }}
            </Button>
          </div>
          <DoubleCheckButton
            variant="danger"
            @confirm="runAction(deleteAllChatSessions, 'settings.pages.data.status.chats_deleted')"
          >
            {{ t('settings.pages.data.sections.chats.delete') }}
            <template #confirm>
              {{ t('settings.pages.data.confirmations.yes') }}
            </template>
            <template #cancel>
              {{ t('settings.pages.card.cancel') }}
            </template>
          </DoubleCheckButton>
        </div>
      </div>
      <input ref="importFileInput" type="file" accept="application/json" class="hidden" @change="handleImport">
      <p v-if="importError" class="text-sm text-red-500">
        {{ importError }}
      </p>
    </div>

    <!-- Characters -->
    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg font-medium">
            {{ t('settings.pages.data.sections.characters.title') }}
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('settings.pages.data.sections.characters.description') }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" @click="triggerExport('characters')">
              {{ t('settings.pages.data.sections.characters.export') }}
            </Button>
            <Button variant="primary" @click="triggerImportPicker('characters')">
              {{ t('settings.pages.data.sections.characters.import') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Memory -->
    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg font-medium">
            {{ t('settings.pages.data.sections.memory.title') }}
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('settings.pages.data.sections.memory.description') }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" @click="triggerExport('memory')">
              {{ t('settings.pages.data.sections.memory.export') }}
            </Button>
            <Button variant="primary" @click="triggerImportPicker('memory')">
              {{ t('settings.pages.data.sections.memory.import') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Backgrounds -->
    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg font-medium">
            {{ t('settings.pages.data.sections.backgrounds.title') }}
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ t('settings.pages.data.sections.backgrounds.description') }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="flex flex-wrap gap-2">
            <Button variant="secondary" @click="triggerExport('backgrounds')">
              {{ t('settings.pages.data.sections.backgrounds.export') }}
            </Button>
            <Button variant="primary" @click="triggerImportPicker('backgrounds')">
              {{ t('settings.pages.data.sections.backgrounds.import') }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Backup -->
    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg font-medium">
            Auto-Backup & Manual Backup
          </div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            Configure auto-backup or trigger a manual backup.
          </p>
          <div class="mt-2 text-sm text-neutral-500">
            <div>Backup Path: <span class="font-mono">{{ backupStore.backupPath || '~/Documents/AIRI-Backups' }}</span></div>
            <div>Last Backup: <span class="font-mono">{{ formattedLastBackupTime }}</span></div>
          </div>
        </div>
        <div class="flex flex-col items-start gap-2 sm:items-end">
          <div class="flex flex-wrap gap-2">
            <Button :variant="backupStore.isBackupEnabled ? 'primary' : 'secondary'" @click="backupStore.isBackupEnabled = !backupStore.isBackupEnabled">
              {{ backupStore.isBackupEnabled ? 'Auto-Backup Enabled' : 'Auto-Backup Disabled' }}
            </Button>
            <Button variant="secondary" @click="openRestoreModal">
              Restore Backup
            </Button>
            <Button variant="primary" @click="handleTriggerBackup">
              Trigger Backup
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="flex flex-col gap-1 md:max-w-[560px]">
            <div class="text-lg font-medium">
              {{ t('settings.pages.data.sections.models.title') }}
            </div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('settings.pages.data.sections.models.description') }}
            </p>
          </div>
          <div class="flex flex-col items-start gap-2">
            <DoubleCheckButton
              variant="danger"
              @confirm="runAction(deleteAllModels, 'settings.pages.data.status.models_deleted')"
            >
              {{ t('settings.pages.data.sections.models.delete') }}
              <template #confirm>
                {{ t('settings.pages.data.confirmations.yes') }}
              </template>
              <template #cancel>
                {{ t('settings.pages.card.cancel') }}
              </template>
            </DoubleCheckButton>
          </div>
        </div>

        <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div class="flex flex-col gap-1 md:max-w-[560px]">
            <div class="text-lg font-medium">
              {{ t('settings.pages.data.sections.modules.title') }}
            </div>
            <p class="text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('settings.pages.data.sections.modules.description') }}
            </p>
          </div>
          <div class="flex flex-col items-start gap-2">
            <DoubleCheckButton
              variant="caution"
              @confirm="runAction(resetModulesSettings, 'settings.pages.data.status.modules_reset')"
            >
              {{ t('settings.pages.data.sections.modules.reset') }}
              <template #confirm>
                {{ t('settings.pages.data.confirmations.yes') }}
              </template>
              <template #cancel>
                {{ t('settings.pages.card.cancel') }}
              </template>
            </DoubleCheckButton>
          </div>
        </div>
      </div>
    </div>

    <div class="border-2 border-neutral-200/50 rounded-xl bg-white/70 p-4 shadow-sm dark:border-neutral-800/60 dark:bg-neutral-900/60">
      <div class="flex flex-col gap-3">
        <div>
          <div class="text-lg text-red-600 font-semibold dark:text-red-300">
            {{ t('settings.pages.data.sections.danger.title') }}
          </div>
          <p class="text-sm text-red-600/80 dark:text-red-200/80">
            {{ t('settings.pages.data.sections.danger.description') }}
          </p>
        </div>

        <div class="flex flex-col gap-3">
          <div class="grid gap-3 md:grid-cols-2">
            <div class="rounded-lg bg-white/70 p-3 dark:bg-red-950/40">
              <div class="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div class="flex flex-col gap-1 md:max-w-[560px]">
                  <div class="text-sm text-red-700 font-medium dark:text-red-200">
                    {{ t('settings.pages.data.sections.providers.title') }}
                  </div>
                  <p class="text-xs text-red-700/80 dark:text-red-200/80">
                    {{ t('settings.pages.data.sections.providers.description') }}
                  </p>
                </div>
                <div class="flex flex-col items-start gap-2">
                  <DoubleCheckButton
                    variant="danger"
                    @confirm="runAction(resetProvidersSettings, 'settings.pages.data.status.providers_reset')"
                  >
                    {{ t('settings.pages.data.sections.providers.reset') }}
                    <template #confirm>
                      {{ t('settings.pages.data.confirmations.yes') }}
                    </template>
                    <template #cancel>
                      {{ t('settings.pages.card.cancel') }}
                    </template>
                  </DoubleCheckButton>
                </div>
              </div>
            </div>

            <div class="rounded-lg bg-white/70 p-3 dark:bg-red-950/40">
              <div class="grid grid-cols-1 items-start gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <div class="flex flex-col gap-1 md:max-w-[560px]">
                  <div class="text-sm text-red-700 font-medium dark:text-red-200">
                    {{ t('settings.pages.data.sections.all.title') }}
                  </div>
                  <p class="text-xs text-red-700/80 dark:text-red-200/80">
                    {{ t('settings.pages.data.sections.all.description') }}
                  </p>
                </div>
                <div class="flex flex-col items-start gap-2">
                  <DoubleCheckButton
                    variant="danger"
                    @confirm="runAction(deleteAllData, 'settings.pages.data.status.all_deleted')"
                  >
                    {{ t('settings.pages.data.sections.all.delete') }}
                    <template #confirm>
                      {{ t('settings.pages.data.confirmations.yes') }}
                    </template>
                    <template #cancel>
                      {{ t('settings.pages.card.cancel') }}
                    </template>
                  </DoubleCheckButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="isDesktop"
      class="border-2 border-amber-300/80 rounded-xl bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/60 dark:bg-amber-500/10"
    >
      <div class="grid grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
        <div class="flex flex-col gap-1 md:max-w-[560px]">
          <div class="text-lg text-amber-700 font-medium dark:text-amber-200">
            {{ t('settings.pages.data.sections.desktop.title') }}
          </div>
          <p class="text-sm text-amber-700/80 dark:text-amber-200/80">
            {{ t('settings.pages.data.sections.desktop.description') }}
          </p>
        </div>
        <div class="flex flex-col items-start gap-2">
          <DoubleCheckButton
            variant="caution"
            @confirm="runAction(resetDesktopApplicationState, 'settings.pages.data.status.desktop_reset')"
          >
            {{ t('settings.pages.data.sections.desktop.reset') }}
            <template #confirm>
              {{ t('settings.pages.data.confirmations.yes') }}
            </template>
            <template #cancel>
              {{ t('settings.pages.card.cancel') }}
            </template>
          </DoubleCheckButton>
        </div>
      </div>
    </div>

    <!-- Restore Backup Modal -->
    <DialogRoot :open="showRestoreModal" @update:open="showRestoreModal = $event">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-110 bg-black/60 backdrop-blur-md data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
        <DialogContent class="fixed left-1/2 top-1/2 z-110 m-0 max-h-[90vh] max-w-xl w-[90vw] flex flex-col overflow-hidden border border-neutral-200 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700 dark:bg-neutral-900">
          <!-- Header -->
          <div class="border-b border-neutral-100 p-6 dark:border-neutral-800">
            <div class="flex items-center gap-3">
              <div class="rounded-xl bg-primary-500/10 p-2 text-primary-500">
                <div class="i-solar:database-bold-duotone text-2xl" />
              </div>
              <div>
                <DialogTitle class="text-lg text-neutral-800 font-bold dark:text-neutral-100">
                  Restore Backup
                </DialogTitle>
                <p class="text-xs text-neutral-500">
                  Select a backup and choose what components to restore.
                </p>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-4">
            <!-- Backup List -->
            <div>
              <h4 class="mb-2 text-xs text-neutral-700 font-bold dark:text-neutral-300">
                Available Backups (Latest first):
              </h4>
              <div class="h-[250px] flex flex-col gap-2 overflow-y-auto border border-neutral-200 rounded-xl bg-neutral-50/50 p-2 dark:border-neutral-700 dark:bg-neutral-950">
                <div
                  v-for="backup in backupsList"
                  :key="backup.path"
                  class="flex cursor-pointer items-center justify-between border rounded-xl p-3 text-xs transition-all"
                  :class="selectedBackupDir === backup.path ? 'border-primary-500 bg-primary-500/5 text-primary-600 dark:text-primary-400' : 'border-neutral-200 text-neutral-600 hover:border-primary-300 dark:border-neutral-800 dark:text-neutral-400'"
                  @click="selectedBackupDir = backup.path"
                >
                  <span class="font-semibold font-mono">{{ backup.name }}</span>
                  <span class="text-[10px] text-neutral-400">{{ new Date(backup.date).toLocaleString() }}</span>
                </div>
                <div v-if="backupsList.length === 0" class="flex flex-col items-center justify-center py-12 text-center text-xs text-neutral-500">
                  <div class="i-solar:empty-folder-linear mb-2 text-3xl text-neutral-400" />
                  No backups found in folder.
                </div>
              </div>
            </div>

            <!-- Options -->
            <div class="space-y-2">
              <h4 class="text-xs text-neutral-700 font-bold dark:text-neutral-300">
                Components to Restore:
              </h4>
              <div class="grid grid-cols-2 gap-3 border border-neutral-200 rounded-xl bg-neutral-50/30 p-4 text-xs dark:border-neutral-700 dark:bg-neutral-950/30">
                <label class="flex cursor-pointer items-center gap-2.5 text-neutral-700 dark:text-neutral-300">
                  <input v-model="restoreOptions.characters" type="checkbox" class="h-4 w-4 border-neutral-300 rounded text-primary-600 accent-primary-500 focus:ring-primary-500">
                  <span>Characters</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2.5 text-neutral-700 dark:text-neutral-300">
                  <input v-model="restoreOptions.sessions" type="checkbox" class="h-4 w-4 border-neutral-300 rounded text-primary-600 accent-primary-500 focus:ring-primary-500">
                  <span>Sessions</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2.5 text-neutral-700 dark:text-neutral-300">
                  <input v-model="restoreOptions.memory" type="checkbox" class="h-4 w-4 border-neutral-300 rounded text-primary-600 accent-primary-500 focus:ring-primary-500">
                  <span>Memory</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2.5 text-neutral-700 dark:text-neutral-300">
                  <input v-model="restoreOptions.localStorage" type="checkbox" class="h-4 w-4 border-neutral-300 rounded text-primary-600 accent-primary-500 focus:ring-primary-500">
                  <span>LocalStorage</span>
                </label>
              </div>
            </div>

            <!-- Error message -->
            <div v-if="restoreErrorMessage" class="border border-red-500/30 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
              {{ restoreErrorMessage }}
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50/50 p-6 dark:border-neutral-800 dark:bg-black/20">
            <Button
              variant="secondary"
              label="Cancel"
              @click="showRestoreModal = false"
            />
            <Button
              variant="primary"
              label="Restore"
              icon="i-solar:history-linear"
              :disabled="backupsList.length === 0 || !selectedBackupDir"
              @click="triggerRestoreConfirm"
            />
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Secondary Confirmation Dialog -->
    <DialogRoot :open="showConfirmWarning" @update:open="showConfirmWarning = $event">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 z-120 bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
        <DialogContent class="fixed left-1/2 top-1/2 z-120 m-0 max-w-md w-[90vw] flex flex-col overflow-hidden border border-red-200/50 rounded-2xl bg-white shadow-2xl -translate-x-1/2 -translate-y-1/2 dark:border-red-900/30 dark:bg-neutral-900">
          <div class="p-6 space-y-4">
            <div class="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div class="i-solar:danger-bold-duotone text-3xl" />
              <DialogTitle class="text-base font-bold">
                Confirm Restore
              </DialogTitle>
            </div>
            <p class="text-xs text-neutral-600 leading-relaxed dark:text-neutral-400">
              Warning: Restoring your backup may overwrite existing data. Are you sure?
            </p>
          </div>
          <div class="flex items-center justify-end gap-3 border-t border-neutral-100 bg-neutral-50/50 p-4 dark:border-neutral-800 dark:bg-black/20">
            <Button
              variant="secondary"
              label="Cancel"
              :disabled="restoring"
              @click="showConfirmWarning = false"
            />
            <Button
              variant="danger"
              label="Confirm & Restore"
              :disabled="restoring"
              @click="handlePerformRestore"
            />
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.data.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.data.description
  icon: i-solar:database-bold-duotone
  settingsEntry: true
  order: 11
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>

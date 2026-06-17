<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { useChatSessionStore } from '../../../stores/chat/session-store'

const props = defineProps<{
  characterId?: string
  title?: string
  description?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', universeId: string): void
}>()
const showDialog = defineModel<boolean>({ default: false })
const chatSessionStore = useChatSessionStore()

const existingUniverses = computed(() => {
  if (!props.characterId)
    return ['global']
  const characterIndex = chatSessionStore.getCharacterIndex(props.characterId)
  if (!characterIndex)
    return ['global']

  const list = new Set<string>()
  list.add('global')
  Object.values(characterIndex.sessions).forEach((s) => {
    if (s.universeId) {
      list.add(s.universeId)
    }
  })
  return Array.from(list)
})

const selectedUniverse = ref('global')
const newUniverseName = ref('')
const isCreatingNew = ref(false)

watch(showDialog, (open) => {
  if (open) {
    selectedUniverse.value = 'global'
    newUniverseName.value = ''
    isCreatingNew.value = false
  }
})

function formatUniverseName(slug: string) {
  if (slug === 'global')
    return 'Global World (Default)'
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function getUniverseIcon(slug: string) {
  if (slug === 'global')
    return 'i-solar:globus-bold-duotone'
  return 'i-solar:ghost-bold-duotone'
}

function handleConfirm() {
  let finalUniverse = selectedUniverse.value

  if (isCreatingNew.value && newUniverseName.value.trim()) {
    // Generate clean slug
    finalUniverse = newUniverseName.value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
  }

  emit('confirm', finalUniverse)
  showDialog.value = false
}
</script>

<template>
  <DialogRoot :open="showDialog" @update:open="val => showDialog = val">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm data-[state=closed]:animate-fadeOut data-[state=open]:animate-fadeIn" />
      <DialogContent class="fixed left-1/2 top-1/2 z-[10000] max-h-[85dvh] max-w-md w-[92dvw] flex flex-col transform overflow-hidden border border-neutral-200/50 rounded-3xl bg-white/95 p-0 shadow-2xl outline-none backdrop-blur-xl -translate-x-1/2 -translate-y-1/2 data-[state=closed]:animate-contentHide data-[state=open]:animate-contentShow dark:border-neutral-700/50 dark:bg-neutral-900/95">
        <!-- Header -->
        <div class="flex items-center justify-between p-6 pb-4">
          <div class="flex flex-col">
            <DialogTitle class="text-xl text-neutral-800 font-bold tracking-tight dark:text-neutral-100">
              {{ title || 'Select Universe Context' }}
            </DialogTitle>
            <span class="mt-1 text-xs text-neutral-500 font-medium dark:text-neutral-400">
              {{ description || 'Decide which timeline/memory-pool this session will bind to.' }}
            </span>
          </div>
          <button
            class="group rounded-full p-2 text-neutral-400 transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800"
            @click="showDialog = false"
          >
            <div class="i-solar:close-circle-bold-duotone text-2xl transition-transform group-hover:scale-110" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 pb-6 scrollbar-none space-y-4">
          <!-- Create New Universe Toggle Button -->
          <div v-if="!isCreatingNew" class="flex justify-end">
            <button
              class="flex items-center gap-1.5 text-xs text-primary-600 font-bold transition-colors dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
              @click="isCreatingNew = true"
            >
              <div class="i-solar:add-circle-bold-duotone text-sm" />
              Create New Universe
            </button>
          </div>

          <!-- Mode: Select Existing -->
          <div v-if="!isCreatingNew" class="space-y-2.5">
            <div
              v-for="univ in existingUniverses"
              :key="univ"
              :class="[
                'flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer select-none',
                selectedUniverse === univ
                  ? 'bg-primary-50/40 border-primary-500 shadow-[0_0_15px_rgba(var(--primary-rgb),0.1)] dark:bg-primary-900/10 dark:border-primary-400'
                  : 'bg-neutral-50/50 border-neutral-100 dark:bg-neutral-800/30 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 hover:bg-neutral-100/50 dark:hover:bg-neutral-800/50',
              ]"
              @click="selectedUniverse = univ"
            >
              <div class="flex items-center gap-3">
                <div :class="[getUniverseIcon(univ), 'text-2xl text-neutral-400 dark:text-neutral-500', selectedUniverse === univ ? '!text-primary-500' : '']" />
                <div class="flex flex-col">
                  <span :class="['text-sm font-bold', selectedUniverse === univ ? 'text-primary-700 dark:text-primary-300' : 'text-neutral-700 dark:text-neutral-200']">
                    {{ formatUniverseName(univ) }}
                  </span>
                  <span class="text-[10px] text-neutral-400 font-semibold dark:text-neutral-500">
                    {{ univ === 'global' ? 'Shared memories & context' : 'Isolated timeline memories' }}
                  </span>
                </div>
              </div>
              <div v-if="selectedUniverse === univ" class="i-solar:check-circle-bold text-xl text-primary-500" />
            </div>
          </div>

          <!-- Mode: Create New -->
          <div v-else class="space-y-4">
            <div class="flex flex-col gap-2">
              <label class="text-xs text-neutral-500 font-bold tracking-wider uppercase dark:text-neutral-400">Universe Name</label>
              <input
                v-model="newUniverseName"
                placeholder="e.g. Seaside Cottage, Chloe GF..."
                class="w-full border border-neutral-200 rounded-2xl bg-neutral-50/50 px-4 py-3 text-sm font-medium dark:border-neutral-800 focus:border-primary-500 dark:bg-neutral-800/30 dark:text-neutral-100 focus:outline-none"
                autofocus
                @keyup.enter="handleConfirm"
              >
            </div>
            <div class="flex items-center justify-between">
              <button
                class="flex items-center gap-1.5 text-xs text-neutral-500 font-bold transition-colors dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                @click="isCreatingNew = false"
              >
                <div class="i-solar:arrow-left-bold-duotone text-sm" />
                Back to Selection
              </button>
            </div>
          </div>

          <!-- Confirm button -->
          <button
            class="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary-600 py-3.5 text-sm text-white font-bold transition-all disabled:pointer-events-none active:scale-[0.98] hover:bg-primary-700 disabled:opacity-50"
            :disabled="isCreatingNew && !newUniverseName.trim()"
            @click="handleConfirm"
          >
            <div class="i-solar:check-circle-bold-duotone text-lg" />
            Confirm Assignment
          </button>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes content-show {
  from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

@keyframes content-hide {
  from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  to { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
}

.animate-fadeIn { animation: fade-in 200ms ease-out; }
.animate-fadeOut { animation: fade-out 200ms ease-in; }
.animate-contentShow { animation: content-show 300ms cubic-bezier(0.16, 1, 0.3, 1); }
.animate-contentHide { animation: content-hide 200ms ease-in; }
</style>

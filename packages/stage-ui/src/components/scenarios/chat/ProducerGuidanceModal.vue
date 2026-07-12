<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_SYSTEM_PROMPT_TEMPLATE } from '../../../composables/use-producer'
import { useChatSessionStore } from '../../../stores/chat/session-store'

const props = defineProps<{
  modelValue: boolean
  characterName: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submit', payload: { guidance: string, contextDepth: number, count: number, shortReplies: boolean }): void
  (e: 'openUserProfile'): void
}>()

const chatSessionStore = useChatSessionStore()
const { t } = useI18n()

const guidance = ref('')
const contextDepth = useLocalStorage('airi:producer:context-depth', 6)
const autoSend = useLocalStorage('airi:producer:auto-send', true)
const autoPlayAll = useLocalStorage('airi:producer:auto-play-all', false)
const suggestionCount = useLocalStorage('airi:producer:suggestion-count', 4)
const shortReplies = useLocalStorage('airi:producer:short-replies', true)

const cacheAligned = useLocalStorage('airi:producer:cache-aligned', false)
const showPromptEditor = ref(false)
const customPromptTemplate = useLocalStorage('airi:producer:system-prompt-template', DEFAULT_SYSTEM_PROMPT_TEMPLATE)

const boundaryMessage = computed(() => {
  const sessionId = chatSessionStore.activeSessionId
  if (!sessionId)
    return ''
  const messages = chatSessionStore.sessionMessages[sessionId]
  if (!messages || messages.length === 0)
    return ''
  const index = messages.length - contextDepth.value
  if (index < 0)
    return ''
  const msg = messages[index]
  const role = msg.role === 'user' ? t('stage.chat.producer.user') : props.characterName || t('stage.chat.producer.assistant')
  const text = (typeof msg.content === 'string' ? msg.content.slice(0, 300) : '') || ''
  return `${role}: ${text}`
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    guidance.value = ''
    showPromptEditor.value = false
  }
})

function close() {
  emit('update:modelValue', false)
}

function handleGenerate() {
  emit('submit', {
    guidance: guidance.value.trim(),
    contextDepth: contextDepth.value,
    count: suggestionCount.value,
    shortReplies: shortReplies.value,
  })
  close()
}

function resetTemplate() {
  customPromptTemplate.value = DEFAULT_SYSTEM_PROMPT_TEMPLATE
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        @click.self="close"
      >
        <div
          :class="[
            'relative max-w-md w-full overflow-hidden rounded-2xl border',
            'bg-white shadow-2xl dark:bg-neutral-900 border-neutral-200/50 dark:border-neutral-700/50',
            'animate-scale-in',
          ]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between border-b border-neutral-200/50 px-5 py-4 dark:border-neutral-700/50">
            <div class="flex items-center gap-2 text-base text-neutral-800 font-bold dark:text-neutral-100">
              <div class="i-solar:magic-stick-3-bold-duotone text-lg text-primary-500" />
              <span>{{ showPromptEditor ? t('stage.chat.producer.edit-system-prompt') : t('stage.chat.producer.prompt-producer') }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="!showPromptEditor"
                class="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                :title="t('stage.chat.producer.edit-system-prompt-template')"
                :aria-label="t('stage.chat.producer.edit-system-prompt-template')"
                @click="showPromptEditor = true"
              >
                <div class="i-solar:document-text-bold-duotone text-lg" />
              </button>
              <button
                class="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                :aria-label="t('stage.chat.producer.close')"
                @click="close"
              >
                <div class="i-solar:close-square-outline text-lg" />
              </button>
            </div>
          </div>

          <!-- Body -->
          <div v-if="!showPromptEditor" class="flex flex-col gap-4 p-5">
            <!-- Guidance Textarea -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                {{ t('stage.chat.producer.direction-style') }}
              </label>
              <textarea
                v-model="guidance"
                rows="3"
                :placeholder="t('stage.chat.producer.guidance-placeholder')"
                class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-sm text-neutral-800 outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:text-neutral-100 dark:focus:border-primary-400"
                @keydown.enter.ctrl.prevent="handleGenerate"
              />
            </div>

            <!-- Context Depth Slider -->
            <div v-if="!cacheAligned" class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                  {{ t('stage.chat.producer.context-depth') }}
                </label>
                <span class="rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-500 font-bold font-mono">
                  <PopoverRoot>
                    <PopoverTrigger as-child>
                      <button class="flex items-center gap-1 outline-none">
                        {{ t('stage.chat.producer.message-count', { count: contextDepth }) }}
                        <span class="rounded bg-primary-500/20 px-1 text-[9px] text-primary-600 font-bold leading-relaxed uppercase dark:text-primary-400">{{ t('stage.chat.producer.preview') }}</span>
                      </button>
                    </PopoverTrigger>
                    <PopoverPortal>
                      <PopoverContent
                        side="top"
                        align="center"
                        class="z-50 max-w-xs border border-neutral-200 rounded-xl bg-white p-3 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
                      >
                        <div class="text-[10px] text-neutral-400 font-bold tracking-widest uppercase">{{ t('stage.chat.producer.boundary-message') }}</div>
                        <p class="mt-1.5 max-h-24 overflow-y-auto text-xs text-neutral-700 leading-relaxed dark:text-neutral-300">
                          {{ boundaryMessage || t('stage.chat.producer.no-session-messages') }}
                        </p>
                        <div class="mt-2 text-[9px] text-neutral-400 italic">
                          {{ t('stage.chat.producer.boundary-position', { index: chatSessionStore.activeSessionId ? (chatSessionStore.sessionMessages[chatSessionStore.activeSessionId]?.length ?? 0) - contextDepth + 1 : '—' }) }}
                        </div>
                      </PopoverContent>
                    </PopoverPortal>
                  </PopoverRoot>
                </span>
              </div>
              <input
                v-model.number="contextDepth"
                type="range"
                min="5"
                max="30"
                step="1"
                class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
              >
              <span class="text-[10px] text-neutral-400 dark:text-neutral-500">
                {{ t('stage.chat.producer.context-depth-description') }}
              </span>
            </div>

            <!-- Suggestion Count Slider -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                  {{ t('stage.chat.producer.suggestions-count') }}
                </label>
                <span class="rounded bg-primary-500/10 px-2 py-0.5 text-xs text-primary-500 font-bold font-mono">
                  {{ t('stage.chat.producer.choices-count', { count: suggestionCount }) }}
                </span>
              </div>
              <input
                v-model.number="suggestionCount"
                type="range"
                min="2"
                max="6"
                step="1"
                class="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-primary-500 dark:bg-neutral-700"
              >
              <span class="text-[10px] text-neutral-400 dark:text-neutral-500">
                {{ t('stage.chat.producer.suggestions-count-description') }}
              </span>
            </div>

            <!-- Generate short replies Checkbox -->
            <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
              <input
                v-model="shortReplies"
                type="checkbox"
                class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
              >
              <div class="flex flex-col">
                <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">{{ t('stage.chat.producer.short-replies') }}</span>
                <span class="text-[10px] text-neutral-400 dark:text-neutral-500">{{ t('stage.chat.producer.short-replies-description') }}</span>
              </div>
            </label>

            <!-- Auto-Send Checkbox -->
            <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
              <input
                v-model="autoSend"
                type="checkbox"
                class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
              >
              <div class="flex flex-col">
                <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">{{ t('stage.chat.producer.auto-send') }}</span>
                <span class="text-[10px] text-neutral-400 dark:text-neutral-500">{{ t('stage.chat.producer.auto-send-description') }}</span>
              </div>
            </label>

            <!-- Automatically Play All Checkbox -->
            <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
              <input
                v-model="autoPlayAll"
                type="checkbox"
                class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
              >
              <div class="flex flex-col">
                <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">{{ t('stage.chat.producer.auto-play') }}</span>
                <span class="text-[10px] text-neutral-400 dark:text-neutral-500">{{ t('stage.chat.producer.auto-play-description') }}</span>
              </div>
            </label>

            <!-- Cache-Aligned Full-Context Toggle -->
            <label class="flex cursor-pointer select-none items-center gap-2.5 py-1">
              <input
                v-model="cacheAligned"
                type="checkbox"
                class="h-4 w-4 border-neutral-300 rounded text-primary-500 accent-primary-500 focus:ring-primary-500"
              >
              <div class="flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-neutral-700 font-semibold dark:text-neutral-300">{{ t('stage.chat.producer.cache-aligned') }}</span>
                  <span class="rounded bg-amber-500/20 px-1 py-0.5 text-[8px] text-amber-600 font-bold leading-none dark:text-amber-400">{{ t('stage.chat.producer.experimental') }}</span>
                </div>
                <span class="text-[10px] text-neutral-400 dark:text-neutral-500">{{ t('stage.chat.producer.cache-aligned-description') }}</span>
              </div>
            </label>
          </div>

          <!-- Prompt template editor view -->
          <div v-else class="flex flex-col gap-4 p-5">
            <!-- Custom System Prompt Textarea -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-neutral-500 font-semibold tracking-wider uppercase dark:text-neutral-400">
                {{ t('stage.chat.producer.system-prompt-template') }}
              </label>
              <textarea
                v-model="customPromptTemplate"
                rows="10"
                class="w-full resize-none border border-neutral-200 rounded-xl bg-neutral-50/50 p-3 text-xs text-neutral-800 font-mono outline-none transition-all dark:border-neutral-700 focus:border-primary-500 dark:bg-neutral-900/50 dark:text-neutral-100 dark:focus:border-primary-400"
              />
            </div>

            <!-- Placeholders explanation -->
            <div class="border border-neutral-200/40 rounded-xl bg-neutral-50 p-3 text-[10px] text-neutral-500 leading-normal dark:border-neutral-800/40 dark:bg-neutral-900/50 dark:text-neutral-400">
              <span class="mb-1 block font-bold tracking-wider uppercase">{{ t('stage.chat.producer.supported-placeholders') }}</span>
              <ul class="flex flex-col list-disc list-inside gap-0.5">
                <li><code class="text-primary-500 dark:text-primary-400">{count}</code>: {{ t('stage.chat.producer.placeholder-count') }}</li>
                <li><code class="text-primary-500 dark:text-primary-400">{characterName}</code>: {{ t('stage.chat.producer.placeholder-character-name') }}</li>
                <li><code class="text-primary-500 dark:text-primary-400">{guidance}</code>: {{ t('stage.chat.producer.placeholder-guidance') }}</li>
                <li><code class="text-primary-500 dark:text-primary-400">{lengthRule}</code>: {{ t('stage.chat.producer.placeholder-length-rule') }}</li>
              </ul>
            </div>
          </div>

          <!-- User Profile Tip -->
          <div v-if="!showPromptEditor" class="flex items-start gap-2 border-t border-neutral-200/50 px-5 py-3 dark:border-neutral-700/50">
            <div class="i-solar:info-circle-linear mt-0.5 shrink-0 text-sm text-neutral-400" />
            <p class="text-xs text-neutral-500 leading-relaxed dark:text-neutral-400">
              {{ t('stage.chat.producer.user-profile-tip') }}
              <button
                class="text-primary-500 font-semibold underline underline-offset-2 transition-colors hover:text-primary-400"
                @click="emit('openUserProfile')"
              >
                {{ t('stage.chat.producer.user-settings') }}
              </button>.
            </p>
          </div>

          <!-- Footer -->
          <div class="flex justify-end gap-2 border-t border-neutral-200/50 bg-neutral-50/50 px-5 py-3.5 dark:border-neutral-700/50 dark:bg-neutral-900/30">
            <template v-if="!showPromptEditor">
              <button
                class="rounded-lg px-4 py-2 text-xs text-neutral-600 font-semibold transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @click="close"
              >
                {{ t('stage.chat.producer.cancel') }}
              </button>
              <button
                class="rounded-lg bg-primary-500 px-4 py-2 text-xs text-white font-semibold shadow-sm transition-colors hover:bg-primary-600"
                @click="handleGenerate"
              >
                {{ t('stage.chat.producer.inspire-me') }}
              </button>
            </template>
            <template v-else>
              <button
                class="mr-auto border border-neutral-200 rounded-lg px-4 py-2 text-xs text-neutral-600 font-semibold transition-colors dark:border-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                @click="resetTemplate"
              >
                {{ t('stage.chat.producer.reset-default') }}
              </button>
              <button
                class="rounded-lg bg-primary-500 px-4 py-2 text-xs text-white font-semibold shadow-sm transition-colors hover:bg-primary-600"
                @click="showPromptEditor = false"
              >
                {{ t('stage.chat.producer.done') }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>

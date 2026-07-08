<script setup lang="ts">
import type {
  AdminModel,
  AdminRouterConfigCurrent,
  AdminRouterConfigLlmSlice,
  OfficialChatGatewayInput,
  OfficialGatewayProviderKind,
} from '../adminApi'

import { Button } from '@proj-airi/ui'
import { computed, onMounted, reactive, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { applyOfficialChatGateway, formatDate, getRouterConfig } from '../adminApi'

const props = defineProps<{
  models: AdminModel[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()

const providerKinds: OfficialGatewayProviderKind[] = ['openai-compatible', 'openrouter']
const selectedRouterModelId = shallowRef<string | null>(null)
const routerConfig = shallowRef<AdminRouterConfigCurrent | null>(null)
const routerLoading = shallowRef(false)
const actionLoading = shallowRef(false)
const formError = shallowRef<string | null>(null)
const formMessage = shallowRef<string | null>(null)

const form = reactive({
  providerKind: 'openai-compatible' as OfficialGatewayProviderKind,
  routerModelId: '',
  upstreamModel: '',
  baseURL: 'https://api.openai.com/v1',
  apiKey: '',
  keyEntryId: '',
  existingKeyEntryId: '',
  displayName: '',
  fluxPerCall: 1,
  setAsDefault: true,
  enabled: true,
  priceEnabled: true,
})

const chatModels = computed(() => props.models.filter(model => model.capability === 'chat'))
const defaultChatModel = computed(() => {
  const fromDefaults = routerConfig.value?.request.defaults.chatModel
  if (fromDefaults)
    return fromDefaults

  return stringFromUnknown(routerConfig.value?.preview.DEFAULT_CHAT_MODEL)
})
const missingKeys = computed(() => routerConfig.value?.missingKeys ?? [])
const llmSlices = computed(() => (routerConfig.value?.request.slices ?? []).filter(isLlmSlice))
const selectedModel = computed(() => chatModels.value.find(model => model.routerModelId === selectedRouterModelId.value) ?? null)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function isLlmSlice(value: unknown): value is AdminRouterConfigLlmSlice {
  if (!isRecord(value))
    return false

  const kind = value.kind
  return (kind === 'openai-compatible' || kind === 'openrouter' || kind === 'bedrock')
    && typeof value.modelName === 'string'
    && typeof value.overrideModel === 'string'
}

function messageFromError(value: unknown): string {
  if (value instanceof Error)
    return value.message
  return String(value)
}

function defaultBaseURL(providerKind: OfficialGatewayProviderKind): string {
  return providerKind === 'openrouter'
    ? 'https://openrouter.ai/api/v1'
    : 'https://api.openai.com/v1'
}

function providerLabel(providerKind: string): string {
  if (providerKind === 'openrouter')
    return t('settings.pages.admin.officialGateway.providers.openrouter')
  if (providerKind === 'openai-compatible')
    return t('settings.pages.admin.officialGateway.providers.openaiCompatible')
  return providerKind
}

function statusLabel(enabled: boolean, priceEnabled: boolean): string {
  return enabled && priceEnabled
    ? t('settings.pages.admin.status.enabled')
    : t('settings.pages.admin.status.disabled')
}

function statusClass(enabled: boolean, priceEnabled: boolean): string {
  return enabled && priceEnabled
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
}

function findLlmSlice(routerModelId: string): AdminRouterConfigLlmSlice | null {
  return llmSlices.value.find(slice => slice.modelName === routerModelId) ?? null
}

function resetForm() {
  selectedRouterModelId.value = null
  form.providerKind = 'openai-compatible'
  form.routerModelId = ''
  form.upstreamModel = ''
  form.baseURL = defaultBaseURL(form.providerKind)
  form.apiKey = ''
  form.keyEntryId = ''
  form.existingKeyEntryId = ''
  form.displayName = ''
  form.fluxPerCall = 1
  form.setAsDefault = true
  form.enabled = true
  form.priceEnabled = true
  formError.value = null
  formMessage.value = null
}

function applySliceToForm(slice: AdminRouterConfigLlmSlice | null) {
  if (!slice)
    return

  if (slice.kind === 'openrouter' || slice.kind === 'openai-compatible')
    form.providerKind = slice.kind
  form.upstreamModel = slice.overrideModel
  form.baseURL = slice.baseURL ?? defaultBaseURL(form.providerKind)
  form.keyEntryId = slice.keyEntryId ?? ''
  form.existingKeyEntryId = slice.existingKeyEntryId ?? slice.keyEntryId ?? ''
}

function editModel(model: AdminModel) {
  selectedRouterModelId.value = model.routerModelId
  form.routerModelId = model.routerModelId
  form.upstreamModel = model.routerModelId
  form.displayName = model.displayName
  form.fluxPerCall = model.fluxPerCall ?? 1
  form.enabled = model.enabled
  form.priceEnabled = model.priceEnabled
  form.apiKey = ''
  form.keyEntryId = ''
  form.existingKeyEntryId = ''
  form.setAsDefault = defaultChatModel.value === model.routerModelId
  formError.value = null
  formMessage.value = null
  applySliceToForm(findLlmSlice(model.routerModelId))
}

function editSlice(slice: AdminRouterConfigLlmSlice) {
  selectedRouterModelId.value = slice.modelName
  const model = chatModels.value.find(item => item.routerModelId === slice.modelName)
  if (model) {
    editModel(model)
    return
  }

  form.routerModelId = slice.modelName
  form.displayName = slice.modelName
  form.fluxPerCall = 1
  form.enabled = true
  form.priceEnabled = true
  form.apiKey = ''
  form.setAsDefault = defaultChatModel.value === slice.modelName
  formError.value = null
  formMessage.value = null
  applySliceToForm(slice)
}

async function loadRouterConfig() {
  routerLoading.value = true
  formError.value = null

  try {
    routerConfig.value = await getRouterConfig()
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    routerLoading.value = false
  }
}

function formPayload(): OfficialChatGatewayInput {
  const existingKeyEntryId = form.existingKeyEntryId.trim() || form.keyEntryId.trim() || undefined
  return {
    providerKind: form.providerKind,
    routerModelId: form.routerModelId.trim(),
    upstreamModel: form.upstreamModel.trim(),
    baseURL: form.baseURL.trim(),
    apiKey: form.apiKey.trim() || undefined,
    keyEntryId: form.keyEntryId.trim() || undefined,
    existingKeyEntryId,
    displayName: form.displayName.trim() || form.routerModelId.trim(),
    fluxPerCall: form.fluxPerCall,
    setAsDefault: form.setAsDefault,
    enabled: form.enabled,
    priceEnabled: form.priceEnabled,
  }
}

async function saveGateway() {
  actionLoading.value = true
  formError.value = null
  formMessage.value = null

  try {
    await applyOfficialChatGateway(formPayload())
    form.apiKey = ''
    formMessage.value = t('settings.pages.admin.officialGateway.messages.saved')
    emit('refresh')
    await loadRouterConfig()
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

watch(() => form.providerKind, (providerKind, previousProviderKind) => {
  const previousDefault = previousProviderKind ? defaultBaseURL(previousProviderKind) : ''
  if (!form.baseURL || form.baseURL === previousDefault)
    form.baseURL = defaultBaseURL(providerKind)
})

watch(() => props.models, (models) => {
  if (selectedRouterModelId.value && !models.some(model => model.routerModelId === selectedRouterModelId.value))
    selectedRouterModelId.value = null
})

onMounted(() => {
  void loadRouterConfig()
})
</script>

<template>
  <div :class="['grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]']">
    <section :class="['rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900']">
      <div :class="['flex flex-col gap-3 border-b border-neutral-200 p-3 dark:border-neutral-800 md:flex-row md:items-center md:justify-between']">
        <div :class="['min-w-0']">
          <p :class="['text-sm font-medium']">
            {{ t('settings.pages.admin.officialGateway.currentDefault') }}
          </p>
          <p :class="['mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400']">
            {{ defaultChatModel ?? t('settings.pages.admin.officialGateway.status.unset') }}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon="i-solar:refresh-bold-duotone"
          :loading="routerLoading"
          @click="loadRouterConfig"
        >
          {{ t('settings.pages.admin.officialGateway.actions.reloadConfig') }}
        </Button>
      </div>

      <div :class="['border-b border-neutral-200 p-3 dark:border-neutral-800']">
        <p :class="['mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.officialGateway.missingKeys') }}
        </p>
        <div v-if="missingKeys.length > 0" :class="['flex flex-wrap gap-2']">
          <span
            v-for="key in missingKeys"
            :key="key"
            :class="['rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100']"
          >
            {{ key }}
          </span>
        </div>
        <span v-else :class="['rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200']">
          {{ t('settings.pages.admin.officialGateway.status.noMissingKeys') }}
        </span>
      </div>

      <div :class="['border-b border-neutral-200 dark:border-neutral-800']">
        <div :class="['flex items-center justify-between gap-2 p-3']">
          <h3 :class="['text-sm font-semibold']">
            {{ t('settings.pages.admin.officialGateway.routerSlices') }}
          </h3>
          <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.admin.status.count', { count: llmSlices.length }) }}
          </span>
        </div>

        <div v-if="routerLoading" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.status.loading') }}
        </div>
        <div v-else-if="llmSlices.length === 0" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
          <p :class="['font-medium text-neutral-800 dark:text-neutral-100']">
            {{ t('settings.pages.admin.officialGateway.empty.routerSlices.title') }}
          </p>
          <p :class="['mt-1']">
            {{ t('settings.pages.admin.officialGateway.empty.routerSlices.description') }}
          </p>
        </div>
        <div v-else :class="['overflow-x-auto']">
          <table :class="['w-full min-w-4xl border-collapse text-sm']">
            <thead :class="['bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400']">
              <tr>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.provider') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.routerModel') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.upstreamModel') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.baseURL') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.keyEntry') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="slice in llmSlices"
                :key="slice.modelName"
                :class="[
                  'cursor-pointer border-t border-neutral-100 transition dark:border-neutral-800',
                  selectedRouterModelId === slice.modelName ? 'bg-primary-500/10 dark:bg-primary-400/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
                ]"
                @click="editSlice(slice)"
              >
                <td :class="['px-3 py-2']">
                  {{ providerLabel(slice.kind) }}
                </td>
                <td :class="['px-3 py-2 font-medium']">
                  {{ slice.modelName }}
                </td>
                <td :class="['px-3 py-2']">
                  {{ slice.overrideModel }}
                </td>
                <td :class="['px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400']">
                  {{ slice.baseURL ?? '-' }}
                </td>
                <td :class="['px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400']">
                  {{ slice.existingKeyEntryId ?? slice.keyEntryId ?? t('settings.pages.admin.officialGateway.status.noKeyEntry') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div :class="['flex items-center justify-between gap-2 p-3']">
          <h3 :class="['text-sm font-semibold']">
            {{ t('settings.pages.admin.officialGateway.billableChatModels') }}
          </h3>
          <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.admin.status.count', { count: chatModels.length }) }}
          </span>
        </div>

        <div v-if="loading" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.status.loading') }}
        </div>
        <div v-else-if="chatModels.length === 0" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
          <p :class="['font-medium text-neutral-800 dark:text-neutral-100']">
            {{ t('settings.pages.admin.officialGateway.empty.billableModels.title') }}
          </p>
          <p :class="['mt-1']">
            {{ t('settings.pages.admin.officialGateway.empty.billableModels.description') }}
          </p>
        </div>
        <div v-else :class="['overflow-x-auto']">
          <table :class="['w-full min-w-3xl border-collapse text-sm']">
            <thead :class="['bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400']">
              <tr>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.model') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.flux') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.status') }}
                </th>
                <th :class="['px-3 py-2 font-medium']">
                  {{ t('settings.pages.admin.officialGateway.columns.updatedAt') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="model in chatModels"
                :key="model.id"
                :class="[
                  'cursor-pointer border-t border-neutral-100 transition dark:border-neutral-800',
                  selectedRouterModelId === model.routerModelId ? 'bg-primary-500/10 dark:bg-primary-400/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
                ]"
                @click="editModel(model)"
              >
                <td :class="['px-3 py-2']">
                  <div :class="['font-medium']">
                    {{ model.displayName }}
                  </div>
                  <div :class="['text-xs text-neutral-500 dark:text-neutral-400']">
                    {{ model.routerModelId }}
                  </div>
                </td>
                <td :class="['px-3 py-2 tabular-nums']">
                  {{ model.fluxPerCall ?? '-' }}
                </td>
                <td :class="['px-3 py-2']">
                  <span :class="['rounded px-2 py-1 text-xs', statusClass(model.enabled, model.priceEnabled)]">
                    {{ statusLabel(model.enabled, model.priceEnabled) }}
                  </span>
                </td>
                <td :class="['px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400']">
                  {{ formatDate(model.updatedAt) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <aside :class="['rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900']">
      <div :class="['mb-4 flex items-center justify-between gap-3']">
        <div>
          <p :class="['text-xs uppercase text-neutral-500 dark:text-neutral-400']">
            {{ selectedModel ? t('settings.pages.admin.officialGateway.editTitle') : t('settings.pages.admin.officialGateway.createTitle') }}
          </p>
          <h3 :class="['text-lg font-semibold']">
            {{ form.displayName || form.routerModelId || t('settings.pages.admin.officialGateway.newGateway') }}
          </h3>
        </div>
        <Button size="sm" variant="secondary" @click="resetForm">
          {{ t('settings.pages.admin.actions.new') }}
        </Button>
      </div>

      <div v-if="formError" :class="['mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100']">
        {{ formError }}
      </div>
      <div v-if="formMessage" :class="['mb-3 rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100']">
        {{ formMessage }}
      </div>

      <form :class="['grid gap-3']" @submit.prevent="saveGateway">
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.provider') }}</span>
          <select v-model="form.providerKind" :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
            <option v-for="providerKind in providerKinds" :key="providerKind" :value="providerKind">
              {{ providerLabel(providerKind) }}
            </option>
          </select>
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.routerModelId') }}</span>
          <input
            v-model="form.routerModelId"
            required
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
            placeholder="openai/gpt-5-mini"
          >
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.upstreamModel') }}</span>
          <input
            v-model="form.upstreamModel"
            required
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
            placeholder="gpt-5-mini"
          >
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.baseURL') }}</span>
          <input
            v-model="form.baseURL"
            required
            type="url"
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
          >
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.apiKey') }}</span>
          <input
            v-model="form.apiKey"
            type="password"
            autocomplete="new-password"
            :placeholder="t('settings.pages.admin.officialGateway.placeholders.apiKey')"
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
          >
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.keyEntryId') }}</span>
          <input
            v-model="form.keyEntryId"
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
            placeholder="openai-compatible-prod-1"
          >
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.displayName') }}</span>
          <input v-model="form.displayName" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
        </label>

        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.officialGateway.fields.fluxPerCall') }}</span>
          <input v-model.number="form.fluxPerCall" type="number" min="0" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
        </label>

        <div :class="['grid gap-2 text-sm']">
          <label :class="['flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700']">
            <input v-model="form.setAsDefault" type="checkbox">
            <span>{{ t('settings.pages.admin.officialGateway.fields.setAsDefault') }}</span>
          </label>
          <label :class="['flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700']">
            <input v-model="form.enabled" type="checkbox">
            <span>{{ t('settings.pages.admin.officialGateway.fields.enabled') }}</span>
          </label>
          <label :class="['flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700']">
            <input v-model="form.priceEnabled" type="checkbox">
            <span>{{ t('settings.pages.admin.officialGateway.fields.priceEnabled') }}</span>
          </label>
        </div>

        <Button type="submit" size="sm" :loading="actionLoading">
          {{ t('settings.pages.admin.officialGateway.actions.saveGateway') }}
        </Button>
      </form>
    </aside>
  </div>
</template>

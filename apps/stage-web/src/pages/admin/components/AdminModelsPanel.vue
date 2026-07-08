<script setup lang="ts">
import type { AdminCapability, AdminModel } from '../adminApi'

import { Button } from '@proj-airi/ui'
import { computed, reactive, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createModel, disableModel, formatDate, updateModel } from '../adminApi'

const props = defineProps<{
  models: AdminModel[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()

const capabilities: AdminCapability[] = ['chat', 'tts', 'image', 'transcription']
const selectedModelId = shallowRef<string | null>(null)
const actionLoading = shallowRef(false)
const formError = shallowRef<string | null>(null)
const formMessage = shallowRef<string | null>(null)
const query = shallowRef('')

const form = reactive({
  id: '',
  capability: 'chat' as AdminCapability,
  routerModelId: '',
  displayName: '',
  fluxPerCall: 1,
  enabled: true,
  displayOrder: 0,
  priceEnabled: true,
})

const selectedModel = computed(() => props.models.find(model => model.id === selectedModelId.value) ?? null)
const filteredModels = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized)
    return props.models

  return props.models.filter(model => [
    model.id,
    model.capability,
    model.routerModelId,
    model.displayName,
  ].some(value => String(value ?? '').toLowerCase().includes(normalized)))
})

function messageFromError(value: unknown): string {
  if (value instanceof Error)
    return value.message
  return String(value)
}

function resetForm() {
  selectedModelId.value = null
  form.id = ''
  form.capability = 'chat'
  form.routerModelId = ''
  form.displayName = ''
  form.fluxPerCall = 1
  form.enabled = true
  form.displayOrder = 0
  form.priceEnabled = true
  formError.value = null
  formMessage.value = null
}

function editModel(model: AdminModel) {
  selectedModelId.value = model.id
  form.id = model.id
  form.capability = model.capability
  form.routerModelId = model.routerModelId
  form.displayName = model.displayName
  form.fluxPerCall = model.fluxPerCall ?? 0
  form.enabled = model.enabled
  form.displayOrder = model.displayOrder
  form.priceEnabled = model.priceEnabled
  formError.value = null
  formMessage.value = null
}

function modelPayload() {
  return {
    capability: form.capability,
    routerModelId: form.routerModelId.trim(),
    displayName: form.displayName.trim() || form.routerModelId.trim(),
    fluxPerCall: form.fluxPerCall,
    enabled: form.enabled,
    displayOrder: form.displayOrder,
    priceEnabled: form.priceEnabled,
  }
}

async function saveModel() {
  actionLoading.value = true
  formError.value = null
  formMessage.value = null

  try {
    if (selectedModel.value)
      await updateModel(selectedModel.value.id, modelPayload())
    else
      await createModel(modelPayload())

    formMessage.value = t('settings.pages.admin.models.messages.saved')
    emit('refresh')
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

async function disableSelectedModel(model: AdminModel) {
  actionLoading.value = true
  formError.value = null
  formMessage.value = null

  try {
    await disableModel(model.id)
    formMessage.value = t('settings.pages.admin.models.messages.disabled')
    emit('refresh')
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

watch(() => props.models, (models) => {
  if (selectedModelId.value && !models.some(model => model.id === selectedModelId.value))
    resetForm()
})
</script>

<template>
  <div :class="['grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]']">
    <section :class="['rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900']">
      <div :class="['flex flex-col gap-3 border-b border-neutral-200 p-3 dark:border-neutral-800 md:flex-row md:items-center md:justify-between']">
        <input
          v-model="query"
          :class="['w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none dark:border-neutral-700 dark:bg-neutral-950 md:max-w-sm']"
          :placeholder="t('settings.pages.admin.models.search')"
        >
        <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.status.count', { count: filteredModels.length }) }}
        </span>
      </div>

      <div v-if="loading" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.admin.status.loading') }}
      </div>
      <div v-else-if="filteredModels.length === 0" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
        <p :class="['font-medium text-neutral-800 dark:text-neutral-100']">
          {{ t('settings.pages.admin.models.empty.title') }}
        </p>
        <p :class="['mt-1']">
          {{ t('settings.pages.admin.models.empty.description') }}
        </p>
      </div>
      <div v-else :class="['overflow-x-auto']">
        <table :class="['w-full min-w-4xl border-collapse text-sm']">
          <thead :class="['bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400']">
            <tr>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.models.columns.model') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.models.columns.capability') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.models.columns.fluxPerCall') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.models.columns.enabled') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.models.columns.order') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.models.columns.updatedAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="model in filteredModels"
              :key="model.id"
              :class="[
                'cursor-pointer border-t border-neutral-100 transition dark:border-neutral-800',
                selectedModelId === model.id ? 'bg-primary-500/10 dark:bg-primary-400/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
              ]"
              @click="editModel(model)"
            >
              <td :class="['px-3 py-2']">
                <div :class="['font-medium']">{{ model.displayName }}</div>
                <div :class="['text-xs text-neutral-500 dark:text-neutral-400']">{{ model.routerModelId }}</div>
              </td>
              <td :class="['px-3 py-2']">{{ model.capability }}</td>
              <td :class="['px-3 py-2 tabular-nums']">{{ model.fluxPerCall ?? '-' }}</td>
              <td :class="['px-3 py-2']">
                <span :class="['rounded px-2 py-1 text-xs', model.enabled && model.priceEnabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300']">
                  {{ model.enabled && model.priceEnabled ? t('settings.pages.admin.status.enabled') : t('settings.pages.admin.status.disabled') }}
                </span>
              </td>
              <td :class="['px-3 py-2 tabular-nums']">{{ model.displayOrder }}</td>
              <td :class="['px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400']">{{ formatDate(model.updatedAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <aside :class="['rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900']">
      <div :class="['mb-4 flex items-center justify-between gap-3']">
        <div>
          <p :class="['text-xs uppercase text-neutral-500 dark:text-neutral-400']">
            {{ selectedModel ? t('settings.pages.admin.models.editTitle') : t('settings.pages.admin.models.createTitle') }}
          </p>
          <h3 :class="['text-lg font-semibold']">{{ form.displayName || form.routerModelId || t('settings.pages.admin.models.newModel') }}</h3>
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

      <form :class="['grid gap-3']" @submit.prevent="saveModel">
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.models.fields.id') }}</span>
          <input v-model="form.id" disabled :class="['rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-800']">
        </label>
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.models.fields.capability') }}</span>
          <select v-model="form.capability" :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
            <option v-for="capability in capabilities" :key="capability" :value="capability">
              {{ capability }}
            </option>
          </select>
        </label>
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.models.fields.routerModelId') }}</span>
          <input v-model="form.routerModelId" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
        </label>
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.models.fields.displayName') }}</span>
          <input v-model="form.displayName" :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
        </label>
        <div :class="['grid grid-cols-2 gap-2']">
          <label :class="['grid gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.models.fields.fluxPerCall') }}</span>
            <input v-model.number="form.fluxPerCall" type="number" min="0" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
          </label>
          <label :class="['grid gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.models.fields.displayOrder') }}</span>
            <input v-model.number="form.displayOrder" type="number" min="0" :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
          </label>
        </div>
        <div :class="['grid grid-cols-2 gap-2 text-sm']">
          <label :class="['flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700']">
            <input v-model="form.enabled" type="checkbox">
            <span>{{ t('settings.pages.admin.models.fields.enabled') }}</span>
          </label>
          <label :class="['flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-700']">
            <input v-model="form.priceEnabled" type="checkbox">
            <span>{{ t('settings.pages.admin.models.fields.priceEnabled') }}</span>
          </label>
        </div>
        <div :class="['grid grid-cols-2 gap-2 pt-1']">
          <Button type="submit" size="sm" :loading="actionLoading">
            {{ t('settings.pages.admin.actions.save') }}
          </Button>
          <Button
            size="sm"
            variant="danger"
            :disabled="!selectedModel"
            :loading="actionLoading"
            @click.prevent="selectedModel && disableSelectedModel(selectedModel)"
          >
            {{ t('settings.pages.admin.actions.disable') }}
          </Button>
        </div>
      </form>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { AdminSubscriptionPlan } from '../adminApi'

import { Button } from '@proj-airi/ui'
import { computed, reactive, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { createPlan, disablePlan, formatDate, formatFen, formatPeriodDays, seedDefaultPlans, updatePlan } from '../adminApi'

const props = defineProps<{
  plans: AdminSubscriptionPlan[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()

const selectedPlanId = shallowRef<string | null>(null)
const actionLoading = shallowRef(false)
const formError = shallowRef<string | null>(null)
const formMessage = shallowRef<string | null>(null)
const query = shallowRef('')

const form = reactive({
  id: '',
  name: '',
  description: '',
  periodDays: 30,
  amountFen: 0,
  fluxAmount: 0,
  enabled: true,
  displayOrder: 0,
})

const selectedPlan = computed(() => props.plans.find(plan => plan.id === selectedPlanId.value) ?? null)
const filteredPlans = computed(() => {
  const normalized = query.value.trim().toLowerCase()
  if (!normalized)
    return props.plans

  return props.plans.filter(plan => [
    plan.id,
    plan.name,
    plan.description,
  ].some(value => String(value ?? '').toLowerCase().includes(normalized)))
})

function messageFromError(value: unknown): string {
  if (value instanceof Error)
    return value.message
  return String(value)
}

function resetForm() {
  selectedPlanId.value = null
  form.id = ''
  form.name = ''
  form.description = ''
  form.periodDays = 30
  form.amountFen = 0
  form.fluxAmount = 0
  form.enabled = true
  form.displayOrder = 0
  formError.value = null
  formMessage.value = null
}

function editPlan(plan: AdminSubscriptionPlan) {
  selectedPlanId.value = plan.id
  form.id = plan.id
  form.name = plan.name
  form.description = plan.description ?? ''
  form.periodDays = plan.periodDays
  form.amountFen = plan.amountFen
  form.fluxAmount = plan.fluxAmount
  form.enabled = plan.enabled
  form.displayOrder = plan.displayOrder
  formError.value = null
  formMessage.value = null
}

function planPayload() {
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    periodDays: form.periodDays,
    amountFen: form.amountFen,
    fluxAmount: form.fluxAmount,
    enabled: form.enabled,
    displayOrder: form.displayOrder,
  }
}

async function savePlan() {
  actionLoading.value = true
  formError.value = null
  formMessage.value = null

  try {
    if (selectedPlan.value) {
      await updatePlan(selectedPlan.value.id, planPayload())
    }
    else {
      await createPlan({
        id: form.id.trim(),
        ...planPayload(),
      })
    }

    formMessage.value = t('settings.pages.admin.plans.messages.saved')
    emit('refresh')
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

async function disableSelectedPlan(plan: AdminSubscriptionPlan) {
  actionLoading.value = true
  formError.value = null
  formMessage.value = null

  try {
    await disablePlan(plan.id)
    formMessage.value = t('settings.pages.admin.plans.messages.disabled')
    emit('refresh')
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

async function seedPlans() {
  actionLoading.value = true
  formError.value = null
  formMessage.value = null

  try {
    await seedDefaultPlans()
    formMessage.value = t('settings.pages.admin.plans.messages.seeded')
    emit('refresh')
  }
  catch (err) {
    formError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

watch(() => props.plans, (plans) => {
  if (selectedPlanId.value && !plans.some(plan => plan.id === selectedPlanId.value))
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
          :placeholder="t('settings.pages.admin.plans.search')"
        >
        <div :class="['flex items-center gap-2']">
          <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.admin.status.count', { count: filteredPlans.length }) }}
          </span>
          <Button size="sm" variant="secondary" :loading="actionLoading" @click="seedPlans">
            {{ t('settings.pages.admin.plans.actions.seed') }}
          </Button>
        </div>
      </div>

      <div v-if="loading" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.admin.status.loading') }}
      </div>
      <div v-else-if="filteredPlans.length === 0" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
        <p :class="['font-medium text-neutral-800 dark:text-neutral-100']">
          {{ t('settings.pages.admin.plans.empty.title') }}
        </p>
        <p :class="['mt-1']">
          {{ t('settings.pages.admin.plans.empty.description') }}
        </p>
      </div>
      <div v-else :class="['overflow-x-auto']">
        <table :class="['w-full min-w-4xl border-collapse text-sm']">
          <thead :class="['bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400']">
            <tr>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.plans.columns.plan') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.plans.columns.period') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.plans.columns.amount') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.plans.columns.flux') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.plans.columns.enabled') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.plans.columns.order') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plan in filteredPlans"
              :key="plan.id"
              :class="[
                'cursor-pointer border-t border-neutral-100 transition dark:border-neutral-800',
                selectedPlanId === plan.id ? 'bg-primary-500/10 dark:bg-primary-400/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
              ]"
              @click="editPlan(plan)"
            >
              <td :class="['px-3 py-2']">
                <div :class="['font-medium']">{{ plan.name }}</div>
                <div :class="['text-xs text-neutral-500 dark:text-neutral-400']">{{ plan.id }}</div>
              </td>
              <td :class="['px-3 py-2']">{{ formatPeriodDays(plan.periodDays) }}</td>
              <td :class="['px-3 py-2 tabular-nums']">{{ formatFen(plan.amountFen) }}</td>
              <td :class="['px-3 py-2 tabular-nums']">{{ plan.fluxAmount }}</td>
              <td :class="['px-3 py-2']">
                <span :class="['rounded px-2 py-1 text-xs', plan.enabled ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300']">
                  {{ plan.enabled ? t('settings.pages.admin.status.enabled') : t('settings.pages.admin.status.disabled') }}
                </span>
              </td>
              <td :class="['px-3 py-2 tabular-nums']">{{ plan.displayOrder }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <aside :class="['rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900']">
      <div :class="['mb-4 flex items-center justify-between gap-3']">
        <div>
          <p :class="['text-xs uppercase text-neutral-500 dark:text-neutral-400']">
            {{ selectedPlan ? t('settings.pages.admin.plans.editTitle') : t('settings.pages.admin.plans.createTitle') }}
          </p>
          <h3 :class="['text-lg font-semibold']">{{ form.name || t('settings.pages.admin.plans.newPlan') }}</h3>
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

      <form :class="['grid gap-3']" @submit.prevent="savePlan">
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.id') }}</span>
          <input
            v-model="form.id"
            :disabled="!!selectedPlan"
            required
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none disabled:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-950 disabled:dark:bg-neutral-800']"
            placeholder="monthly_basic"
          >
        </label>
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.name') }}</span>
          <input v-model="form.name" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
        </label>
        <label :class="['grid gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.description') }}</span>
          <textarea v-model="form.description" rows="3" :class="['resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']" />
        </label>
        <div :class="['grid grid-cols-2 gap-2']">
          <label :class="['grid gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.periodDays') }}</span>
            <input v-model.number="form.periodDays" type="number" min="1" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
          </label>
          <label :class="['grid gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.amountFen') }}</span>
            <input v-model.number="form.amountFen" type="number" min="0" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
          </label>
        </div>
        <div :class="['grid grid-cols-2 gap-2']">
          <label :class="['grid gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.fluxAmount') }}</span>
            <input v-model.number="form.fluxAmount" type="number" min="0" required :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
          </label>
          <label :class="['grid gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.plans.fields.displayOrder') }}</span>
            <input v-model.number="form.displayOrder" type="number" min="0" :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']">
          </label>
        </div>
        <label :class="['flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-700']">
          <input v-model="form.enabled" type="checkbox">
          <span>{{ t('settings.pages.admin.plans.fields.enabled') }}</span>
        </label>
        <div :class="['grid grid-cols-2 gap-2 pt-1']">
          <Button type="submit" size="sm" :loading="actionLoading">
            {{ t('settings.pages.admin.actions.save') }}
          </Button>
          <Button
            size="sm"
            variant="danger"
            :disabled="!selectedPlan"
            :loading="actionLoading"
            @click.prevent="selectedPlan && disableSelectedPlan(selectedPlan)"
          >
            {{ t('settings.pages.admin.actions.disable') }}
          </Button>
        </div>
        <p v-if="selectedPlan" :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.plans.updatedAt', { date: formatDate(selectedPlan.updatedAt) }) }}
        </p>
      </form>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { AdminModel, AdminSubscriptionPlan, AdminUser } from './adminApi'

import { Button } from '@proj-airi/ui'
import { computed, onMounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AdminModelsPanel from './components/AdminModelsPanel.vue'
import AdminOfficialGatewayPanel from './components/AdminOfficialGatewayPanel.vue'
import AdminPlansPanel from './components/AdminPlansPanel.vue'
import AdminUsersPanel from './components/AdminUsersPanel.vue'

import { listModels, listPlans, listUsers } from './adminApi'

type AdminTab = 'users' | 'officialGateway' | 'models' | 'plans'

const { t } = useI18n()

const activeTab = shallowRef<AdminTab>('users')
const loading = shallowRef(false)
const error = shallowRef<string | null>(null)
const users = shallowRef<AdminUser[]>([])
const models = shallowRef<AdminModel[]>([])
const plans = shallowRef<AdminSubscriptionPlan[]>([])
const userQuery = shallowRef('')

const tabs = computed<Array<{ id: AdminTab, label: string, icon: string, count: number }>>(() => [
  { id: 'users', label: t('settings.pages.admin.tabs.users'), icon: 'i-solar:users-group-rounded-bold-duotone', count: users.value.length },
  { id: 'officialGateway', label: t('settings.pages.admin.tabs.officialGateway'), icon: 'i-solar:key-minimalistic-square-2-bold-duotone', count: models.value.filter(model => model.capability === 'chat' && model.enabled && model.priceEnabled).length },
  { id: 'models', label: t('settings.pages.admin.tabs.models'), icon: 'i-solar:server-square-cloud-bold-duotone', count: models.value.length },
  { id: 'plans', label: t('settings.pages.admin.tabs.plans'), icon: 'i-solar:card-2-bold-duotone', count: plans.value.length },
])

const activeTitle = computed(() => t(`settings.pages.admin.sections.${activeTab.value}.title`))
const activeDescription = computed(() => t(`settings.pages.admin.sections.${activeTab.value}.description`))
const isAdminAuthError = computed(() => {
  const message = error.value?.toLowerCase() ?? ''
  return message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('forbidden')
})

function messageFromError(value: unknown): string {
  if (value instanceof Error)
    return value.message
  return String(value)
}

async function refreshActiveTab() {
  loading.value = true
  error.value = null

  try {
    if (activeTab.value === 'users') {
      const result = await listUsers({ query: userQuery.value.trim() || undefined, pageSize: 50 })
      users.value = result.users
      return
    }

    if (activeTab.value === 'officialGateway' || activeTab.value === 'models') {
      models.value = await listModels()
      return
    }

    plans.value = await listPlans()
  }
  catch (err) {
    error.value = messageFromError(err)
  }
  finally {
    loading.value = false
  }
}

watch(activeTab, () => {
  void refreshActiveTab()
})

function searchUsers() {
  if (activeTab.value !== 'users')
    return

  void refreshActiveTab()
}

onMounted(() => {
  void refreshActiveTab()
})
</script>

<template>
  <main
    :class="[
      'min-h-100dvh w-full overflow-auto',
      'bg-neutral-50 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50',
    ]"
  >
    <div :class="['mx-auto w-full max-w-7xl px-4 py-4 md:px-6 md:py-6']">
      <header
        :class="[
          'mb-4 flex flex-col gap-3 border-b border-neutral-200 pb-4 dark:border-neutral-800',
          'md:flex-row md:items-end md:justify-between',
        ]"
      >
        <div :class="['min-w-0']">
          <p :class="['mb-1 text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-300']">
            {{ t('settings.pages.admin.eyebrow') }}
          </p>
          <h1 :class="['text-2xl font-semibold leading-tight md:text-3xl']">
            {{ t('settings.pages.admin.title') }}
          </h1>
          <p :class="['mt-1 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400']">
            {{ t('settings.pages.admin.description') }}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon="i-solar:refresh-bold-duotone"
          :loading="loading"
          @click="refreshActiveTab"
        >
          {{ t('settings.pages.admin.actions.refresh') }}
        </Button>
      </header>

      <nav
        :class="[
          'mb-4 grid grid-cols-1 gap-2 rounded-lg border border-neutral-200 bg-white p-1 dark:border-neutral-800 dark:bg-neutral-900',
          'sm:grid-cols-4',
        ]"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="[
            'flex items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition',
            activeTab === tab.id
              ? 'bg-primary-500/12 text-primary-900 dark:bg-primary-400/15 dark:text-primary-100'
              : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800',
          ]"
          @click="activeTab = tab.id"
        >
          <span :class="['flex min-w-0 items-center gap-2']">
            <span :class="['h-4 w-4 shrink-0', tab.icon]" />
            <span :class="['truncate font-medium']">{{ tab.label }}</span>
          </span>
          <span :class="['rounded bg-neutral-200 px-1.5 py-0.5 text-xs dark:bg-neutral-800']">
            {{ tab.count }}
          </span>
        </button>
      </nav>

      <section :class="['mb-3 flex flex-col gap-1']">
        <h2 :class="['text-base font-semibold']">
          {{ activeTitle }}
        </h2>
        <p :class="['text-sm text-neutral-600 dark:text-neutral-400']">
          {{ activeDescription }}
        </p>
      </section>

      <div
        v-if="error"
        :class="[
          'mb-4 rounded-lg border px-4 py-3 text-sm',
          isAdminAuthError
            ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100'
            : 'border-red-300 bg-red-50 text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100',
        ]"
      >
        <div :class="['flex flex-col gap-3 md:flex-row md:items-center md:justify-between']">
          <div>
            <p :class="['font-medium']">
              {{ isAdminAuthError ? t('settings.pages.admin.errors.adminRequired') : t('settings.pages.admin.errors.loadFailed') }}
            </p>
            <p :class="['mt-1 opacity-80']">
              {{ error }}
            </p>
          </div>
          <Button size="sm" variant="secondary" @click="refreshActiveTab">
            {{ t('settings.pages.admin.actions.retry') }}
          </Button>
        </div>
      </div>

      <AdminUsersPanel
        v-if="activeTab === 'users'"
        v-model:query="userQuery"
        :users="users"
        :loading="loading"
        @refresh="refreshActiveTab"
        @search="searchUsers"
      />
      <AdminModelsPanel
        v-else-if="activeTab === 'models'"
        :models="models"
        :loading="loading"
        @refresh="refreshActiveTab"
      />
      <AdminOfficialGatewayPanel
        v-else-if="activeTab === 'officialGateway'"
        :models="models"
        :loading="loading"
        @refresh="refreshActiveTab"
      />
      <AdminPlansPanel
        v-else
        :plans="plans"
        :loading="loading"
        @refresh="refreshActiveTab"
      />
    </div>
  </main>
</template>

<route lang="yaml">
meta:
  layout: default
</route>

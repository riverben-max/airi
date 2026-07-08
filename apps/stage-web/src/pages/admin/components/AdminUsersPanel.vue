<script setup lang="ts">
import type { AdminUser, AdminUserDetail, FluxTransaction } from '../adminApi'

import { Button, Input } from '@proj-airi/ui'
import { computed, reactive, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { banUser, formatDate, getUser, grantUserFlux, setUserFlux, unbanUser } from '../adminApi'

const props = defineProps<{
  users: AdminUser[]
  loading: boolean
  query: string
}>()

const emit = defineEmits<{
  refresh: []
  search: []
  'update:query': [value: string]
}>()

const { t } = useI18n()

const selectedUserId = shallowRef<string | null>(null)
const detailLoading = shallowRef(false)
const actionLoading = shallowRef(false)
const detailError = shallowRef<string | null>(null)
const actionMessage = shallowRef<string | null>(null)
const selectedUser = shallowRef<AdminUser | AdminUserDetail | null>(null)

const fluxForm = reactive({
  grantAmount: 100,
  setBalance: 0,
  description: '',
})

const searchQuery = computed({
  get: () => props.query,
  set: (value: string) => emit('update:query', value),
})

const filteredUsers = computed(() => {
  const normalized = props.query.trim().toLowerCase()
  if (!normalized)
    return props.users

  return props.users.filter(user => [
    user.id,
    user.email,
    user.name,
    user.role,
  ].some(value => String(value ?? '').toLowerCase().includes(normalized)))
})

const selectedListUser = computed(() => props.users.find(user => user.id === selectedUserId.value) ?? null)
const activeUser = computed(() => selectedUser.value ?? selectedListUser.value)

function hasRecentFluxTransactions(user: AdminUser | AdminUserDetail): user is AdminUserDetail {
  return 'recentFluxTransactions' in user
}

const hasLoadedUserDetail = computed(() => {
  const user = activeUser.value
  return !!user && hasRecentFluxTransactions(user)
})
const recentFluxTransactions = computed<FluxTransaction[]>(() => {
  const user = activeUser.value
  if (!user || !hasRecentFluxTransactions(user))
    return []
  return user.recentFluxTransactions
})

function messageFromError(value: unknown): string {
  if (value instanceof Error)
    return value.message
  return String(value)
}

function submitSearch() {
  emit('search')
}

async function selectUser(user: AdminUser) {
  selectedUserId.value = user.id
  selectedUser.value = user
  detailLoading.value = true
  detailError.value = null
  actionMessage.value = null
  fluxForm.setBalance = user.flux

  try {
    const result = await getUser(user.id)
    selectedUser.value = result
    fluxForm.setBalance = result.flux
  }
  catch (err) {
    detailError.value = messageFromError(err)
  }
  finally {
    detailLoading.value = false
  }
}

async function runUserAction(action: () => Promise<unknown>, successKey: string) {
  const user = activeUser.value
  if (!user)
    return

  actionLoading.value = true
  detailError.value = null
  actionMessage.value = null

  try {
    await action()
    actionMessage.value = t(successKey)
    emit('refresh')
    await selectUser(user)
  }
  catch (err) {
    detailError.value = messageFromError(err)
  }
  finally {
    actionLoading.value = false
  }
}

function grantFlux() {
  const user = activeUser.value
  if (!user)
    return

  void runUserAction(
    () => grantUserFlux(user.id, fluxForm.grantAmount, fluxForm.description || t('settings.pages.admin.users.defaultGrantDescription')),
    'settings.pages.admin.users.messages.granted',
  )
}

function setFlux() {
  const user = activeUser.value
  if (!user)
    return

  void runUserAction(
    () => setUserFlux(user.id, fluxForm.setBalance),
    'settings.pages.admin.users.messages.set',
  )
}

function toggleBan() {
  const user = activeUser.value
  if (!user)
    return

  void runUserAction(
    () => user.banned ? unbanUser(user.id) : banUser(user.id, fluxForm.description || t('settings.pages.admin.users.defaultBanReason')),
    user.banned ? 'settings.pages.admin.users.messages.unbanned' : 'settings.pages.admin.users.messages.banned',
  )
}

watch(() => props.users, (users) => {
  if (!selectedUserId.value && users[0])
    void selectUser(users[0])
  if (selectedUserId.value && !users.some(user => user.id === selectedUserId.value)) {
    selectedUserId.value = null
    selectedUser.value = null
  }
})
</script>

<template>
  <div :class="['grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]']">
    <section :class="['rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900']">
      <div :class="['flex flex-col gap-3 border-b border-neutral-200 p-3 dark:border-neutral-800 md:flex-row md:items-center md:justify-between']">
        <div :class="['flex min-w-0 flex-1 gap-2']">
          <Input
            v-model="searchQuery"
            :placeholder="t('settings.pages.admin.users.search')"
            @keydown.enter="submitSearch"
          />
          <Button
            size="sm"
            variant="secondary"
            icon="i-solar:magnifer-bold-duotone"
            :loading="loading"
            @click="submitSearch"
          >
            {{ t('settings.pages.admin.users.actions.search') }}
          </Button>
        </div>
        <span :class="['text-xs text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.status.count', { count: filteredUsers.length }) }}
        </span>
      </div>

      <div v-if="loading" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.admin.status.loading') }}
      </div>
      <div v-else-if="filteredUsers.length === 0" :class="['p-6 text-sm text-neutral-500 dark:text-neutral-400']">
        <p :class="['font-medium text-neutral-800 dark:text-neutral-100']">
          {{ t('settings.pages.admin.users.empty.title') }}
        </p>
        <p :class="['mt-1']">
          {{ t('settings.pages.admin.users.empty.description') }}
        </p>
      </div>
      <div v-else :class="['overflow-x-auto']">
        <table :class="['w-full min-w-3xl border-collapse text-sm']">
          <thead :class="['bg-neutral-50 text-left text-xs uppercase text-neutral-500 dark:bg-neutral-950 dark:text-neutral-400']">
            <tr>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.users.columns.user') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.users.columns.role') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.users.columns.flux') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.users.columns.status') }}</th>
              <th :class="['px-3 py-2 font-medium']">{{ t('settings.pages.admin.users.columns.createdAt') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              :class="[
                'cursor-pointer border-t border-neutral-100 transition dark:border-neutral-800',
                selectedUserId === user.id ? 'bg-primary-500/10 dark:bg-primary-400/10' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/60',
              ]"
              @click="selectUser(user)"
            >
              <td :class="['px-3 py-2']">
                <div :class="['font-medium']">{{ user.email }}</div>
                <div :class="['text-xs text-neutral-500 dark:text-neutral-400']">{{ user.name || user.id }}</div>
              </td>
              <td :class="['px-3 py-2']">{{ user.role || t('settings.pages.admin.users.roleUser') }}</td>
              <td :class="['px-3 py-2 tabular-nums']">{{ user.flux }}</td>
              <td :class="['px-3 py-2']">
                <span
                  :class="[
                    'rounded px-2 py-1 text-xs font-medium',
                    user.banned
                      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                  ]"
                >
                  {{ user.banned ? t('settings.pages.admin.users.status.banned') : t('settings.pages.admin.users.status.active') }}
                </span>
              </td>
              <td :class="['px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400']">
                {{ formatDate(user.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <aside :class="['rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900']">
      <div v-if="!activeUser" :class="['text-sm text-neutral-500 dark:text-neutral-400']">
        {{ t('settings.pages.admin.users.noSelection') }}
      </div>
      <div v-else :class="['flex flex-col gap-4']">
        <div>
          <p :class="['text-xs uppercase text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.admin.users.detailTitle') }}
          </p>
          <h3 :class="['mt-1 truncate text-lg font-semibold']">{{ activeUser.email }}</h3>
          <p :class="['truncate text-sm text-neutral-500 dark:text-neutral-400']">{{ activeUser.id }}</p>
        </div>

        <div v-if="detailLoading" :class="['text-sm text-neutral-500 dark:text-neutral-400']">
          {{ t('settings.pages.admin.status.loading') }}
        </div>
        <div v-if="detailError" :class="['rounded border border-red-300 bg-red-50 p-3 text-sm text-red-950 dark:border-red-800 dark:bg-red-950/30 dark:text-red-100']">
          {{ detailError }}
        </div>
        <div v-if="actionMessage" :class="['rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100']">
          {{ actionMessage }}
        </div>

        <dl :class="['grid grid-cols-2 gap-3 text-sm']">
          <div>
            <dt :class="['text-neutral-500 dark:text-neutral-400']">{{ t('settings.pages.admin.users.fields.name') }}</dt>
            <dd :class="['font-medium']">{{ activeUser.name || '-' }}</dd>
          </div>
          <div>
            <dt :class="['text-neutral-500 dark:text-neutral-400']">{{ t('settings.pages.admin.users.fields.flux') }}</dt>
            <dd :class="['font-medium tabular-nums']">{{ activeUser.flux }}</dd>
          </div>
          <div>
            <dt :class="['text-neutral-500 dark:text-neutral-400']">{{ t('settings.pages.admin.users.fields.role') }}</dt>
            <dd :class="['font-medium']">{{ activeUser.role || '-' }}</dd>
          </div>
          <div>
            <dt :class="['text-neutral-500 dark:text-neutral-400']">{{ t('settings.pages.admin.users.fields.updatedAt') }}</dt>
            <dd :class="['font-medium']">{{ formatDate(activeUser.updatedAt) }}</dd>
          </div>
        </dl>

        <label :class="['flex flex-col gap-1 text-sm']">
          <span :class="['font-medium']">{{ t('settings.pages.admin.users.fields.description') }}</span>
          <input
            v-model="fluxForm.description"
            :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
            :placeholder="t('settings.pages.admin.users.placeholders.description')"
          >
        </label>

        <div :class="['grid grid-cols-2 gap-2']">
          <label :class="['flex flex-col gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.users.fields.grantAmount') }}</span>
            <input
              v-model.number="fluxForm.grantAmount"
              type="number"
              min="1"
              :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
            >
          </label>
          <label :class="['flex flex-col gap-1 text-sm']">
            <span :class="['font-medium']">{{ t('settings.pages.admin.users.fields.setBalance') }}</span>
            <input
              v-model.number="fluxForm.setBalance"
              type="number"
              min="0"
              :class="['rounded-lg border border-neutral-200 bg-white px-3 py-2 outline-none dark:border-neutral-700 dark:bg-neutral-950']"
            >
          </label>
        </div>

        <div :class="['grid grid-cols-2 gap-2']">
          <Button size="sm" variant="secondary" :loading="actionLoading" @click="grantFlux">
            {{ t('settings.pages.admin.users.actions.grant') }}
          </Button>
          <Button size="sm" variant="secondary" :loading="actionLoading" @click="setFlux">
            {{ t('settings.pages.admin.users.actions.set') }}
          </Button>
        </div>
        <Button
          size="sm"
          :variant="activeUser.banned ? 'secondary' : 'danger'"
          :loading="actionLoading"
          @click="toggleBan"
        >
          {{ activeUser.banned ? t('settings.pages.admin.users.actions.unban') : t('settings.pages.admin.users.actions.ban') }}
        </Button>

        <div v-if="hasLoadedUserDetail" :class="['border-t border-neutral-200 pt-4 dark:border-neutral-800']">
          <p :class="['mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.admin.users.recentFlux') }}
          </p>
          <div v-if="recentFluxTransactions.length === 0" :class="['text-sm text-neutral-500 dark:text-neutral-400']">
            {{ t('settings.pages.admin.users.noRecentFlux') }}
          </div>
          <div v-else :class="['max-h-56 overflow-auto']">
            <div
              v-for="transaction in recentFluxTransactions"
              :key="transaction.id"
              :class="['border-t border-neutral-100 py-2 text-xs dark:border-neutral-800']"
            >
              <div :class="['flex justify-between gap-2']">
                <span :class="['font-medium']">{{ transaction.type }}</span>
                <span :class="['tabular-nums']">{{ transaction.amount }}</span>
              </div>
              <div :class="['mt-1 text-neutral-500 dark:text-neutral-400']">
                {{ transaction.description || '-' }}
              </div>
              <div :class="['mt-1 text-neutral-500 dark:text-neutral-400']">
                {{ formatDate(transaction.createdAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import type { FluxBalanceBucket } from '@proj-airi/stage-ui/composables/use-analytics'

import type { EpayMessageType, EpaySubscriptionPlan } from './flux/epay'

import { isFluxPurchaseDisabled, isStageTamagotchi } from '@proj-airi/stage-shared'
import { client } from '@proj-airi/stage-ui/composables/api'
import { useAnalytics } from '@proj-airi/stage-ui/composables/use-analytics'
import { SERVER_URL } from '@proj-airi/stage-ui/libs/server'
import { useAuthStore } from '@proj-airi/stage-ui/stores/auth'
import { Button } from '@proj-airi/ui'
import { useEventListener } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { createEpayFluxCheckout } from './flux/epay'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const { credits } = storeToRefs(authStore)
const {
  trackCheckoutStarted,
  trackPaywallSeen,
  trackPlanSelected,
  trackPricingViewed,
  trackQuotaLimitReached,
  trackUpgradeClicked,
} = useAnalytics()

const fluxPurchaseDisabled = isFluxPurchaseDisabled()

// On desktop, checkout happens in the external system browser (see handleBuy), so
// the app may not receive the epay return redirect that web/mobile use to refresh.
// Re-pull the Flux balance whenever the window regains focus; the balance source
// of truth is the server after the epay notify callback is processed.
if (isStageTamagotchi())
  useEventListener(window, 'focus', () => authStore.updateCredits())

// NOTICE: Manual interface instead of hono InferResponseType because hono client
// type instantiation hits TS recursion limits ("excessively deep and possibly infinite").
// Keep in sync with the route response shape in apps/server/src/routes/flux.ts
interface AuditRecord {
  id: string
  type: string
  amount: number
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num)
}

/**
 * Buckets Flux balances so monetization analytics never expose exact balances.
 */
function fluxBalanceBucket(balance: number | undefined): FluxBalanceBucket {
  if (balance == null || Number.isNaN(balance))
    return 'unknown'
  if (balance <= 0)
    return 'zero'
  if (balance <= 100)
    return '1_100'
  if (balance <= 1000)
    return '101_1000'
  if (balance <= 10000)
    return '1001_10000'
  return '10000_plus'
}

/** Display amount with sign: debit is negative, credit/initial are positive */
function displayAmount(record: AuditRecord): string {
  const signed = record.type === 'debit' ? -record.amount : record.amount
  const formatted = formatNumber(Math.abs(signed))
  return signed >= 0 ? `+${formatted}` : `-${formatted}`
}

function isPositive(record: AuditRecord): boolean {
  return record.type !== 'debit'
}

// Lookup table avoids a chained ternary in the template (banned by CLAUDE.md
// naming/style rules). Unknown types fall back to typeInitial so older
// records without an explicit mapping still render something.
const TYPE_LABEL_KEY: Record<string, string> = {
  debit: 'settings.pages.flux.audit.typeConsumption',
  credit: 'settings.pages.flux.audit.typeAddition',
  initial: 'settings.pages.flux.audit.typeInitial',
  promo: 'settings.pages.flux.audit.typePromo',
}

function typeLabel(type: string): string {
  return t(TYPE_LABEL_KEY[type] ?? TYPE_LABEL_KEY.initial)
}

const auditRecords = ref<AuditRecord[]>([])
const auditLoading = ref(false)
const auditHasMore = ref(false)
const auditOffset = ref(0)
const AUDIT_PAGE_SIZE = 20

const capacity = ref(0)

const fluxPercentage = computed(() => {
  if (capacity.value <= 0)
    return credits.value > 0 ? 100 : 0
  return Math.min(100, Math.round((credits.value / capacity.value) * 100))
})

async function fetchStats() {
  try {
    const res = await client.api.v1.flux.stats.$get()
    if (res.ok) {
      const data = await res.json()
      capacity.value = data.capacity
    }
  }
  catch {
    // silently fail
  }
}

async function fetchAuditHistory(loadMore = false) {
  auditLoading.value = true
  try {
    const offset = loadMore ? auditOffset.value : 0
    const res = await client.api.v1.flux.history.$get({
      query: { limit: String(AUDIT_PAGE_SIZE), offset: String(offset) },
    })
    if (res.ok) {
      const data = await res.json() as { records: AuditRecord[], hasMore: boolean }
      if (loadMore) {
        auditRecords.value.push(...data.records)
      }
      else {
        auditRecords.value = data.records
      }
      auditHasMore.value = data.hasMore
      auditOffset.value = offset + data.records.length
    }
  }
  catch {
    // silently fail
  }
  finally {
    auditLoading.value = false
  }
}

async function refreshFluxData() {
  await Promise.allSettled([fetchStats(), fetchAuditHistory()])
}

function openPayUrl(payUrl: string) {
  if (isStageTamagotchi())
    window.open(payUrl, '_blank')
  else
    window.location.href = payUrl
}

const epayCheckout = createEpayFluxCheckout({
  openPayUrl,
  refreshCredits: () => authStore.updateCredits(),
  refreshFluxData,
  serverUrl: SERVER_URL,
  translate: t,
})

const plans = epayCheckout.plans
const currentSubscription = epayCheckout.currentSubscription
const loadingPlanId = epayCheckout.loadingPlanId
const loadingPlans = epayCheckout.loadingPlans
const loadingSubscription = epayCheckout.loadingSubscription
const loadingRenewalAction = epayCheckout.loadingRenewalAction
const subscriptionLoadError = epayCheckout.subscriptionLoadError
const message = epayCheckout.message

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

const hasActiveSubscription = computed(() => currentSubscription.value?.status === 'active')

const activePlanId = computed(() => {
  if (!hasActiveSubscription.value)
    return null

  return currentSubscription.value?.plan?.id ?? null
})

const currentSubscriptionPlanLabel = computed(() => {
  const plan = currentSubscription.value?.plan
  return plan?.label ?? t('settings.pages.flux.subscription.unknownPlan')
})

function formatSubscriptionDate(value: string | null | undefined): string {
  if (!value)
    return t('settings.pages.flux.subscription.noEndDate')

  return new Date(value).toLocaleDateString()
}

function formatPlanPeriod(periodDays: number | null | undefined): string {
  if (!periodDays)
    return t('settings.pages.flux.plans.periodUnknown')

  return t('settings.pages.flux.plans.periodDays', { days: periodDays })
}

function subscriptionStatusLabel(status: string | undefined): string {
  if (!status)
    return t('settings.pages.flux.subscription.status.none')

  const key = `settings.pages.flux.subscription.status.${status}`
  const label = t(key)
  return label === key ? t('settings.pages.flux.subscription.status.unknown') : label
}

function subscriptionStatusClasses(status: string | undefined): string[] {
  const base = ['inline-flex', 'items-center', 'rounded-full', 'px-2.5', 'py-1', 'text-xs', 'font-medium']
  if (status === 'active')
    return [...base, 'bg-green-500/10', 'text-green-600', 'dark:text-green-400']
  if (status === 'expired' || status === 'canceled')
    return [...base, 'bg-orange-500/10', 'text-orange-600', 'dark:text-orange-400']

  return [...base, 'bg-neutral-500/10', 'text-neutral-600', 'dark:text-neutral-300']
}

function planActionLabel(plan: EpaySubscriptionPlan): string {
  if (activePlanId.value === plan.id)
    return t('settings.pages.flux.plans.renew')

  return activePlanId.value ? t('settings.pages.flux.plans.switch') : t('settings.pages.flux.plans.subscribe')
}

function messageClasses(type: EpayMessageType): string[] {
  const base = ['rounded-lg', 'p-3', 'text-sm']
  if (type === 'success')
    return [...base, 'bg-green-500/10', 'text-green-600', 'dark:text-green-400']
  if (type === 'error')
    return [...base, 'bg-red-500/10', 'text-red-600', 'dark:text-red-400']
  if (type === 'warning')
    return [...base, 'bg-orange-500/10', 'text-orange-600', 'dark:text-orange-400']

  return [...base, 'bg-blue-500/10', 'text-blue-600', 'dark:text-blue-400']
}

function optionalValue(value: string | number | boolean | null | undefined): string {
  if (value == null || value === '')
    return t('settings.pages.flux.subscription.notAvailable')
  if (typeof value === 'boolean')
    return value ? t('settings.pages.flux.subscription.yes') : t('settings.pages.flux.subscription.no')
  if (typeof value === 'number')
    return formatNumber(value)

  return value
}

function cancelAtPeriodEndLabel(value: boolean | undefined): string {
  if (value == null)
    return t('settings.pages.flux.subscription.notAvailable')

  return value
    ? t('settings.pages.flux.subscription.cancelAtPeriodEndEnabled')
    : t('settings.pages.flux.subscription.cancelAtPeriodEndDisabled')
}

const renewalActionLabel = computed(() => {
  if (currentSubscription.value?.cancelAtPeriodEnd)
    return t('settings.pages.flux.subscription.resumeRenewal')

  return t('settings.pages.flux.subscription.cancelRenewal')
})

async function handleRenewalAction() {
  if (!hasActiveSubscription.value)
    return

  if (currentSubscription.value?.cancelAtPeriodEnd)
    await epayCheckout.resumeRenewal()
  else
    await epayCheckout.cancelRenewal()
}

// Group consecutive TTS debit records into collapsible rows
type GroupedRow = {
  type: 'single'
  record: AuditRecord
} | {
  type: 'group'
  key: string
  description: string
  model: string
  count: number
  totalAmount: number
  firstTime: string
  lastTime: string
  records: AuditRecord[]
}

const expandedGroups = ref<Set<string>>(new Set())

function toggleGroup(key: string) {
  if (expandedGroups.value.has(key))
    expandedGroups.value.delete(key)
  else
    expandedGroups.value.add(key)
}

const groupedRows = computed<GroupedRow[]>(() => {
  const rows: GroupedRow[] = []
  let i = 0
  const records = auditRecords.value

  while (i < records.length) {
    const record = records[i]
    if (record.type === 'debit' && record.description?.startsWith('tts:')) {
      // Collect consecutive TTS records with the same description
      const group: AuditRecord[] = [record]
      while (i + 1 < records.length
        && records[i + 1].type === 'debit'
        && records[i + 1].description === record.description) {
        i++
        group.push(records[i])
      }

      if (group.length > 1) {
        rows.push({
          type: 'group',
          key: `tts-group-${record.id}`,
          description: record.description,
          model: (record.metadata?.model as string) || '',
          count: group.length,
          totalAmount: group.reduce((sum, r) => sum + r.amount, 0),
          firstTime: group.at(-1)!.createdAt,
          lastTime: group[0].createdAt,
          records: group,
        })
      }
      else {
        rows.push({ type: 'single', record })
      }
    }
    else {
      rows.push({ type: 'single', record })
    }
    i++
  }

  return rows
})

onMounted(async () => {
  const creditsRefresh = authStore.updateCredits()
  void Promise.allSettled([
    refreshFluxData(),
    epayCheckout.getCurrentSubscription(),
    ...(fluxPurchaseDisabled ? [] : [epayCheckout.listPlans()]),
  ])

  const epayTrade = typeof route.query.epay_trade === 'string' ? route.query.epay_trade : undefined
  if (epayTrade) {
    const query = { ...route.query }
    delete query.epay_trade
    delete query.epay_return
    void router.replace({ query })
    void epayCheckout.pollReturnedOrder(epayTrade)
  }

  await creditsRefresh.catch(() => undefined)

  // PostHog funnel step 1: subscription pricing surface view. Today this is an
  // in-app settings page (already-authenticated users); when we add a public
  // pricing landing page the surface label changes but the event stays the same.
  if (!fluxPurchaseDisabled) {
    trackPaywallSeen({
      surface: 'settings_flux',
      reason: 'unknown',
      flux_balance_bucket: fluxBalanceBucket(credits.value),
    })
    trackPricingViewed('settings_flux', 'monthly')
    if (credits.value <= 0) {
      trackQuotaLimitReached({
        limit_type: 'flux',
        current_usage: credits.value,
        limit_value: capacity.value > 0 ? capacity.value : undefined,
        entry: 'pricing',
      })
    }
  }
})

async function handleBuy(plan: EpaySubscriptionPlan) {
  // PostHog funnel step 2: user picked a subscription plan. price_minor_unit
  // lives on the server-side payment completion event; the SPA only sends the
  // stable plan id so funnels do not depend on localized currency formatting.
  trackUpgradeClicked({
    source_page: 'settings_flux',
    current_plan: activePlanId.value ?? 'free',
    trigger: 'pricing_page',
  })
  trackPlanSelected(plan.id, { currency: 'cny' })
  const payUrl = await epayCheckout.createCheckout({ planId: plan.id })
  if (payUrl)
    trackCheckoutStarted(plan.id, { currency: 'cny' })
}
</script>

<template>
  <div flex="~ col gap-6" p-4>
    <!-- Message banner -->
    <div
      v-if="message"
      :class="messageClasses(message.type)"
    >
      {{ message.text }}
    </div>

    <!-- Battery Card -->
    <div relative overflow-hidden rounded-2xl bg="neutral-100 dark:neutral-800" p-6 sm:p-8>
      <!-- Background Progress -->
      <div
        class="flux-progress-bar absolute inset-y-0 left-0 bg-primary-500/20 dark:bg-primary-400/20"
      />

      <!-- Content -->
      <div relative z-1 flex="~ items-center justify-start sm:col sm:justify-center gap-4 sm:gap-2" text-left sm:text-center>
        <div i-solar:battery-charge-bold-duotone size-12 shrink-0 text-primary-500 sm:mx-auto sm:size-14 />
        <div flex="~ col gap-1">
          <h2 text-3xl font-bold tracking-tight sm:text-4xl>
            {{ formatNumber(credits) }}
          </h2>
          <p text="sm neutral-500">
            {{ t(fluxPurchaseDisabled ? 'settings.pages.account.fluxBalance' : 'settings.pages.flux.balance.description') }}
          </p>
        </div>
      </div>
    </div>

    <div v-if="!fluxPurchaseDisabled" flex="~ col gap-4">
      <section
        :class="[
          'rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm',
          'dark:border-neutral-800 dark:bg-neutral-900',
        ]"
      >
        <div flex="~ col gap-4 sm:row sm:items-center sm:justify-between">
          <div flex="~ col gap-1">
            <div flex="~ items-center gap-2">
              <h3 text-lg font-semibold>
                {{ t('settings.pages.flux.subscription.title') }}
              </h3>
              <span :class="subscriptionStatusClasses(currentSubscription?.status)">
                {{ subscriptionStatusLabel(currentSubscription?.status) }}
              </span>
            </div>
            <p v-if="loadingSubscription" text="sm neutral-500">
              {{ t('settings.pages.flux.subscription.loading') }}
            </p>
            <p v-else-if="subscriptionLoadError" text="sm red-600 dark:red-400">
              {{ subscriptionLoadError }}
            </p>
            <p v-else-if="currentSubscription" text="sm neutral-500">
              {{ t('settings.pages.flux.subscription.activeDescription', {
                plan: currentSubscriptionPlanLabel,
                end: formatSubscriptionDate(currentSubscription.currentPeriodEnd),
              }) }}
            </p>
            <p v-else text="sm neutral-500">
              {{ t('settings.pages.flux.subscription.emptyDescription') }}
            </p>
          </div>
          <Button
            v-if="hasActiveSubscription"
            :label="renewalActionLabel"
            :loading="loadingRenewalAction !== null"
            :disabled="loadingRenewalAction !== null || loadingSubscription"
            @click="handleRenewalAction"
          />
        </div>

        <div
          v-if="currentSubscription"
          :class="[
            'mt-4 grid grid-cols-1 gap-3 border-t border-neutral-100 pt-4 text-sm',
            'sm:grid-cols-2 lg:grid-cols-3 dark:border-neutral-800',
          ]"
        >
          <div flex="~ col gap-1">
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.currentPeriodStart') }}
            </span>
            <strong text="neutral-800 dark:neutral-100">
              {{ formatSubscriptionDate(currentSubscription.currentPeriodStart) }}
            </strong>
          </div>
          <div flex="~ col gap-1">
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.currentPeriodEnd') }}
            </span>
            <strong text="neutral-800 dark:neutral-100">
              {{ formatSubscriptionDate(currentSubscription.currentPeriodEnd) }}
            </strong>
          </div>
          <div flex="~ col gap-1">
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.cancelAtPeriodEnd') }}
            </span>
            <strong text="neutral-800 dark:neutral-100">
              {{ cancelAtPeriodEndLabel(currentSubscription.cancelAtPeriodEnd) }}
            </strong>
          </div>
          <div flex="~ col gap-1">
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.lastPaymentOrderId') }}
            </span>
            <strong break-all text="neutral-800 dark:neutral-100">
              {{ optionalValue(currentSubscription.lastPaymentOrderId) }}
            </strong>
          </div>
          <div
            v-if="currentSubscription.currentPeriodFluxAmount != null"
            flex="~ col gap-1"
          >
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.currentPeriodFluxAmount') }}
            </span>
            <strong text="neutral-800 dark:neutral-100">
              {{ optionalValue(currentSubscription.currentPeriodFluxAmount) }}
            </strong>
          </div>
          <div
            v-if="currentSubscription.remainingDays != null"
            flex="~ col gap-1"
          >
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.remainingDays') }}
            </span>
            <strong text="neutral-800 dark:neutral-100">
              {{ t('settings.pages.flux.subscription.remainingDaysValue', { days: currentSubscription.remainingDays }) }}
            </strong>
          </div>
          <div
            v-if="currentSubscription.isRenewable != null"
            flex="~ col gap-1"
          >
            <span text="neutral-500">
              {{ t('settings.pages.flux.subscription.isRenewable') }}
            </span>
            <strong text="neutral-800 dark:neutral-100">
              {{ optionalValue(currentSubscription.isRenewable) }}
            </strong>
          </div>
        </div>
      </section>

      <section flex="~ col gap-3">
        <div flex="~ col gap-1">
          <h3 text-lg font-semibold>
            {{ t('settings.pages.flux.plans.title') }}
          </h3>
          <p text="sm neutral-500">
            {{ t('settings.pages.flux.plans.description') }}
          </p>
        </div>

        <div v-if="loadingPlans && plans.length === 0" text="sm neutral-500" py-4 text-center>
          {{ t('settings.pages.flux.plans.loading') }}
        </div>

        <div v-else-if="plans.length === 0" text="sm neutral-500" py-4 text-center>
          {{ t('settings.pages.flux.plans.empty') }}
        </div>

        <div v-else grid="~ cols-1 sm:cols-3 gap-4">
          <article
            v-for="(plan, index) in plans"
            :key="plan.id"
            :class="[
              'relative flex flex-col gap-4 overflow-hidden rounded-2xl border-2 bg-white p-5 transition-all duration-300 ease-out',
              activePlanId === plan.id || index === 1 ? 'border-primary-400 shadow-sm dark:border-primary-500' : 'border-neutral-200 dark:border-neutral-800',
              'dark:bg-neutral-900',
            ]"
          >
            <div
              v-if="index === 1"
              :class="[
                'absolute right-0 top-0 flex items-center gap-1 rounded-bl-xl bg-primary-500 px-2.5 py-1',
                'text-[10px] text-white font-bold tracking-wider uppercase shadow-sm',
              ]"
            >
              <div class="i-solar:star-fall-bold-duotone size-3" />
              {{ t('settings.pages.flux.plans.recommended') }}
            </div>

            <div flex="~ col gap-2">
              <div flex="~ items-start justify-between gap-3">
                <div flex="~ col gap-1">
                  <h4 text="base neutral-800 dark:neutral-100" font-semibold>
                    {{ plan.label }}
                  </h4>
                  <p text="xs neutral-500">
                    {{ formatPlanPeriod(plan.periodDays) }}
                  </p>
                </div>
                <span
                  v-if="activePlanId === plan.id"
                  :class="subscriptionStatusClasses('active')"
                >
                  {{ t('settings.pages.flux.plans.current') }}
                </span>
              </div>

              <p v-if="plan.description" text="sm neutral-500">
                {{ plan.description }}
              </p>
            </div>

            <div flex="~ col gap-1">
              <div flex="~ items-baseline gap-1">
                <span text="3xl neutral-900 dark:neutral-50" font-bold>
                  ¥{{ plan.amountYuan }}
                </span>
                <span text="sm neutral-500">
                  / {{ formatPlanPeriod(plan.periodDays) }}
                </span>
              </div>
              <p text="sm primary-600 dark:primary-400" font-medium>
                {{ t('settings.pages.flux.plans.fluxPerPeriod', { flux: formatNumber(plan.fluxAmount) }) }}
              </p>
            </div>

            <Button
              :label="planActionLabel(plan)"
              :loading="loadingPlanId === plan.id"
              :disabled="loadingPlanId !== null"
              @click="handleBuy(plan)"
            />
          </article>
        </div>
      </section>
    </div>

    <!-- Audit History -->
    <div flex="~ col gap-3">
      <div flex="~ col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
        <h3 text-lg font-semibold>
          {{ t('settings.pages.flux.audit.title') }}
        </h3>
        <span text="xs neutral-400">
          {{ t('settings.pages.flux.audit.delayHint') }}
        </span>
      </div>

      <div v-if="auditLoading && auditRecords.length === 0" text="sm neutral-500" py-4 text-center>
        {{ t('settings.pages.flux.audit.loading') }}
      </div>

      <div v-else-if="auditRecords.length === 0" text="sm neutral-500" py-4 text-center>
        {{ t('settings.pages.flux.audit.empty') }}
      </div>

      <!-- Desktop: table -->
      <div v-else border="1 neutral-200 dark:neutral-800" overflow-x-auto rounded-xl hidden sm:block>
        <table w-full text-sm>
          <thead border="b neutral-200 dark:neutral-800">
            <tr>
              <th px-4 py-3 text-left font-medium>
                {{ t('settings.pages.flux.audit.time') }}
              </th>
              <th px-4 py-3 text-left font-medium>
                {{ t('settings.pages.flux.audit.type') }}
              </th>
              <th px-4 py-3 text-left font-medium>
                {{ t('settings.pages.flux.audit.detail') }}
              </th>
              <th px-4 py-3 text-right font-medium>
                {{ t('settings.pages.flux.audit.amount') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="row in groupedRows" :key="row.type === 'single' ? row.record.id : row.key">
              <!-- Single record -->
              <tr
                v-if="row.type === 'single'"
                border="b neutral-100 dark:neutral-800/50 last:none"
              >
                <td whitespace-nowrap px-4 py-3 text="neutral-500">
                  {{ formatDate(row.record.createdAt) }}
                </td>
                <td px-4 py-3>
                  <span
                    inline-block rounded-full px-2 py-0.5 text-xs font-medium
                    :class="row.record.type === 'debit'
                      ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                      : 'bg-green-500/10 text-green-600 dark:text-green-400'"
                  >
                    {{ typeLabel(row.record.type) }}
                  </span>
                </td>
                <td px-4 py-3>
                  <span>{{ row.record.description }}</span>
                  <span
                    v-if="row.record.metadata?.promptTokens != null"
                    ml-1 text="xs neutral-400"
                  >
                    ({{ row.record.metadata.promptTokens }}+{{ row.record.metadata.completionTokens }} tokens)
                  </span>
                  <span
                    v-else-if="row.record.description?.startsWith('tts:') && row.record.metadata?.model"
                    ml-1 text="xs neutral-400"
                  >
                    ({{ row.record.metadata.model }})
                  </span>
                </td>
                <td px-4 py-3 text-right font-mono>
                  <span :class="isPositive(row.record) ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">
                    {{ displayAmount(row.record) }}
                  </span>
                </td>
              </tr>

              <!-- Grouped TTS records -->
              <tr
                v-else
                :class="['cursor-pointer', 'hover:bg-neutral-50', 'dark:hover:bg-neutral-800/30']"
                border="b neutral-100 dark:neutral-800/50"
                @click="toggleGroup(row.key)"
              >
                <td whitespace-nowrap px-4 py-3 text="neutral-500">
                  {{ formatDate(row.lastTime) }}
                </td>
                <td px-4 py-3>
                  <span
                    :class="['inline-block', 'rounded-full', 'px-2', 'py-0.5', 'text-xs', 'font-medium',
                             'bg-orange-500/10', 'text-orange-600', 'dark:text-orange-400']"
                  >
                    {{ t('settings.pages.flux.audit.typeConsumption') }}
                  </span>
                </td>
                <td px-4 py-3>
                  <span flex="~ items-center gap-1">
                    <span
                      :class="expandedGroups.has(row.key) ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone'"
                      inline-block size-4 text="neutral-400"
                    />
                    {{ row.description }}
                    <span ml-1 text="xs neutral-400">
                      ({{ row.count }} {{ t('settings.pages.flux.audit.ttsRequests') }})
                    </span>
                  </span>
                </td>
                <td px-4 py-3 text-right font-mono>
                  <span text="orange-600 dark:orange-400">
                    -{{ row.totalAmount }}
                  </span>
                </td>
              </tr>

              <!-- Expanded group children -->
              <tr
                v-for="child in (row.type === 'group' && expandedGroups.has(row.key) ? row.records : [])"
                :key="child.id"
                border="b neutral-100 dark:neutral-800/50 last:none" bg="neutral-50/50 dark:neutral-800/20"
              >
                <td whitespace-nowrap px-4 py-2 pl-8 text="xs neutral-400">
                  {{ formatDate(child.createdAt) }}
                </td>
                <td px-4 py-2 />
                <td px-4 py-2 text="xs neutral-400">
                  {{ child.description }}
                </td>
                <td px-4 py-2 text-right font-mono text="xs orange-500 dark:orange-400">
                  -{{ child.amount }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Mobile: card list -->
      <div v-if="auditRecords.length > 0" flex="~ col gap-2" sm:hidden>
        <template v-for="row in groupedRows" :key="row.type === 'single' ? row.record.id : row.key">
          <!-- Single record card -->
          <div
            v-if="row.type === 'single'"
            border="1 neutral-200 dark:neutral-800" flex="~ col gap-1.5" rounded-lg px-3 py-2.5
          >
            <div flex="~ items-center justify-between">
              <span
                inline-block rounded-full px-2 py-0.5 text-xs font-medium
                :class="row.record.type === 'debit'
                  ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'"
              >
                {{ typeLabel(row.record.type) }}
              </span>
              <span text-sm font-semibold font-mono :class="isPositive(row.record) ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'">
                {{ displayAmount(row.record) }}
              </span>
            </div>
            <div text="sm neutral-600 dark:neutral-300" truncate>
              {{ row.record.description }}
              <span
                v-if="row.record.metadata?.promptTokens != null"
                ml-1 text="xs neutral-400"
              >
                ({{ row.record.metadata.promptTokens }}+{{ row.record.metadata.completionTokens }} tokens)
              </span>
              <span
                v-else-if="row.record.description?.startsWith('tts:') && row.record.metadata?.model"
                ml-1 text="xs neutral-400"
              >
                ({{ row.record.metadata.model }})
              </span>
            </div>
            <div text="xs neutral-400">
              {{ formatDate(row.record.createdAt) }}
            </div>
          </div>

          <!-- Grouped TTS card -->
          <div
            v-else
            border="1 neutral-200 dark:neutral-800" flex="~ col gap-1.5" cursor-pointer rounded-lg px-3 py-2.5
            @click="toggleGroup(row.key)"
          >
            <div flex="~ items-center justify-between">
              <span
                :class="['inline-block', 'rounded-full', 'px-2', 'py-0.5', 'text-xs', 'font-medium',
                         'bg-orange-500/10', 'text-orange-600', 'dark:text-orange-400']"
              >
                {{ t('settings.pages.flux.audit.typeConsumption') }}
              </span>
              <span text-sm font-semibold font-mono text="orange-600 dark:orange-400">
                -{{ row.totalAmount }}
              </span>
            </div>
            <div flex="~ items-center gap-1" text="sm neutral-600 dark:neutral-300">
              <span
                :class="expandedGroups.has(row.key) ? 'i-solar:alt-arrow-down-line-duotone' : 'i-solar:alt-arrow-right-line-duotone'"
                inline-block size-4 text="neutral-400"
              />
              {{ row.description }}
              <span text="xs neutral-400">({{ row.count }} {{ t('settings.pages.flux.audit.ttsRequests') }})</span>
            </div>
            <div text="xs neutral-400">
              {{ formatDate(row.lastTime) }}
            </div>

            <!-- Expanded children -->
            <div v-if="row.type === 'group' && expandedGroups.has(row.key)" flex="~ col gap-1" mt-1 border="t neutral-200 dark:neutral-700" pt-2>
              <div
                v-for="child in row.records" :key="child.id"
                flex="~ items-center justify-between" text="xs neutral-400"
              >
                <span>{{ formatDate(child.createdAt) }}</span>
                <span font-mono>-{{ child.amount }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="auditHasMore" text-center>
        <Button
          :label="t('settings.pages.flux.audit.loadMore')"
          :loading="auditLoading"
          @click="fetchAuditHistory(true)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.flux-progress-bar {
  width: 100%;
  animation: flux-progress-bar-grow 1s cubic-bezier(0.4, 0, 0.2, 1) 0.5s forwards;
}

@keyframes flux-progress-bar-grow {
  0% {
    width: 100%;
    opacity: 0.5;
  }
  100% {
    width: v-bind('`${fluxPercentage}%`');
    opacity: 1;
  }
}
</style>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.flux.title
  icon: i-solar:battery-charge-bold-duotone
</route>

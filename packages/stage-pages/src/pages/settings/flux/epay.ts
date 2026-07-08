import { ref } from 'vue'

export interface EpaySubscriptionPlan {
  id: string
  label: string
  name?: string
  description?: string | null
  amountFen?: number
  amountYuan: string
  fluxAmount: number
  periodDays?: number | null
  kind?: string
}

export interface EpayFluxPackage extends EpaySubscriptionPlan {}

export interface CurrentSubscription {
  status: string
  plan?: EpaySubscriptionPlan | null
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
  lastPaymentOrderId?: string | null
  currentPeriodFluxAmount?: number | null
  remainingDays?: number | null
  isRenewable?: boolean | null
}

export interface CurrentSubscriptionResponse {
  subscription: CurrentSubscription | null
}

export interface EpayCheckoutResult {
  checkoutUrl?: string
  payUrl?: string
  outTradeNo?: string
  planId?: string
  amountYuan?: string
  fluxAmount?: number
}

export type EpayMessageType = 'success' | 'error' | 'info' | 'warning'

export interface EpayFluxCheckoutOptions {
  fetcher?: typeof fetch
  openPayUrl: (payUrl: string) => void
  pollAttempts?: number
  pollDelayMs?: number
  refreshCredits: () => Promise<unknown>
  refreshFluxData: () => Promise<unknown>
  serverUrl: string
  translate: (key: string, params?: Record<string, unknown>) => string
}

interface EpayOrderStatus {
  fluxAmount?: number
  fluxCredited?: boolean
  status?: string
}

interface RawPlan {
  id: string
  label?: string
  name?: string
  description?: string | null
  amountFen?: number
  amountYuan?: string
  fluxAmount?: number
  periodDays?: number | null
  kind?: string
}

function normalizePlan(plan: RawPlan): EpaySubscriptionPlan {
  const label = plan.label ?? plan.name ?? plan.id

  return {
    id: plan.id,
    label,
    name: plan.name,
    description: plan.description ?? null,
    amountFen: plan.amountFen,
    amountYuan: plan.amountYuan ?? (typeof plan.amountFen === 'number' ? (plan.amountFen / 100).toFixed(2) : '0.00'),
    fluxAmount: plan.fluxAmount ?? 0,
    periodDays: plan.periodDays ?? null,
    kind: plan.kind,
  }
}

function normalizeSubscription(subscription: CurrentSubscription | null): CurrentSubscription | null {
  if (!subscription)
    return null

  return {
    ...subscription,
    plan: subscription.plan ? normalizePlan(subscription.plan) : null,
  }
}

export function createEpayFluxCheckout(options: EpayFluxCheckoutOptions) {
  const fetcher = options.fetcher ?? fetch
  const serverUrl = options.serverUrl.replace(/\/$/, '')
  const plans = ref<EpaySubscriptionPlan[]>([])
  const currentSubscription = ref<CurrentSubscription | null>(null)
  const loadingPlanId = ref<string | null>(null)
  const loadingPlans = ref(false)
  const loadingSubscription = ref(false)
  const loadingRenewalAction = ref<'cancel' | 'resume' | null>(null)
  const subscriptionLoadError = ref<string | null>(null)
  const message = ref<{ type: EpayMessageType, text: string } | null>(null)
  const pollAttempts = options.pollAttempts ?? 5
  const pollDelayMs = options.pollDelayMs ?? 1000

  async function listPlans() {
    loadingPlans.value = true
    try {
      const res = await fetcher(`${serverUrl}/api/v1/epay/plans`, {
        credentials: 'include',
      })
      if (!res.ok)
        throw new Error(`Failed to load epay plans: ${res.status}`)

      plans.value = ((await res.json()) as RawPlan[]).map(normalizePlan)
    }
    catch {
      message.value = {
        type: 'error',
        text: options.translate('settings.pages.flux.plans.error'),
      }
    }
    finally {
      loadingPlans.value = false
    }
  }

  async function getCurrentSubscription() {
    loadingSubscription.value = true
    subscriptionLoadError.value = null
    try {
      const res = await fetcher(`${serverUrl}/api/v1/subscriptions/current`, {
        credentials: 'include',
      })
      if (res.status === 404) {
        currentSubscription.value = null
        return null
      }
      if (!res.ok)
        throw new Error(`Failed to load current subscription: ${res.status}`)

      const data = await res.json() as CurrentSubscriptionResponse
      currentSubscription.value = normalizeSubscription(data.subscription)
      return currentSubscription.value
    }
    catch {
      const text = options.translate('settings.pages.flux.subscription.loadError')
      currentSubscription.value = null
      subscriptionLoadError.value = text
      message.value = { type: 'error', text }
      return null
    }
    finally {
      loadingSubscription.value = false
    }
  }

  async function createCheckout(params: { planId: string, type?: 'alipay' | 'wxpay' }) {
    loadingPlanId.value = params.planId
    message.value = null

    try {
      const res = await fetcher(`${serverUrl}/api/v1/epay/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ planId: params.planId, type: params.type ?? 'alipay' }),
      })

      if (!res.ok) {
        message.value = {
          type: 'error',
          text: options.translate('settings.pages.flux.epay.errorCheckout'),
        }
        return
      }

      const data = await res.json() as EpayCheckoutResult
      const payUrl = data.checkoutUrl ?? data.payUrl
      if (payUrl) {
        options.openPayUrl(payUrl)
        return payUrl
      }

      message.value = {
        type: 'error',
        text: options.translate('settings.pages.flux.epay.errorCheckout'),
      }
    }
    catch {
      message.value = {
        type: 'error',
        text: options.translate('settings.pages.flux.epay.errorNetwork'),
      }
    }
    finally {
      loadingPlanId.value = null
    }
  }

  async function checkout(plan: EpaySubscriptionPlan, type: 'alipay' | 'wxpay' = 'alipay') {
    return createCheckout({ planId: plan.id, type })
  }

  async function refreshAfterSubscriptionMutation() {
    await Promise.allSettled([
      options.refreshCredits(),
      options.refreshFluxData(),
      getCurrentSubscription(),
    ])
  }

  async function changeRenewal(action: 'cancel' | 'resume') {
    const endpoint = action === 'cancel' ? 'cancel-renewal' : 'resume-renewal'
    const successKey = action === 'cancel'
      ? 'settings.pages.flux.subscription.cancelRenewalSuccess'
      : 'settings.pages.flux.subscription.resumeRenewalSuccess'
    const errorKey = action === 'cancel'
      ? 'settings.pages.flux.subscription.cancelRenewalError'
      : 'settings.pages.flux.subscription.resumeRenewalError'

    loadingRenewalAction.value = action
    message.value = null
    try {
      const res = await fetcher(`${serverUrl}/api/v1/subscriptions/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok)
        throw new Error(`Failed to ${endpoint}: ${res.status}`)

      await refreshAfterSubscriptionMutation()
      message.value = {
        type: 'success',
        text: options.translate(successKey),
      }
      return true
    }
    catch {
      message.value = {
        type: 'error',
        text: options.translate(errorKey),
      }
      return false
    }
    finally {
      loadingRenewalAction.value = null
    }
  }

  async function cancelRenewal() {
    return changeRenewal('cancel')
  }

  async function resumeRenewal() {
    return changeRenewal('resume')
  }

  async function pollReturnedOrder(outTradeNo: string) {
    for (let attempt = 0; attempt < pollAttempts; attempt++) {
      if (attempt > 0 && pollDelayMs > 0)
        await new Promise(resolve => setTimeout(resolve, pollDelayMs))

      try {
        const res = await fetcher(`${serverUrl}/api/v1/epay/order/${encodeURIComponent(outTradeNo)}`, {
          credentials: 'include',
        })
        if (!res.ok)
          continue

        const order = await res.json() as EpayOrderStatus
        if (!order.fluxCredited)
          continue

        await refreshAfterSubscriptionMutation()
        message.value = {
          type: 'success',
          text: options.translate('settings.pages.flux.epay.successSubscribed', { flux: order.fluxAmount ?? 0 }),
        }
        return
      }
      catch {
        // Keep polling; epay's async notify can arrive after the browser return.
      }
    }

    message.value = {
      type: 'info',
      text: options.translate('settings.pages.flux.epay.pendingNotify'),
    }
  }

  return {
    cancelRenewal,
    checkout,
    createCheckout,
    currentSubscription,
    getCurrentSubscription,
    listPlans,
    loadCurrentSubscription: getCurrentSubscription,
    loadPackages: listPlans,
    loadingPackageId: loadingPlanId,
    loadingPlanId,
    loadingPlans,
    loadingRenewalAction,
    loadingSubscription,
    message,
    packages: plans,
    plans,
    pollReturnedOrder,
    resumeRenewal,
    subscriptionLoadError,
  }
}

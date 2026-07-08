import type { SubscriptionPlan, UserSubscription } from '../../schemas/subscriptions'
import type { SubscriptionService } from '../../services/domain/subscriptions'
import type { HonoEnv } from '../../types/hono'

import { Hono } from 'hono'

import { authGuard } from '../../middlewares/auth'
import { ApiError } from '../../utils/error'

type CurrentSubscriptionStatus = 'none' | UserSubscription['status']

interface CurrentSubscriptionPlanResponse {
  id: string
  name: string
  description: string | null
  periodDays: number
  amountFen: number
  amountYuan: string
  fluxAmount: number
}

interface CurrentSubscriptionResponse {
  status: CurrentSubscriptionStatus
  plan: CurrentSubscriptionPlanResponse | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean | null
  lastPaymentOrderId: string | null
  remainingDays: number
  currentPeriodFluxAmount: number
  isRenewable: boolean
}

/**
 * Creates authenticated subscription account routes for the product subscription center.
 */
export function createSubscriptionRoutes(subscriptionService: SubscriptionService) {
  return new Hono<HonoEnv>()
    .use('*', authGuard)
    .get('/current', async (c) => {
      const user = c.get('user')!
      const subscription = await subscriptionService.getCurrentSubscription(user.id)

      return c.json({
        subscription: await currentSubscriptionToResponse(subscriptionService, subscription),
      })
    })
    .post('/cancel-renewal', async (c) => {
      const user = c.get('user')!
      const subscription = await subscriptionService.markCancelAtPeriodEnd(user.id)

      return c.json({
        subscription: await currentSubscriptionToResponse(subscriptionService, subscription),
      })
    })
    .post('/resume-renewal', async (c) => {
      const user = c.get('user')!
      const subscription = await subscriptionService.resumeRenewal(user.id)

      return c.json({
        subscription: await currentSubscriptionToResponse(subscriptionService, subscription),
      })
    })
}

async function currentSubscriptionToResponse(
  subscriptionService: SubscriptionService,
  subscription: UserSubscription | null,
): Promise<CurrentSubscriptionResponse> {
  if (!subscription) {
    return {
      status: 'none',
      plan: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: null,
      lastPaymentOrderId: null,
      remainingDays: 0,
      currentPeriodFluxAmount: 0,
      isRenewable: false,
    }
  }

  const plan = await tryGetPlan(subscriptionService, subscription.planId)
  const paidPeriod = subscription.lastPaymentOrderId
    ? await subscriptionService.getPeriodByOrder(subscription.lastPaymentOrderId)
    : null
  const now = new Date()
  const isRenewable = subscription.status === 'active' && subscription.currentPeriodEnd > now

  return {
    status: subscription.status,
    plan: plan ? planToResponse(plan) : null,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    lastPaymentOrderId: subscription.lastPaymentOrderId,
    remainingDays: remainingDays(subscription.currentPeriodEnd, now),
    currentPeriodFluxAmount: paidPeriod?.fluxAmount ?? plan?.fluxAmount ?? 0,
    isRenewable,
  }
}

function planToResponse(plan: SubscriptionPlan): CurrentSubscriptionPlanResponse {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    periodDays: plan.periodDays,
    amountFen: plan.amountFen,
    amountYuan: (plan.amountFen / 100).toFixed(2),
    fluxAmount: plan.fluxAmount,
  }
}

async function tryGetPlan(
  subscriptionService: SubscriptionService,
  planId: string,
): Promise<SubscriptionPlan | null> {
  try {
    return await subscriptionService.getPlan(planId)
  }
  catch (err) {
    if (err instanceof ApiError && err.statusCode === 404)
      return null
    throw err
  }
}

function remainingDays(periodEnd: Date, now: Date): number {
  if (periodEnd <= now)
    return 0
  return Math.ceil((periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

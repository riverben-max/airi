import type { Context } from 'hono'

import type { Env } from '../../libs/env'
import type { SubscriptionPlan } from '../../schemas/subscriptions'
import type { EpayService } from '../../services/domain/epay'
import type { HonoEnv } from '../../types/hono'

import { Hono } from 'hono'
import { safeParse } from 'valibot'

import { authGuard } from '../../middlewares/auth'
import { EpayConfigurationError, isPublicEpayCallbackUrl, verifyEpaySign } from '../../services/domain/epay'
import { createBadRequestError, createServiceUnavailableError } from '../../utils/error'
import { CreateOrderBodySchema } from './schema'

interface PublicEpayPlan {
  id: string
  label: string
  amountFen: number
  amountYuan: string
  fluxAmount: number
  periodDays?: number
  description?: string | null
  enabled?: boolean
}

// Backward-compatible IDs accepted from older clients that still POST
// `{ packageId }`. These are not advertised when the subscription service is
// available; they only map old one-time package IDs onto matching enabled plans.
const LEGACY_PACKAGE_COMPATIBILITY = [
  { id: 'flux_100', label: '100 Flux', amountFen: 600, fluxAmount: 100 },
  { id: 'flux_600', label: '600 Flux', amountFen: 3000, fluxAmount: 600 },
  { id: 'flux_2400', label: '2400 Flux', amountFen: 9800, fluxAmount: 2400 },
] as const

const EPAY_CALLBACK_BASE_REQUIREMENT = 'EPAY_CALLBACK_BASE_URL'
const EPAY_REQUIRED_CONFIG = ['EPAY_API_URL', 'EPAY_PID', 'EPAY_KEY', EPAY_CALLBACK_BASE_REQUIREMENT] as const
const EPAY_SETUP_MESSAGE = 'Epay checkout is not configured. Configure an Epay merchant account (EPAY_PID, EPAY_KEY, EPAY_API_URL) and set EPAY_CALLBACK_BASE_URL to a public callback base URL. API_SERVER_URL may be used only when it is public.'

interface EpayCheckoutReadiness {
  missing: string[]
  callbackBaseUrl: string
}

export function createEpayRoutes(epayService: EpayService, env: Env) {
  const configured = !!(env.EPAY_API_URL && env.EPAY_PID && env.EPAY_KEY)
  const checkoutReadiness = getEpayCheckoutReadiness(env)
  const handleNotify = async (c: Context<HonoEnv>) => {
    const params = await collectEpayParams(c)

    try {
      await epayService.handleNotify(params)
      return c.text('success')
    }
    catch {
      // Return non-200 so epay retries within its retry window.
      return c.text('fail', 400)
    }
  }

  return new Hono<HonoEnv>()
    /**
     * List available subscription plans with CNY prices.
     * Public — no auth required so the pricing page renders without login.
     */
    .get('/plans', async (c) => {
      return c.json((await listCheckoutPlans(epayService)).map(planToResponse))
    })

    /**
     * Deprecated compatibility alias. It returns subscription plans when the
     * subscription service is available rather than advertising one-time top-up.
     */
    .get('/packages', async (c) => {
      if (!hasPlanService(epayService))
        return c.json(LEGACY_PACKAGE_COMPATIBILITY.map(legacyPackageToCompatibilityResponse))

      return c.json((await listCheckoutPlans(epayService)).map(planToResponse))
    })

    /**
     * Create a new epay subscription order and return a payment URL to redirect
     * the user to. Requires auth. `{ planId }` is preferred; `{ packageId }` is
     * accepted only as a compatibility mapping onto an enabled plan.
     */
    .post('/checkout', authGuard, async (c) => {
      if (checkoutReadiness.missing.length > 0)
        throw createEpayNotConfiguredError(checkoutReadiness.missing)

      const user = c.get('user')!
      const body = await c.req.json().catch(() => null)
      const result = safeParse(CreateOrderBodySchema, body)
      if (!result.success)
        throw createBadRequestError('Invalid request body', 'INVALID_REQUEST', result.issues)

      const plans = await listCheckoutPlans(epayService)
      const plan = resolveCheckoutPlan(plans, result.output.planId, result.output.packageId)
      if (!plan) {
        throw createBadRequestError('Unknown or disabled subscription plan', 'UNKNOWN_PLAN', {
          planId: result.output.planId ?? null,
          packageId: result.output.packageId ?? null,
        })
      }
      if (plan.enabled === false)
        throw createBadRequestError('Subscription plan is disabled', 'PLAN_DISABLED', { planId: plan.id })

      const baseUrl = checkoutReadiness.callbackBaseUrl

      let outTradeNo: string
      let payUrl: string
      try {
        ({ outTradeNo, payUrl } = await epayService.createOrder({
          userId: user.id,
          planId: plan.id,
          orderKind: 'subscription',
          amountFen: plan.amountFen,
          fluxAmount: plan.fluxAmount,
          type: result.output.type ?? 'alipay',
          subject: plan.label,
          notifyUrl: `${baseUrl}/api/v1/epay/notify`,
          returnUrl: `${baseUrl}/api/v1/epay/return`,
        }))
      }
      catch (err) {
        if (err instanceof EpayConfigurationError)
          throw createEpayNotConfiguredError(err.missing)
        throw err
      }

      const response: Record<string, unknown> = { outTradeNo, payUrl }
      if (hasPlanService(epayService)) {
        response.planId = plan.id
        response.amountYuan = plan.amountYuan
        response.fluxAmount = plan.fluxAmount
      }

      return c.json(response)
    })

    /**
     * Async notify endpoint — called by epay's servers on payment success.
     * Must return the plain text "success" within 2 seconds or epay retries.
     * No auth middleware: epay posts from its own servers, not the user's browser.
     */
    .post('/notify', handleNotify)
    .get('/notify', handleNotify)

    /**
     * Sync return endpoint — user is redirected here after paying.
     * Only used to verify signature and show the result; flux credit
     * is authoritative from the async /notify above.
     */
    .get('/return', async (c) => {
      const params = await collectEpayParams(c)
      const valid = configured && verifyEpaySign(params, env.EPAY_KEY)

      const outTradeNo = params.out_trade_no ?? ''
      const order = outTradeNo ? await epayService.getOrder(outTradeNo) : null
      const webUrl = env.WEB_APP_URL.replace(/\/$/, '')
      const returnStatus = valid
        ? order?.fluxCredited === 1
          ? 'paid'
          : order?.status ?? 'unknown'
        : 'invalid'

      const redirectUrl = new URL('/settings/flux', webUrl)
      if (outTradeNo)
        redirectUrl.searchParams.set('epay_trade', outTradeNo)
      redirectUrl.searchParams.set('epay_return', returnStatus)

      return c.redirect(redirectUrl.toString(), 302)
    })

    /**
     * Order status query — polled by the frontend after sync return to confirm credit.
     */
    .get('/order/:outTradeNo', authGuard, async (c) => {
      const user = c.get('user')!
      const { outTradeNo } = c.req.param()
      const order = await epayService.getOrder(outTradeNo)

      if (!order || order.userId !== user.id)
        return c.json({ error: 'NOT_FOUND' }, 404)

      return c.json({
        outTradeNo: order.outTradeNo,
        status: order.status,
        orderKind: order.orderKind ?? null,
        planId: order.planId ?? null,
        fluxCredited: order.fluxCredited === 1,
        fluxAmount: order.fluxAmount,
        amountFen: order.amountFen,
        amountYuan: (order.amountFen / 100).toFixed(2),
        periodStart: order.periodStart?.toISOString() ?? null,
        periodEnd: order.periodEnd?.toISOString() ?? null,
        paidAt: order.paidAt?.toISOString() ?? null,
      })
    })
}

function getEpayCheckoutReadiness(env: Env): EpayCheckoutReadiness {
  const missing: string[] = []

  if (!hasText(env.EPAY_API_URL))
    missing.push('EPAY_API_URL')
  if (!hasText(env.EPAY_PID))
    missing.push('EPAY_PID')
  if (!hasText(env.EPAY_KEY))
    missing.push('EPAY_KEY')

  const callbackBaseUrl = resolvePublicCallbackBaseUrl(env)
  if (!callbackBaseUrl)
    missing.push(EPAY_CALLBACK_BASE_REQUIREMENT)

  return {
    missing,
    callbackBaseUrl: callbackBaseUrl ?? '',
  }
}

function createEpayNotConfiguredError(missing: string[]) {
  return createServiceUnavailableError(EPAY_SETUP_MESSAGE, 'EPAY_NOT_CONFIGURED', {
    missing,
    required: [...EPAY_REQUIRED_CONFIG],
  })
}

function resolvePublicCallbackBaseUrl(env: Env): string | null {
  if (hasText(env.EPAY_CALLBACK_BASE_URL))
    return normalizePublicHttpBaseUrl(env.EPAY_CALLBACK_BASE_URL)

  // EPAY_CALLBACK_BASE_URL is the preferred production setting. API_SERVER_URL
  // remains a fallback only when it is itself publicly reachable by Epay.
  return normalizePublicHttpBaseUrl(env.API_SERVER_URL)
}

function normalizePublicHttpBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim().replace(/\/$/, '')
  if (!trimmed)
    return null

  return isPublicEpayCallbackUrl(trimmed) ? trimmed : null
}

function hasText(value: string | undefined): boolean {
  return value?.trim().length ? true : false
}

async function collectEpayParams(c: Context<HonoEnv>): Promise<Record<string, string>> {
  const params: Record<string, string> = {}

  const rawBody = c.req.method === 'POST'
    ? await c.req.text().catch(() => '')
    : ''
  for (const [key, value] of new URLSearchParams(rawBody))
    params[key] = value

  for (const [key, value] of new URL(c.req.url).searchParams) {
    if (!params[key])
      params[key] = value
  }

  return params
}

async function listCheckoutPlans(epayService: EpayService): Promise<PublicEpayPlan[]> {
  const service = epayService as EpayService & { listPlans?: () => Promise<SubscriptionPlan[]> }
  if (typeof service.listPlans !== 'function')
    return LEGACY_PACKAGE_COMPATIBILITY.map(legacyPackageToPublicPlan)

  return (await service.listPlans()).map(subscriptionPlanToPublicPlan)
}

function resolveCheckoutPlan(plans: PublicEpayPlan[], planId: string | undefined, packageId: string | undefined): PublicEpayPlan | null {
  const normalizedPlanId = normalizeId(planId)
  if (normalizedPlanId)
    return plans.find(plan => plan.id === normalizedPlanId) ?? null

  const normalizedPackageId = normalizeId(packageId)
  if (!normalizedPackageId)
    throw createBadRequestError('planId is required', 'PLAN_REQUIRED')

  const directPlan = plans.find(plan => plan.id === normalizedPackageId)
  if (directPlan)
    return directPlan

  const legacyPackage = LEGACY_PACKAGE_COMPATIBILITY.find(pkg => pkg.id === normalizedPackageId)
  if (!legacyPackage)
    return null

  return plans.find(plan => plan.amountFen === legacyPackage.amountFen && plan.fluxAmount === legacyPackage.fluxAmount) ?? null
}


function hasPlanService(epayService: EpayService): boolean {
  return typeof (epayService as EpayService & { listPlans?: () => Promise<SubscriptionPlan[]> }).listPlans === 'function'
}

function planToResponse(plan: PublicEpayPlan) {
  return {
    id: plan.id,
    label: plan.label,
    description: plan.description ?? null,
    amountFen: plan.amountFen,
    amountYuan: plan.amountYuan,
    fluxAmount: plan.fluxAmount,
    periodDays: plan.periodDays ?? null,
    kind: 'subscription_plan',
  }
}

function subscriptionPlanToPublicPlan(plan: SubscriptionPlan): PublicEpayPlan {
  return {
    id: plan.id,
    label: plan.name,
    description: plan.description,
    amountFen: plan.amountFen,
    amountYuan: (plan.amountFen / 100).toFixed(2),
    fluxAmount: plan.fluxAmount,
    periodDays: plan.periodDays,
    enabled: plan.enabled,
  }
}

function legacyPackageToPublicPlan(pkg: typeof LEGACY_PACKAGE_COMPATIBILITY[number]): PublicEpayPlan {
  return {
    id: pkg.id,
    label: pkg.label,
    amountFen: pkg.amountFen,
    amountYuan: (pkg.amountFen / 100).toFixed(2),
    fluxAmount: pkg.fluxAmount,
  }
}

function legacyPackageToCompatibilityResponse(pkg: typeof LEGACY_PACKAGE_COMPATIBILITY[number]) {
  return {
    id: pkg.id,
    label: pkg.label,
    amountYuan: (pkg.amountFen / 100).toFixed(2),
    fluxAmount: pkg.fluxAmount,
  }
}

function normalizeId(value: string | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

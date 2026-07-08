import type { Database } from '../../libs/db'
import type { SubscriptionPlan } from '../../schemas/subscriptions'
import type { BillingService } from './billing/billing-service'
import type { SubscriptionService } from './subscriptions'

import { createHash } from 'node:crypto'
import { isIP } from 'node:net'

import { useLogger } from '@guiiai/logg'
import { and, eq } from 'drizzle-orm'

import { nanoid } from '../../utils/id'

import * as epaySchema from '../../schemas/epay-order'

const logger = useLogger('epay-service')

export interface EpayConfig {
  apiUrl: string
  pid: string
  key: string
}

const EPAY_CALLBACK_BASE_REQUIREMENT = 'EPAY_CALLBACK_BASE_URL'

/**
 * Signals that checkout cannot talk to a real Epay merchant gateway safely.
 * `missing` contains environment variable names only; it never carries secret
 * values such as EPAY_KEY.
 */
export class EpayConfigurationError extends Error {
  constructor(public readonly missing: string[]) {
    super(`EPAY_NOT_CONFIGURED: missing ${missing.join(', ')}`)
    this.name = 'EpayConfigurationError'
  }
}

export interface CreateOrderInput {
  userId: string
  amountFen: number
  fluxAmount: number
  type: epaySchema.EpayOrderType
  notifyUrl: string
  returnUrl: string
  subject: string
  /** Subscription plan purchased by this order. Null/omitted means legacy top-up. */
  planId?: string | null
  /** Frozen subscription duration. If omitted for subscription orders, the service reads the current plan at checkout. */
  periodDays?: number | null
  /** Frozen checkout plan name used for audit descriptions. */
  planName?: string | null
  /** New orders should use `subscription`; omitted keeps historical top-up compatibility. */
  orderKind?: epaySchema.EpayOrderKind | null
}

export interface CreateOrderResult {
  outTradeNo: string
  /** URL to redirect user to for payment */
  payUrl: string
}

/**
 * Signs epay request params using MD5 per the epay v1 spec.
 *
 * Sorting rule: alphabetical by key, excluding `sign` and `sign_type`,
 * then MD5(urlencoded-query-string + key).
 */
function signParams(params: Record<string, string>, epayKey: string): string {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')

  return createHash('md5').update(sorted + epayKey).digest('hex')
}

/**
 * Verifies epay async notify or sync return signature.
 * Returns true only when the computed sign matches the provided sign.
 */
export function verifyEpaySign(
  params: Record<string, string>,
  epayKey: string,
): boolean {
  const provided = params.sign
  if (!provided)
    return false

  const computed = signParams(params, epayKey)
  return computed === provided
}

export function createEpayService(
  db: Database,
  billingService: BillingService,
  subscriptionService: SubscriptionService,
  config: EpayConfig,
) {
  /** Lists enabled subscription plans that can be sold through epay checkout. */
  async function listPlans(): Promise<SubscriptionPlan[]> {
    return await subscriptionService.listEnabledPlans()
  }

  async function resolveOrderSnapshot(
    input: CreateOrderInput,
    orderKind: epaySchema.EpayOrderKind,
  ): Promise<{ periodDays: number | null, planName: string | null }> {
    if (orderKind !== 'subscription')
      return { periodDays: null, planName: input.planName ?? null }

    if (!input.planId)
      throw new Error('PLAN_NOT_FOUND')

    if (input.periodDays != null) {
      return {
        periodDays: normalizePositiveInteger(input.periodDays, 'periodDays'),
        planName: normalizeOptionalText(input.planName) ?? normalizeOptionalText(input.subject),
      }
    }

    const plan = await subscriptionService.getPlan(input.planId)
    return {
      periodDays: normalizePositiveInteger(plan.periodDays, 'periodDays'),
      planName: normalizeOptionalText(input.planName) ?? plan.name,
    }
  }

  /**
   * Creates a new pending order row and returns the epay payment URL.
   * The URL redirects the user to epay's hosted payment page.
   */
  async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    assertEpayCheckoutConfigured(config, input)

    const outTradeNo = `airi_${Date.now()}_${nanoid(8)}`
    const orderKind = input.orderKind ?? (input.planId ? 'subscription' : 'flux_topup')
    const orderSnapshot = await resolveOrderSnapshot(input, orderKind)

    await db.insert(epaySchema.epayOrders).values({
      outTradeNo,
      userId: input.userId,
      amountFen: input.amountFen,
      fluxAmount: input.fluxAmount,
      type: input.type,
      status: 'pending',
      orderKind,
      planId: input.planId ?? null,
      periodDays: orderSnapshot.periodDays,
      planName: orderSnapshot.planName,
      subject: input.subject,
    })

    // Amount in CNY with two decimal places as required by epay.
    const moneyYuan = (input.amountFen / 100).toFixed(2)

    const params: Record<string, string> = {
      pid: config.pid,
      type: input.type,
      out_trade_no: outTradeNo,
      notify_url: input.notifyUrl,
      return_url: input.returnUrl,
      name: input.subject,
      money: moneyYuan,
    }
    params.sign = signParams(params, config.key)
    params.sign_type = 'MD5'

    const query = new URLSearchParams(params).toString()
    const payUrl = `${config.apiUrl.replace(/\/$/, '')}/submit.php?${query}`

    logger.withFields({
      outTradeNo,
      userId: input.userId,
      amountFen: input.amountFen,
      orderKind: orderKind ?? 'flux_topup',
      planId: input.planId ?? null,
      periodDays: orderSnapshot.periodDays,
    }).log('Epay order created')
    return { outTradeNo, payUrl }
  }

  /**
   * Handles the async notify POST from epay.
   * Returns 'success' string on success (required by epay spec),
   * or throws so the caller can return a non-200 to trigger epay retry.
   *
   * Idempotent: re-notifies for an already-credited order return 'success'
   * without double-crediting Flux or extending the subscription twice.
   */
  async function handleNotify(rawParams: Record<string, string>): Promise<'success'> {
    if (!verifyEpaySign(rawParams, config.key)) {
      logger.withField('params', JSON.stringify(rawParams)).warn('Epay notify signature verification failed')
      throw new Error('INVALID_SIGN')
    }

    const { out_trade_no, trade_status } = rawParams
    if (!out_trade_no) {
      logger.withField('params', JSON.stringify(rawParams)).warn('Epay notify missing out_trade_no')
      throw new Error('ORDER_NOT_FOUND')
    }

    if (rawParams.pid !== config.pid) {
      logger.withFields({ out_trade_no, pid: rawParams.pid }).warn('Epay notify: wrong merchant pid')
      throw new Error('INVALID_PID')
    }

    if (trade_status !== 'TRADE_SUCCESS') {
      // Non-success statuses (TRADE_CLOSED, WAIT_BUYER_PAY) are logged and ignored.
      logger.withFields({ out_trade_no, trade_status }).log('Epay notify non-success status, ignoring')
      return 'success'
    }

    const order = await getOrder(out_trade_no)
    if (!order) {
      logger.withField('out_trade_no', out_trade_no).warn('Epay notify: unknown order')
      throw new Error('ORDER_NOT_FOUND')
    }

    // Idempotency guard — epay may deliver the same notify multiple times.
    if (order.fluxCredited === 1) {
      logger.withField('out_trade_no', out_trade_no).log('Epay notify: already credited, skipping')
      return 'success'
    }

    const paidFen = epayMoneyToFen(rawParams.money)
    if (paidFen == null || paidFen !== order.amountFen) {
      logger.withFields({
        out_trade_no,
        paidMoney: rawParams.money,
        expectedMoney: formatCny(order.amountFen),
      }).warn('Epay notify: amount mismatch')
      throw new Error('AMOUNT_MISMATCH')
    }

    if (isSubscriptionOrder(order))
      return await settleSubscriptionOrder(order, rawParams)

    return await settleLegacyFluxOrder(order, rawParams)
  }

  async function settleSubscriptionOrder(
    order: epaySchema.EpayOrder,
    rawParams: Record<string, string>,
  ): Promise<'success'> {
    const { out_trade_no, trade_no } = rawParams
    const planId = order.planId
    if (!planId) {
      logger.withField('out_trade_no', out_trade_no).warn('Epay subscription order missing planId')
      throw new Error('PLAN_NOT_FOUND')
    }

    const periodDays = normalizeOrderPeriodDays(order.periodDays, order.outTradeNo)
    const planName = order.planName ?? order.subject ?? planId

    const claimedOrder = await markOrderCrediting(order.outTradeNo, trade_no, rawParams)
    if (!claimedOrder)
      return await handleUnclaimedReplay(order.outTradeNo)

    let paidPeriod: Awaited<ReturnType<SubscriptionService['applyPaidPeriod']>>
    try {
      paidPeriod = await subscriptionService.applyPaidPeriod({
        userId: claimedOrder.userId,
        planId,
        outTradeNo: claimedOrder.outTradeNo,
        periodDays,
        amountFen: claimedOrder.amountFen,
        fluxAmount: claimedOrder.fluxAmount,
        planName,
      })

      await billingService.creditFlux({
        userId: claimedOrder.userId,
        amount: paidPeriod.fluxAmount,
        requestId: `epay:${claimedOrder.outTradeNo}`,
        description: `Epay subscription ${planName} (${formatDate(paidPeriod.periodStart)} - ${formatDate(paidPeriod.periodEnd)})`,
        source: 'epay.subscription',
        auditMetadata: {
          outTradeNo: claimedOrder.outTradeNo,
          tradeNo: trade_no,
          planId,
          amountFen: claimedOrder.amountFen,
          periodDays,
          periodId: paidPeriod.period.id,
          periodStart: paidPeriod.periodStart.toISOString(),
          periodEnd: paidPeriod.periodEnd.toISOString(),
        },
      })
    }
    catch (err) {
      await markOrderCreditFailed(claimedOrder.outTradeNo)
      throw err
    }

    await db
      .update(epaySchema.epayOrders)
      .set({
        status: 'paid',
        fluxCredited: 1,
        fluxAmount: paidPeriod.fluxAmount,
        periodStart: paidPeriod.periodStart,
        periodEnd: paidPeriod.periodEnd,
        periodDays,
        planName,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(epaySchema.epayOrders.outTradeNo, claimedOrder.outTradeNo))

    logger.withFields({
      out_trade_no: claimedOrder.outTradeNo,
      userId: claimedOrder.userId,
      planId,
      fluxAmount: paidPeriod.fluxAmount,
      periodStart: paidPeriod.periodStart.toISOString(),
      periodEnd: paidPeriod.periodEnd.toISOString(),
    }).log('Epay subscription order settled')
    return 'success'
  }

  async function settleLegacyFluxOrder(
    order: epaySchema.EpayOrder,
    rawParams: Record<string, string>,
  ): Promise<'success'> {
    const { trade_no } = rawParams
    const claimedOrder = await markOrderCrediting(order.outTradeNo, trade_no, rawParams)
    if (!claimedOrder)
      return await handleUnclaimedReplay(order.outTradeNo)

    try {
      await billingService.creditFlux({
        userId: claimedOrder.userId,
        amount: claimedOrder.fluxAmount,
        requestId: `epay:${claimedOrder.outTradeNo}`,
        description: `Epay purchase CNY ${formatCny(claimedOrder.amountFen)}`,
        source: 'epay.purchase',
        auditMetadata: { outTradeNo: claimedOrder.outTradeNo, tradeNo: trade_no },
      })
    }
    catch (err) {
      await markOrderCreditFailed(claimedOrder.outTradeNo)
      throw err
    }

    await db
      .update(epaySchema.epayOrders)
      .set({
        status: 'paid',
        fluxCredited: 1,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(epaySchema.epayOrders.outTradeNo, claimedOrder.outTradeNo))

    logger.withFields({ out_trade_no: claimedOrder.outTradeNo, userId: claimedOrder.userId, fluxAmount: claimedOrder.fluxAmount }).log('Epay legacy Flux order credited')
    return 'success'
  }

  async function markOrderCrediting(
    outTradeNo: string,
    tradeNo: string | undefined,
    rawParams: Record<string, string>,
  ): Promise<epaySchema.EpayOrder | null> {
    const [claimed] = await db
      .update(epaySchema.epayOrders)
      .set({
        status: 'crediting',
        tradeNo: tradeNo ?? null,
        fluxCredited: 0,
        notifyPayload: JSON.stringify(rawParams),
        updatedAt: new Date(),
      })
      .where(and(
        eq(epaySchema.epayOrders.outTradeNo, outTradeNo),
        // The downstream subscription-period and Flux ledgers both use the
        // order number as an idempotency key, so retrying a stuck `crediting`
        // row cannot extend or credit twice.
        eq(epaySchema.epayOrders.fluxCredited, 0),
      ))
      .returning()

    return claimed ?? null
  }

  async function handleUnclaimedReplay(outTradeNo: string): Promise<'success'> {
    const latest = await getOrder(outTradeNo)
    if (latest?.fluxCredited === 1)
      return 'success'

    logger.withField('out_trade_no', outTradeNo).warn('Epay notify: order could not be claimed for settlement')
    throw new Error('ORDER_CLAIM_FAILED')
  }

  async function markOrderCreditFailed(outTradeNo: string): Promise<void> {
    await db
      .update(epaySchema.epayOrders)
      .set({
        status: 'credit_failed',
        fluxCredited: 0,
        updatedAt: new Date(),
      })
      .where(eq(epaySchema.epayOrders.outTradeNo, outTradeNo))
  }

  async function getOrder(outTradeNo: string): Promise<epaySchema.EpayOrder | null> {
    const [order] = await db
      .select()
      .from(epaySchema.epayOrders)
      .where(eq(epaySchema.epayOrders.outTradeNo, outTradeNo))
      .limit(1)

    return order ?? null
  }

  return { listPlans, createOrder, handleNotify, getOrder }
}

export type EpayService = ReturnType<typeof createEpayService>

function assertEpayCheckoutConfigured(config: EpayConfig, input: Pick<CreateOrderInput, 'notifyUrl' | 'returnUrl'>): void {
  const missing = new Set<string>()

  if (!isHttpUrl(config.apiUrl))
    missing.add('EPAY_API_URL')
  if (!hasText(config.pid))
    missing.add('EPAY_PID')
  if (!hasText(config.key))
    missing.add('EPAY_KEY')

  // Epay calls notify_url from its own servers. Localhost or private-network
  // callbacks can create paid real orders that the server can never settle.
  if (!isPublicEpayCallbackUrl(input.notifyUrl) || !isPublicEpayCallbackUrl(input.returnUrl))
    missing.add(EPAY_CALLBACK_BASE_REQUIREMENT)

  if (missing.size > 0)
    throw new EpayConfigurationError([...missing])
}

function isHttpUrl(value: string): boolean {
  if (!hasText(value))
    return false

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  }
  catch {
    return false
  }
}

export function isPublicEpayCallbackUrl(value: string): boolean {
  if (!isHttpUrl(value))
    return false

  const url = new URL(value)
  return isPublicCallbackHostname(url.hostname)
}

function isPublicCallbackHostname(rawHostname: string): boolean {
  const hostname = rawHostname.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
  if (
    !hostname
    || hostname === 'localhost'
    || hostname === 'host.docker.internal'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.internal')
    || hostname.endsWith('.lan')
  ) {
    return false
  }

  const ipVersion = isIP(hostname)
  if (ipVersion === 4)
    return isPublicIpv4(hostname)
  if (ipVersion === 6)
    return isPublicIpv6(hostname)

  return true
}

function isPublicIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(part => Number(part))
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255))
    return false

  const [a, b] = parts

  return !(
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51)
    || (a === 203 && b === 0)
    || a >= 224
  )
}

function isPublicIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()

  if (normalized === '::' || normalized === '::1')
    return false

  const dottedIpv4Mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (dottedIpv4Mapped?.[1])
    return isPublicIpv4(dottedIpv4Mapped[1])

  const hexIpv4Mapped = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
  if (hexIpv4Mapped?.[1] && hexIpv4Mapped[2]) {
    const high = Number.parseInt(hexIpv4Mapped[1], 16)
    const low = Number.parseInt(hexIpv4Mapped[2], 16)
    const mappedIpv4 = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
    return isPublicIpv4(mappedIpv4)
  }

  const firstSegment = Number.parseInt(normalized.split(':')[0] || '0', 16)
  if (!Number.isFinite(firstSegment))
    return false

  return !(
    (firstSegment & 0xfe00) === 0xfc00
    || (firstSegment & 0xffc0) === 0xfe80
    || firstSegment === 0xff00
    || normalized.startsWith('2001:db8:')
  )
}

function hasText(value: string): boolean {
  return value.trim().length > 0
}

function isSubscriptionOrder(order: epaySchema.EpayOrder): boolean {
  return order.orderKind === 'subscription' || order.planId != null
}

function normalizeOrderPeriodDays(value: number | null | undefined, outTradeNo: string): number {
  if (value == null) {
    logger.withField('out_trade_no', outTradeNo).warn('Epay subscription order missing periodDays snapshot')
    throw new Error('ORDER_SNAPSHOT_INVALID')
  }
  return normalizePositiveInteger(value, 'periodDays')
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`INVALID_${fieldName.toUpperCase()}`)
  return value
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized ? normalized : null
}

function formatCny(amountFen: number): string {
  return (amountFen / 100).toFixed(2)
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function epayMoneyToFen(money: string | undefined): number | null {
  if (money == null || money.trim() === '')
    return null
  const value = Number(money)
  if (!Number.isFinite(value))
    return null
  return Math.round(value * 100)
}

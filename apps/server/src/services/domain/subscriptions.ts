import type { Database } from '../../libs/db'
import type { NewSubscriptionPlan, SubscriptionPeriod, SubscriptionPlan, UserSubscription } from '../../schemas/subscriptions'

import { asc, eq } from 'drizzle-orm'

import { user } from '../../schemas/accounts'
import { subscriptionPeriods, subscriptionPlans, userSubscriptions } from '../../schemas/subscriptions'
import { createBadRequestError, createNotFoundError } from '../../utils/error'

const PLAN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/

const DEFAULT_SUBSCRIPTION_PLANS: CreateSubscriptionPlanInput[] = [
  {
    id: 'monthly_basic',
    name: '基础月度订阅',
    description: '示例套餐：30 天内可用 100 Flux，客户可在后台修改。',
    enabled: true,
    displayOrder: 10,
    periodDays: 30,
    amountFen: 600,
    fluxAmount: 100,
  },
  {
    id: 'monthly_pro',
    name: '专业月度订阅',
    description: '示例套餐：30 天内可用 600 Flux，客户可在后台修改。',
    enabled: true,
    displayOrder: 20,
    periodDays: 30,
    amountFen: 3000,
    fluxAmount: 600,
  },
]

/** Calculated renewal window for a subscription plan without mutating state. */
export interface RenewalPreview {
  /** Plan that will be renewed. */
  plan: SubscriptionPlan
  /** Inclusive start of the paid period. */
  periodStart: Date
  /** Exclusive end of the paid period. */
  periodEnd: Date
  /** Flux amount the payment worker should credit after the period is applied. */
  fluxAmount: number
}

/** Input for applying one successful payment as a subscription period. */
export interface ApplyPaidPeriodInput {
  /** Account that owns the paid period. */
  userId: string
  /** Subscription plan purchased by the paid order. */
  planId: string
  /** Epay out_trade_no; used as the idempotency key. */
  outTradeNo: string
  /**
   * Frozen subscription duration from the paid order.
   * When provided, settlement does not require the current plan to be enabled.
   */
  periodDays?: number
  /** Frozen Flux grant from the paid order. */
  fluxAmount?: number
  /** Frozen payment amount in RMB fen, validated for audit consistency. */
  amountFen?: number
  /** Frozen customer-facing plan name from checkout. */
  planName?: string | null
  /** Optional clock override for tests and deterministic payment replay. */
  now?: Date
}

/** Result of applying or replaying a paid subscription period. */
export interface AppliedPaidPeriod {
  /** Current plan row when it still exists; null for deleted-plan settlement from an order snapshot. */
  plan: SubscriptionPlan | null
  /** Frozen or current plan name safe for audit descriptions. */
  planName: string | null
  /** Inclusive start of the paid period. */
  periodStart: Date
  /** Exclusive end of the paid period. */
  periodEnd: Date
  /** Flux amount the payment worker should credit after the period is applied. */
  fluxAmount: number
  /** Audit row for the paid period. */
  period: SubscriptionPeriod
  /** Current subscription row after apply; null only if a replayed audit outlived the account row. */
  subscription: UserSubscription | null
  /** True when outTradeNo was already recorded and no extension was added. */
  idempotent: boolean
}

/** Editable subscription plan fields accepted by the admin plan creator. */
export interface CreateSubscriptionPlanInput {
  /** Stable public plan id. Must be a lowercase slug (`monthly_basic`, `monthly-pro`). */
  id: string
  /** Human-readable plan name shown in the subscription center and Epay checkout. */
  name: string
  /** Optional customer-facing description; null clears the text. */
  description?: string | null
  /** Whether product users can buy this plan. @default true */
  enabled?: boolean
  /** Admin-controlled ordering for customer-facing plan lists. @default 0 */
  displayOrder?: number
  /** Subscription duration in whole days. Must be positive. */
  periodDays: number
  /** Price in RMB fen. Must be non-negative. */
  amountFen: number
  /** Fixed Flux credited for one paid period. Must be non-negative. */
  fluxAmount: number
}

/** Editable subscription plan fields accepted by the admin patch endpoint. */
export interface UpdateSubscriptionPlanInput {
  /** Human-readable plan name shown in the subscription center and Epay checkout. */
  name?: string
  /** Optional customer-facing description; null clears the text. */
  description?: string | null
  /** Whether product users can buy this plan. */
  enabled?: boolean
  /** Admin-controlled ordering for customer-facing plan lists. */
  displayOrder?: number
  /** Subscription duration in whole days. Must be positive. */
  periodDays?: number
  /** Price in RMB fen. Must be non-negative. */
  amountFen?: number
  /** Fixed Flux credited for one paid period. Must be non-negative. */
  fluxAmount?: number
}

/** Result of explicitly seeding the customer-editable example subscription plans. */
export interface EnsureDefaultPlansResult {
  /** Current rows for the default example plan ids after the seed attempt. */
  plans: SubscriptionPlan[]
  /** Plan ids inserted by this call. Existing plans are never overwritten. */
  createdPlanIds: string[]
}

interface PaidPeriodTerms {
  plan: SubscriptionPlan | null
  planName: string | null
  periodDays: number
  fluxAmount: number
}

interface PaidPeriodSnapshot {
  planName: string | null
  periodDays: number
  fluxAmount: number
}

/** Public subscription operations consumed by checkout and account routes. */
export interface SubscriptionService {
  listEnabledPlans: () => Promise<SubscriptionPlan[]>
  getPlan: (id: string) => Promise<SubscriptionPlan>
  getCurrentSubscription: (userId: string, now?: Date) => Promise<UserSubscription | null>
  getPeriodByOrder: (outTradeNo: string) => Promise<SubscriptionPeriod | null>
  markCancelAtPeriodEnd: (userId: string, now?: Date) => Promise<UserSubscription>
  resumeRenewal: (userId: string, now?: Date) => Promise<UserSubscription>
  previewRenewal: (userId: string, planId: string, now?: Date) => Promise<RenewalPreview>
  applyPaidPeriod: (input: ApplyPaidPeriodInput) => Promise<AppliedPaidPeriod>
}

/** Admin-only subscription plan curation operations. */
export interface AdminSubscriptionPlanService {
  listPlansForAdmin: () => Promise<SubscriptionPlan[]>
  createPlan: (input: CreateSubscriptionPlanInput) => Promise<SubscriptionPlan>
  updatePlan: (id: string, input: UpdateSubscriptionPlanInput) => Promise<SubscriptionPlan>
  disablePlan: (id: string) => Promise<SubscriptionPlan>
  ensureDefaultPlans: () => Promise<EnsureDefaultPlansResult>
}

/**
 * Creates the subscription domain service.
 *
 * NOTICE:
 * Epay integration note: this models manual paid periods created by Epay
 * orders/notify callbacks. Epay does not create an automatic card-style
 * recurring debit here; each successful order appends one subscription period.
 * Flux crediting is intentionally outside this service so payment workers can
 * call `billingService.creditFlux` with their own idempotency/audit metadata.
 */
export function createSubscriptionService(db: Database): SubscriptionService & AdminSubscriptionPlanService {
  async function listEnabledPlans(): Promise<SubscriptionPlan[]> {
    return await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.enabled, true),
      orderBy: [asc(subscriptionPlans.displayOrder), asc(subscriptionPlans.id)],
    })
  }

  async function listPlansForAdmin(): Promise<SubscriptionPlan[]> {
    return await db.query.subscriptionPlans.findMany({
      orderBy: [asc(subscriptionPlans.displayOrder), asc(subscriptionPlans.id)],
    })
  }

  async function getPlan(id: string): Promise<SubscriptionPlan> {
    const planId = normalizePlanId(id)
    const plan = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, planId),
    })
    if (!plan)
      throw createNotFoundError('Subscription plan not found', { planId })
    return plan
  }

  async function createPlan(input: CreateSubscriptionPlanInput): Promise<SubscriptionPlan> {
    const plan = normalizeCreatePlanInput(input)

    const existing = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.id, plan.id),
    })
    if (existing) {
      throw createBadRequestError('Subscription plan already exists', 'SUBSCRIPTION_PLAN_EXISTS', {
        planId: plan.id,
      })
    }

    const [created] = await db.insert(subscriptionPlans).values(plan).returning()
    if (!created) {
      throw createBadRequestError('Subscription plan could not be created', 'SUBSCRIPTION_PLAN_CREATE_FAILED', {
        planId: plan.id,
      })
    }
    return created
  }

  async function updatePlan(id: string, input: UpdateSubscriptionPlanInput): Promise<SubscriptionPlan> {
    const planId = normalizePlanId(id)
    const patch = normalizeUpdatePlanInput(input)
    if (Object.keys(patch).length === 0) {
      throw createBadRequestError('No subscription plan fields were provided', 'INVALID_SUBSCRIPTION_PLAN', {
        planId,
      })
    }

    const [updated] = await db
      .update(subscriptionPlans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(subscriptionPlans.id, planId))
      .returning()

    if (!updated)
      throw createNotFoundError('Subscription plan not found', { planId })
    return updated
  }

  async function disablePlan(id: string): Promise<SubscriptionPlan> {
    return await updatePlan(id, { enabled: false })
  }

  async function ensureDefaultPlans(): Promise<EnsureDefaultPlansResult> {
    const createdPlanIds: string[] = []

    for (const defaultPlan of DEFAULT_SUBSCRIPTION_PLANS) {
      const normalizedPlan = normalizeCreatePlanInput(defaultPlan)
      const [created] = await db
        .insert(subscriptionPlans)
        .values(normalizedPlan)
        .onConflictDoNothing({ target: subscriptionPlans.id })
        .returning({ id: subscriptionPlans.id })

      if (created)
        createdPlanIds.push(created.id)
    }

    return {
      plans: await listDefaultPlans(),
      createdPlanIds,
    }
  }

  async function getCurrentSubscription(userId: string, now = new Date()): Promise<UserSubscription | null> {
    const normalizedUserId = requireNonEmpty(userId, 'userId')
    const subscription = await db.query.userSubscriptions.findFirst({
      where: eq(userSubscriptions.userId, normalizedUserId),
    })

    if (!subscription)
      return null

    return deriveVisibleSubscriptionStatus(subscription, now)
  }

  async function getPeriodByOrder(outTradeNo: string): Promise<SubscriptionPeriod | null> {
    const normalizedOutTradeNo = requireNonEmpty(outTradeNo, 'outTradeNo')
    const period = await db.query.subscriptionPeriods.findFirst({
      where: eq(subscriptionPeriods.outTradeNo, normalizedOutTradeNo),
    })

    return period ?? null
  }

  async function requireRenewableSubscription(userId: string, now: Date): Promise<UserSubscription> {
    const normalizedUserId = requireNonEmpty(userId, 'userId')
    const subscription = await getCurrentSubscription(normalizedUserId, now)
    if (!subscription)
      throw createNotFoundError('Subscription not found', { userId: normalizedUserId })

    if (subscription.status !== 'active' || subscription.currentPeriodEnd <= now) {
      throw createBadRequestError('Subscription is not renewable', 'SUBSCRIPTION_NOT_RENEWABLE', {
        userId: normalizedUserId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      })
    }

    return subscription
  }

  async function markCancelAtPeriodEnd(userId: string, now = new Date()): Promise<UserSubscription> {
    const subscription = await requireRenewableSubscription(userId, now)
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        cancelAtPeriodEnd: true,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.userId, subscription.userId))
      .returning()

    if (!updated)
      throw createNotFoundError('Subscription not found', { userId: subscription.userId })
    return deriveVisibleSubscriptionStatus(updated, now)
  }

  async function resumeRenewal(userId: string, now = new Date()): Promise<UserSubscription> {
    const subscription = await requireRenewableSubscription(userId, now)
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        cancelAtPeriodEnd: false,
        updatedAt: now,
      })
      .where(eq(userSubscriptions.userId, subscription.userId))
      .returning()

    if (!updated)
      throw createNotFoundError('Subscription not found', { userId: subscription.userId })
    return deriveVisibleSubscriptionStatus(updated, now)
  }

  async function previewRenewal(userId: string, planId: string, now = new Date()): Promise<RenewalPreview> {
    const normalizedUserId = requireNonEmpty(userId, 'userId')
    const plan = await getPlan(planId)
    assertPlanCanRenew(plan)

    const current = await getCurrentSubscription(normalizedUserId, now)
    return createRenewalPreview(plan, current, now)
  }

  async function applyPaidPeriod(input: ApplyPaidPeriodInput): Promise<AppliedPaidPeriod> {
    const normalizedUserId = requireNonEmpty(input.userId, 'userId')
    const planId = normalizePlanId(input.planId)
    const outTradeNo = requireNonEmpty(input.outTradeNo, 'outTradeNo')
    const now = input.now ?? new Date()
    const snapshot = normalizePaidPeriodSnapshot(input)

    return await db.transaction(async (tx) => {
      const existingPeriod = await tx.query.subscriptionPeriods.findFirst({
        where: eq(subscriptionPeriods.outTradeNo, outTradeNo),
      })

      if (existingPeriod) {
        if (existingPeriod.userId !== normalizedUserId || existingPeriod.planId !== planId) {
          throw createBadRequestError('Subscription period order already belongs to another renewal', 'SUBSCRIPTION_ORDER_CONFLICT', {
            outTradeNo,
            userId: existingPeriod.userId,
            planId: existingPeriod.planId,
          })
        }

        const existingPlan = await tx.query.subscriptionPlans.findFirst({
          where: eq(subscriptionPlans.id, existingPeriod.planId),
        })

        const subscription = await tx.query.userSubscriptions.findFirst({
          where: eq(userSubscriptions.userId, existingPeriod.userId),
        })

        return {
          plan: existingPlan ?? null,
          planName: existingPlan?.name ?? null,
          periodStart: existingPeriod.periodStart,
          periodEnd: existingPeriod.periodEnd,
          fluxAmount: existingPeriod.fluxAmount,
          period: existingPeriod,
          subscription: subscription ? deriveVisibleSubscriptionStatus(subscription, now) : null,
          idempotent: true,
        }
      }

      const plan = await tx.query.subscriptionPlans.findFirst({
        where: eq(subscriptionPlans.id, planId),
      })
      if (!plan && !snapshot)
        throw createNotFoundError('Subscription plan not found', { planId })
      if (plan && !snapshot)
        assertPlanCanRenew(plan)

      const [lockedUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, normalizedUserId))
        .limit(1)
        .for('update')

      if (!lockedUser)
        throw createNotFoundError('User not found', { userId: normalizedUserId })

      const current = await tx.query.userSubscriptions.findFirst({
        where: eq(userSubscriptions.userId, normalizedUserId),
      })
      const preview = createPaidPeriodPreview({
        plan: plan ?? null,
        planName: snapshot?.planName ?? plan?.name ?? null,
        periodDays: snapshot?.periodDays ?? plan!.periodDays,
        fluxAmount: snapshot?.fluxAmount ?? plan!.fluxAmount,
      }, current ? deriveVisibleSubscriptionStatus(current, now) : null, now)

      const [period] = await tx.insert(subscriptionPeriods).values({
        userId: normalizedUserId,
        planId,
        outTradeNo,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        fluxAmount: preview.fluxAmount,
      }).onConflictDoNothing({
        target: subscriptionPeriods.outTradeNo,
      }).returning()

      if (!period) {
        const racedPeriod = await tx.query.subscriptionPeriods.findFirst({
          where: eq(subscriptionPeriods.outTradeNo, outTradeNo),
        })
        if (!racedPeriod)
          throw createBadRequestError('Subscription period order could not be applied', 'SUBSCRIPTION_ORDER_RACE', { outTradeNo })

        if (racedPeriod.userId !== normalizedUserId || racedPeriod.planId !== planId) {
          throw createBadRequestError('Subscription period order already belongs to another renewal', 'SUBSCRIPTION_ORDER_CONFLICT', {
            outTradeNo,
            userId: racedPeriod.userId,
            planId: racedPeriod.planId,
          })
        }

        const subscription = await tx.query.userSubscriptions.findFirst({
          where: eq(userSubscriptions.userId, racedPeriod.userId),
        })

        return {
          plan: plan ?? null,
          planName: plan?.name ?? snapshot?.planName ?? null,
          periodStart: racedPeriod.periodStart,
          periodEnd: racedPeriod.periodEnd,
          fluxAmount: racedPeriod.fluxAmount,
          period: racedPeriod,
          subscription: subscription ? deriveVisibleSubscriptionStatus(subscription, now) : null,
          idempotent: true,
        }
      }

      const [subscription] = await tx.insert(userSubscriptions).values({
        userId: normalizedUserId,
        planId,
        status: 'active',
        currentPeriodStart: preview.periodStart,
        currentPeriodEnd: preview.periodEnd,
        cancelAtPeriodEnd: false,
        lastPaymentOrderId: outTradeNo,
        updatedAt: now,
      }).onConflictDoUpdate({
        target: userSubscriptions.userId,
        set: {
          planId,
          status: 'active',
          currentPeriodStart: preview.periodStart,
          currentPeriodEnd: preview.periodEnd,
          cancelAtPeriodEnd: false,
          lastPaymentOrderId: outTradeNo,
          updatedAt: now,
        },
      }).returning()

      return {
        ...preview,
        period,
        subscription: subscription ?? null,
        idempotent: false,
      }
    })
  }

  async function listDefaultPlans(): Promise<SubscriptionPlan[]> {
    const plans: SubscriptionPlan[] = []
    for (const defaultPlan of DEFAULT_SUBSCRIPTION_PLANS)
      plans.push(await getPlan(defaultPlan.id))
    return plans
  }

  return {
    listEnabledPlans,
    listPlansForAdmin,
    getPlan,
    createPlan,
    updatePlan,
    disablePlan,
    ensureDefaultPlans,
    getCurrentSubscription,
    getPeriodByOrder,
    markCancelAtPeriodEnd,
    resumeRenewal,
    previewRenewal,
    applyPaidPeriod,
  }
}

function normalizePlanId(value: string): string {
  const planId = requireNonEmpty(value, 'planId')
  if (!PLAN_ID_PATTERN.test(planId)) {
    throw createBadRequestError('Subscription plan id must be a safe lowercase slug', 'INVALID_SUBSCRIPTION_PLAN', {
      planId,
    })
  }
  return planId
}

function normalizeCreatePlanInput(input: CreateSubscriptionPlanInput): NewSubscriptionPlan {
  const enabled = input.enabled ?? true
  assertBoolean(enabled, 'enabled')

  return {
    id: normalizePlanId(input.id),
    name: normalizePlanName(input.name),
    description: normalizeOptionalDescription(input.description),
    enabled,
    displayOrder: normalizeNonNegativeInteger(input.displayOrder ?? 0, 'displayOrder'),
    periodDays: normalizePositiveInteger(input.periodDays, 'periodDays'),
    amountFen: normalizeNonNegativeInteger(input.amountFen, 'amountFen'),
    fluxAmount: normalizeNonNegativeInteger(input.fluxAmount, 'fluxAmount'),
    updatedAt: new Date(),
  }
}

function normalizeUpdatePlanInput(input: UpdateSubscriptionPlanInput): Partial<NewSubscriptionPlan> {
  const patch: Partial<NewSubscriptionPlan> = {}

  if (input.name !== undefined)
    patch.name = normalizePlanName(input.name)
  if (input.description !== undefined)
    patch.description = normalizeOptionalDescription(input.description)
  if (input.enabled !== undefined) {
    assertBoolean(input.enabled, 'enabled')
    patch.enabled = input.enabled
  }
  if (input.displayOrder !== undefined)
    patch.displayOrder = normalizeNonNegativeInteger(input.displayOrder, 'displayOrder')
  if (input.periodDays !== undefined)
    patch.periodDays = normalizePositiveInteger(input.periodDays, 'periodDays')
  if (input.amountFen !== undefined)
    patch.amountFen = normalizeNonNegativeInteger(input.amountFen, 'amountFen')
  if (input.fluxAmount !== undefined)
    patch.fluxAmount = normalizeNonNegativeInteger(input.fluxAmount, 'fluxAmount')

  return patch
}

function normalizePlanName(value: string): string {
  return requireNonEmpty(value, 'name')
}

function normalizeOptionalDescription(value: string | null | undefined): string | null {
  if (value == null)
    return null

  const normalized = value.trim()
  return normalized === '' ? null : normalized
}

function requireNonEmpty(value: string, fieldName: string): string {
  const normalized = value.trim()
  if (normalized === '')
    throw createBadRequestError(`${fieldName} is required`, 'INVALID_SUBSCRIPTION_INPUT', { fieldName })
  return normalized
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw createBadRequestError(`${fieldName} must be a positive integer`, 'INVALID_SUBSCRIPTION_PLAN', {
      fieldName,
      value,
    })
  }
  return value
}

function normalizeNonNegativeInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw createBadRequestError(`${fieldName} must be a non-negative integer`, 'INVALID_SUBSCRIPTION_PLAN', {
      fieldName,
      value,
    })
  }
  return value
}

function assertBoolean(value: boolean, fieldName: string): void {
  if (typeof value !== 'boolean') {
    throw createBadRequestError(`${fieldName} must be a boolean`, 'INVALID_SUBSCRIPTION_PLAN', {
      fieldName,
    })
  }
}

function assertPlanCanRenew(plan: SubscriptionPlan): void {
  if (!plan.enabled) {
    throw createBadRequestError('Subscription plan is disabled', 'SUBSCRIPTION_PLAN_DISABLED', {
      planId: plan.id,
    })
  }
  if (plan.periodDays <= 0) {
    throw createBadRequestError('Subscription plan periodDays must be positive', 'INVALID_SUBSCRIPTION_PLAN', {
      planId: plan.id,
      periodDays: plan.periodDays,
    })
  }
  if (plan.amountFen < 0) {
    throw createBadRequestError('Subscription plan amountFen must be non-negative', 'INVALID_SUBSCRIPTION_PLAN', {
      planId: plan.id,
      amountFen: plan.amountFen,
    })
  }
  if (plan.fluxAmount < 0) {
    throw createBadRequestError('Subscription plan fluxAmount must be non-negative', 'INVALID_SUBSCRIPTION_PLAN', {
      planId: plan.id,
      fluxAmount: plan.fluxAmount,
    })
  }
}

function normalizePaidPeriodSnapshot(input: ApplyPaidPeriodInput): PaidPeriodSnapshot | null {
  const hasSnapshot = input.periodDays !== undefined || input.fluxAmount !== undefined || input.amountFen !== undefined || input.planName !== undefined
  if (!hasSnapshot)
    return null

  if (input.periodDays === undefined || input.fluxAmount === undefined) {
    throw createBadRequestError('Paid subscription order snapshot is incomplete', 'INVALID_SUBSCRIPTION_ORDER_SNAPSHOT', {
      hasPeriodDays: input.periodDays !== undefined,
      hasFluxAmount: input.fluxAmount !== undefined,
    })
  }

  if (input.amountFen !== undefined)
    normalizeNonNegativeInteger(input.amountFen, 'amountFen')

  return {
    planName: normalizeOptionalDescription(input.planName),
    periodDays: normalizePositiveInteger(input.periodDays, 'periodDays'),
    fluxAmount: normalizeNonNegativeInteger(input.fluxAmount, 'fluxAmount'),
  }
}

function createRenewalPreview(plan: SubscriptionPlan, current: UserSubscription | null, now: Date): RenewalPreview {
  const periodStart = current?.status === 'active' && current.currentPeriodEnd > now
    ? current.currentPeriodEnd
    : now

  return {
    plan,
    periodStart,
    periodEnd: addDays(periodStart, plan.periodDays),
    fluxAmount: plan.fluxAmount,
  }
}

function createPaidPeriodPreview(terms: PaidPeriodTerms, current: UserSubscription | null, now: Date): Omit<AppliedPaidPeriod, 'period' | 'subscription' | 'idempotent'> {
  const periodStart = current?.status === 'active' && current.currentPeriodEnd > now
    ? current.currentPeriodEnd
    : now

  return {
    plan: terms.plan,
    planName: terms.planName,
    periodStart,
    periodEnd: addDays(periodStart, terms.periodDays),
    fluxAmount: terms.fluxAmount,
  }
}

function deriveVisibleSubscriptionStatus(subscription: UserSubscription, now: Date): UserSubscription {
  if (subscription.status === 'active' && subscription.currentPeriodEnd <= now)
    return { ...subscription, status: 'expired' }
  return subscription
}

function addDays(start: Date, days: number): Date {
  // Billing periods are whole-day durations; use UTC milliseconds so renewals
  // stay independent from the server's local timezone and DST transitions.
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
}

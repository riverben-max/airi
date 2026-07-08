import type { Database } from '../../libs/db'

import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { mockDB } from '../../libs/mock-db'
import { createSubscriptionService } from './subscriptions'

import * as schema from '../../schemas'

const testUser = {
  id: 'user-subscription-1',
  name: 'Subscription User',
  email: 'subscription@example.com',
}

const plan = {
  id: 'monthly_basic',
  name: '基础月度订阅',
  description: '每月 100 Flux',
  enabled: true,
  displayOrder: 10,
  periodDays: 30,
  amountFen: 600,
  fluxAmount: 100,
}

async function seedUserAndPlan(db: Database) {
  await db.insert(schema.user).values(testUser)
  await db.insert(schema.subscriptionPlans).values(plan)
}

describe('subscriptionService.applyPaidPeriod', () => {
  let db: Database

  beforeAll(async () => {
    db = await mockDB(schema)
  }, 30000)

  beforeEach(async () => {
    await db.delete(schema.subscriptionPeriods)
    await db.delete(schema.userSubscriptions)
    await db.delete(schema.subscriptionPlans)
    await db.delete(schema.user)
    await seedUserAndPlan(db)
  })

  it('creates the first active subscription period with payment metadata', async () => {
    const service = createSubscriptionService(db)
    const now = new Date('2026-07-01T00:00:00.000Z')

    const result = await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-first',
      now,
    })

    expect(result.idempotent).toBe(false)
    expect(result.periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(result.periodEnd.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(result.fluxAmount).toBe(100)
    expect(result.subscription).toMatchObject({
      userId: testUser.id,
      planId: plan.id,
      status: 'active',
      cancelAtPeriodEnd: false,
      lastPaymentOrderId: 'epay-order-first',
    })
    expect(result.subscription?.currentPeriodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(result.subscription?.currentPeriodEnd.toISOString()).toBe('2026-07-31T00:00:00.000Z')

    const [persisted] = await db
      .select()
      .from(schema.userSubscriptions)
      .where(eq(schema.userSubscriptions.userId, testUser.id))

    expect(persisted).toMatchObject({
      status: 'active',
      cancelAtPeriodEnd: false,
      lastPaymentOrderId: 'epay-order-first',
    })
    expect(persisted?.currentPeriodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(persisted?.currentPeriodEnd.toISOString()).toBe('2026-07-31T00:00:00.000Z')
  })

  it('treats repeated outTradeNo as idempotent without extending the period twice', async () => {
    const service = createSubscriptionService(db)
    const firstNow = new Date('2026-07-01T00:00:00.000Z')

    await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-idempotent',
      now: firstNow,
    })
    const replay = await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-idempotent',
      now: new Date('2026-07-15T00:00:00.000Z'),
    })

    expect(replay.idempotent).toBe(true)
    expect(replay.periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(replay.periodEnd.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(replay.subscription?.currentPeriodEnd.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(replay.subscription?.lastPaymentOrderId).toBe('epay-order-idempotent')

    const periods = await db
      .select()
      .from(schema.subscriptionPeriods)
      .where(eq(schema.subscriptionPeriods.outTradeNo, 'epay-order-idempotent'))

    expect(periods).toHaveLength(1)
  })

  it('renews from currentPeriodEnd when the current subscription is still active', async () => {
    const service = createSubscriptionService(db)

    const first = await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-renew-1',
      now: new Date('2026-07-01T00:00:00.000Z'),
    })
    const renewal = await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-renew-2',
      now: new Date('2026-07-10T00:00:00.000Z'),
    })

    expect(renewal.idempotent).toBe(false)
    expect(renewal.periodStart.toISOString()).toBe(first.periodEnd.toISOString())
    expect(renewal.periodStart.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(renewal.periodEnd.toISOString()).toBe('2026-08-30T00:00:00.000Z')
    expect(renewal.subscription).toMatchObject({
      userId: testUser.id,
      planId: plan.id,
      status: 'active',
      cancelAtPeriodEnd: false,
      lastPaymentOrderId: 'epay-order-renew-2',
    })
    expect(renewal.subscription?.currentPeriodStart.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(renewal.subscription?.currentPeriodEnd.toISOString()).toBe('2026-08-30T00:00:00.000Z')
  })

  it('applies a paid period from the order snapshot after the plan is disabled and modified', async () => {
    const service = createSubscriptionService(db)

    await db
      .update(schema.subscriptionPlans)
      .set({
        enabled: false,
        periodDays: 7,
        amountFen: 1,
        fluxAmount: 1,
      })
      .where(eq(schema.subscriptionPlans.id, plan.id))

    const paidPeriod = await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-snapshot',
      periodDays: 30,
      fluxAmount: 100,
      amountFen: 600,
      now: new Date('2026-07-01T00:00:00.000Z'),
    })

    expect(paidPeriod.idempotent).toBe(false)
    expect(paidPeriod.periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z')
    expect(paidPeriod.periodEnd.toISOString()).toBe('2026-07-31T00:00:00.000Z')
    expect(paidPeriod.fluxAmount).toBe(100)
    expect(paidPeriod.subscription).toMatchObject({
      userId: testUser.id,
      planId: plan.id,
      status: 'active',
      lastPaymentOrderId: 'epay-order-snapshot',
    })
  })

  it('marks an active subscription to cancel at the period end and resumes renewal', async () => {
    const service = createSubscriptionService(db)

    await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-cancel-resume',
      now: new Date('2026-07-01T00:00:00.000Z'),
    })

    const canceled = await service.markCancelAtPeriodEnd(testUser.id, new Date('2026-07-10T00:00:00.000Z'))
    expect(canceled.cancelAtPeriodEnd).toBe(true)
    expect(canceled.status).toBe('active')

    const resumed = await service.resumeRenewal(testUser.id, new Date('2026-07-10T00:00:00.000Z'))
    expect(resumed.cancelAtPeriodEnd).toBe(false)
    expect(resumed.status).toBe('active')
  })

  it('rejects cancel renewal when the current subscription is already expired', async () => {
    const service = createSubscriptionService(db)

    await service.applyPaidPeriod({
      userId: testUser.id,
      planId: plan.id,
      outTradeNo: 'epay-order-expired-cancel',
      now: new Date('2026-07-01T00:00:00.000Z'),
    })

    await expect(service.markCancelAtPeriodEnd(
      testUser.id,
      new Date('2026-08-01T00:00:00.000Z'),
    )).rejects.toMatchObject({
      errorCode: 'SUBSCRIPTION_NOT_RENEWABLE',
      statusCode: 400,
    })
  })
})

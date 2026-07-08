import type { SubscriptionPeriod, SubscriptionPlan, UserSubscription } from '../../schemas/subscriptions'
import type { SubscriptionService } from '../../services/domain/subscriptions'
import type { HonoEnv } from '../../types/hono'

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { createSubscriptionRoutes } from '.'
import { ApiError } from '../../utils/error'

const testUser = { id: 'user-1', name: 'Test User', email: 'test@example.com' }

function createPlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 'monthly_basic',
    name: '基础月度订阅',
    description: '每月 100 Flux',
    enabled: true,
    displayOrder: 0,
    periodDays: 30,
    amountFen: 600,
    fluxAmount: 100,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  }
}

function createSubscription(overrides: Partial<UserSubscription> = {}): UserSubscription {
  return {
    userId: 'user-1',
    planId: 'monthly_basic',
    status: 'active',
    currentPeriodStart: new Date('2099-07-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2099-07-31T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    lastPaymentOrderId: 'epay-order-1',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  }
}

function createPeriod(overrides: Partial<SubscriptionPeriod> = {}): SubscriptionPeriod {
  return {
    id: 'period-1',
    userId: 'user-1',
    planId: 'monthly_basic',
    outTradeNo: 'epay-order-1',
    periodStart: new Date('2099-07-01T00:00:00.000Z'),
    periodEnd: new Date('2099-07-31T00:00:00.000Z'),
    fluxAmount: 100,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    ...overrides,
  }
}

function createMockSubscriptionService(overrides: Partial<SubscriptionService> = {}): SubscriptionService {
  return {
    listEnabledPlans: vi.fn(async () => [createPlan()]),
    getPlan: vi.fn(async () => createPlan()),
    getCurrentSubscription: vi.fn(async () => null),
    getPeriodByOrder: vi.fn(async () => null),
    markCancelAtPeriodEnd: vi.fn(async () => createSubscription({ cancelAtPeriodEnd: true })),
    resumeRenewal: vi.fn(async () => createSubscription({ cancelAtPeriodEnd: false })),
    previewRenewal: vi.fn(async () => ({
      plan: createPlan(),
      planName: '基础月度订阅',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      fluxAmount: 100,
    })),
    applyPaidPeriod: vi.fn(async () => ({
      plan: createPlan(),
      planName: '基础月度订阅',
      periodStart: new Date('2026-07-01T00:00:00.000Z'),
      periodEnd: new Date('2026-07-31T00:00:00.000Z'),
      fluxAmount: 100,
      period: {} as never,
      subscription: createSubscription(),
      idempotent: false,
    })),
    ...overrides,
  }
}

function createTestApp(subscriptionService: SubscriptionService) {
  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ error: err.errorCode, message: err.message, details: err.details }, err.statusCode)
    }
    return c.json({ error: 'Internal Server Error', message: err.message }, 500)
  })

  app.use('*', async (c, next) => {
    const user = (c.env as any)?.user
    c.set('user', user ?? null)
    await next()
  })

  app.route('/api/v1/subscriptions', createSubscriptionRoutes(subscriptionService))
  return app
}

describe('subscriptionRoutes', () => {
  it('returns an empty current subscription payload when the user has no subscription', async () => {
    const subscriptionService = createMockSubscriptionService({
      getCurrentSubscription: vi.fn(async () => null),
    })
    const app = createTestApp(subscriptionService)

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/subscriptions/current'),
      { user: testUser } as any,
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      subscription: {
        status: 'none',
        plan: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: null,
        lastPaymentOrderId: null,
        remainingDays: 0,
        currentPeriodFluxAmount: 0,
        isRenewable: false,
      },
    })
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledWith('user-1')
    expect(subscriptionService.getPlan).not.toHaveBeenCalled()
  })

  it('returns the active subscription plan, period, cancellation flag, and last payment order', async () => {
    const subscriptionService = createMockSubscriptionService({
      getCurrentSubscription: vi.fn(async () => createSubscription({
        cancelAtPeriodEnd: true,
        lastPaymentOrderId: 'epay-order-current',
      })),
      getPeriodByOrder: vi.fn(async () => createPeriod({
        outTradeNo: 'epay-order-current',
        fluxAmount: 100,
      })),
      getPlan: vi.fn(async () => createPlan({
        description: null,
        fluxAmount: 600,
        amountFen: 3000,
      })),
    })
    const app = createTestApp(subscriptionService)

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/subscriptions/current'),
      { user: testUser } as any,
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      subscription: {
        status: 'active',
        plan: {
          id: 'monthly_basic',
          name: '基础月度订阅',
          description: null,
          periodDays: 30,
          amountFen: 3000,
          amountYuan: '30.00',
          fluxAmount: 600,
        },
        currentPeriodStart: '2099-07-01T00:00:00.000Z',
        currentPeriodEnd: '2099-07-31T00:00:00.000Z',
        cancelAtPeriodEnd: true,
        lastPaymentOrderId: 'epay-order-current',
        remainingDays: expect.any(Number),
        currentPeriodFluxAmount: 100,
        isRenewable: true,
      },
    })
    expect(subscriptionService.getCurrentSubscription).toHaveBeenCalledWith('user-1')
    expect(subscriptionService.getPeriodByOrder).toHaveBeenCalledWith('epay-order-current')
    expect(subscriptionService.getPlan).toHaveBeenCalledWith('monthly_basic')
  })

  it('marks the current subscription to cancel at period end', async () => {
    const subscription = createSubscription({
      cancelAtPeriodEnd: true,
      lastPaymentOrderId: 'epay-order-cancel',
    })
    const subscriptionService = createMockSubscriptionService({
      markCancelAtPeriodEnd: vi.fn(async () => subscription),
      getPlan: vi.fn(async () => createPlan()),
    })
    const app = createTestApp(subscriptionService)

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/subscriptions/cancel-renewal', { method: 'POST' }),
      { user: testUser } as any,
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      subscription: expect.objectContaining({
        status: 'active',
        cancelAtPeriodEnd: true,
        lastPaymentOrderId: 'epay-order-cancel',
      }),
    })
    expect(subscriptionService.markCancelAtPeriodEnd).toHaveBeenCalledWith('user-1')
  })

  it('resumes renewal for the current subscription', async () => {
    const subscription = createSubscription({
      cancelAtPeriodEnd: false,
      lastPaymentOrderId: 'epay-order-resume',
    })
    const subscriptionService = createMockSubscriptionService({
      resumeRenewal: vi.fn(async () => subscription),
      getPlan: vi.fn(async () => createPlan()),
    })
    const app = createTestApp(subscriptionService)

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/subscriptions/resume-renewal', { method: 'POST' }),
      { user: testUser } as any,
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      subscription: expect.objectContaining({
        status: 'active',
        cancelAtPeriodEnd: false,
        lastPaymentOrderId: 'epay-order-resume',
      }),
    })
    expect(subscriptionService.resumeRenewal).toHaveBeenCalledWith('user-1')
  })
})

import type { Database } from '../../libs/db'
import type { SubscriptionService } from './subscriptions'

import { createHash } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { mockDB } from '../../libs/mock-db'
import { createEpayService } from './epay'
import { createSubscriptionService } from './subscriptions'

import * as schema from '../../schemas'

const config = {
  apiUrl: 'https://pay.example.com',
  pid: '1001',
  key: 'secret-key',
}

function signParams(params: Record<string, string>): Record<string, string> {
  const payload = Object.keys(params)
    .filter(key => key !== 'sign' && key !== 'sign_type' && params[key] !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')

  return {
    ...params,
    sign: createHash('md5').update(payload + config.key).digest('hex'),
    sign_type: 'MD5',
  }
}


function createSubscriptionServiceMock(): SubscriptionService {
  return {
    listEnabledPlans: vi.fn(async () => []),
    getPlan: vi.fn(async () => {
      throw new Error('Subscription plan mock should not be used by legacy epay tests')
    }),
    getCurrentSubscription: vi.fn(async () => null),
    getPeriodByOrder: vi.fn(async () => null),
    markCancelAtPeriodEnd: vi.fn(async () => {
      throw new Error('Subscription cancel mock should not be used by legacy epay tests')
    }),
    resumeRenewal: vi.fn(async () => {
      throw new Error('Subscription resume mock should not be used by legacy epay tests')
    }),
    previewRenewal: vi.fn(async () => {
      throw new Error('Subscription renewal mock should not be used by legacy epay tests')
    }),
    applyPaidPeriod: vi.fn(async () => {
      throw new Error('Subscription period mock should not be used by legacy epay tests')
    }),
  }
}

function createBillingService() {
  return {
    creditFlux: vi.fn(async () => ({
      balanceBefore: 0,
      balanceAfter: 100,
      fluxTransactionId: 'flux-tx-1',
      idempotent: false,
    })),
  }
}

async function createPendingOrder(service: ReturnType<typeof createEpayService>) {
  return service.createOrder({
    userId: 'user-epay-1',
    amountFen: 600,
    fluxAmount: 100,
    type: 'alipay',
    notifyUrl: 'https://api.example.com/api/v1/epay/notify',
    returnUrl: 'https://api.example.com/api/v1/epay/return',
    subject: '100 Flux',
  })
}

async function createPendingSubscriptionOrder(service: ReturnType<typeof createEpayService>) {
  return service.createOrder({
    userId: 'user-epay-1',
    planId: 'monthly_basic',
    orderKind: 'subscription',
    amountFen: 600,
    fluxAmount: 100,
    type: 'alipay',
    notifyUrl: 'https://api.example.com/api/v1/epay/notify',
    returnUrl: 'https://api.example.com/api/v1/epay/return',
    subject: '基础月度订阅',
  })
}

function successNotify(outTradeNo: string, overrides: Record<string, string> = {}) {
  return signParams({
    pid: config.pid,
    trade_no: 'epay-trade-1',
    out_trade_no: outTradeNo,
    type: 'alipay',
    name: '100 Flux',
    money: '6.00',
    trade_status: 'TRADE_SUCCESS',
    ...overrides,
  })
}

describe('epayService', () => {
  let db: Database

  beforeAll(async () => {
    db = await mockDB(schema)
  }, 30000)

  beforeEach(async () => {
    await db.delete(schema.epayOrders)
    await db.delete(schema.fluxTransaction)
    await db.delete(schema.userFlux)
    await db.delete(schema.subscriptionPeriods)
    await db.delete(schema.userSubscriptions)
    await db.delete(schema.subscriptionPlans)
    await db.delete(schema.user)
  })

  it('rejects createOrder before persisting when merchant config is missing', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), {
      ...config,
      key: '',
    })

    await expect(createPendingOrder(service)).rejects.toThrow('EPAY_NOT_CONFIGURED')

    const persisted = await db.select().from(schema.epayOrders)
    expect(persisted).toHaveLength(0)
  })

  it('creates a pending order and signed pay URL', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)

    const order = await createPendingOrder(service)

    expect(order.outTradeNo).toMatch(/^airi_/)
    expect(order.payUrl).toContain('https://pay.example.com/submit.php?')
    expect(order.payUrl).toContain('notify_url=https%3A%2F%2Fapi.example.com%2Fapi%2Fv1%2Fepay%2Fnotify')
    expect(order.payUrl).toContain('return_url=https%3A%2F%2Fapi.example.com%2Fapi%2Fv1%2Fepay%2Freturn')

    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted).toMatchObject({
      userId: 'user-epay-1',
      amountFen: 600,
      fluxAmount: 100,
      status: 'pending',
      fluxCredited: 0,
    })
  })

  it('valid notify credits Flux once and marks the order paid', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)
    const order = await createPendingOrder(service)

    await service.handleNotify(successNotify(order.outTradeNo))

    expect(billingService.creditFlux).toHaveBeenCalledTimes(1)
    expect(billingService.creditFlux).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-epay-1',
      amount: 100,
      requestId: `epay:${order.outTradeNo}`,
      description: 'Epay purchase CNY 6.00',
      source: 'epay.purchase',
      auditMetadata: expect.objectContaining({
        outTradeNo: order.outTradeNo,
        tradeNo: 'epay-trade-1',
      }),
    }))

    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted).toMatchObject({
      status: 'paid',
      tradeNo: 'epay-trade-1',
      fluxCredited: 1,
    })
    expect(persisted?.paidAt).toBeInstanceOf(Date)
  })

  it('subscription notify settles the paid period and records lastPaymentOrderId', async () => {
    await db.insert(schema.user).values({
      id: 'user-epay-1',
      name: 'Epay User',
      email: 'epay@example.com',
    })
    await db.insert(schema.subscriptionPlans).values({
      id: 'monthly_basic',
      name: '基础月度订阅',
      description: '每月 100 Flux',
      enabled: true,
      displayOrder: 10,
      periodDays: 30,
      amountFen: 600,
      fluxAmount: 100,
    })

    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionService(db), config)
    const order = await createPendingSubscriptionOrder(service)

    await service.handleNotify(successNotify(order.outTradeNo, { name: '基础月度订阅' }))

    expect(billingService.creditFlux).toHaveBeenCalledTimes(1)
    expect(billingService.creditFlux).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-epay-1',
      amount: 100,
      requestId: `epay:${order.outTradeNo}`,
      source: 'epay.subscription',
      auditMetadata: expect.objectContaining({
        outTradeNo: order.outTradeNo,
        tradeNo: 'epay-trade-1',
        planId: 'monthly_basic',
      }),
    }))

    const [subscription] = await db.select().from(schema.userSubscriptions)
    expect(subscription).toMatchObject({
      userId: 'user-epay-1',
      planId: 'monthly_basic',
      status: 'active',
      cancelAtPeriodEnd: false,
      lastPaymentOrderId: order.outTradeNo,
    })

    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted).toMatchObject({
      status: 'paid',
      orderKind: 'subscription',
      planId: 'monthly_basic',
      tradeNo: 'epay-trade-1',
      fluxCredited: 1,
    })
    expect(persisted?.periodStart?.toISOString()).toBe(subscription?.currentPeriodStart.toISOString())
    expect(persisted?.periodEnd?.toISOString()).toBe(subscription?.currentPeriodEnd.toISOString())
  })

  it('subscription notify uses the order snapshot when the plan is disabled and modified after checkout', async () => {
    await db.insert(schema.user).values({
      id: 'user-epay-1',
      name: 'Epay User',
      email: 'epay@example.com',
    })
    await db.insert(schema.subscriptionPlans).values({
      id: 'monthly_basic',
      name: '基础月度订阅',
      description: '每月 100 Flux',
      enabled: true,
      displayOrder: 10,
      periodDays: 30,
      amountFen: 600,
      fluxAmount: 100,
    })

    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionService(db), config)
    const order = await createPendingSubscriptionOrder(service)

    await db
      .update(schema.subscriptionPlans)
      .set({
        name: '已停用订阅',
        enabled: false,
        periodDays: 7,
        amountFen: 1,
        fluxAmount: 1,
      })
      .where(eq(schema.subscriptionPlans.id, 'monthly_basic'))

    await service.handleNotify(successNotify(order.outTradeNo, { name: '基础月度订阅' }))

    expect(billingService.creditFlux).toHaveBeenCalledWith(expect.objectContaining({
      amount: 100,
      source: 'epay.subscription',
      auditMetadata: expect.objectContaining({
        planId: 'monthly_basic',
        periodDays: 30,
        amountFen: 600,
      }),
    }))

    const [subscription] = await db.select().from(schema.userSubscriptions)
    expect(subscription).toMatchObject({
      userId: 'user-epay-1',
      planId: 'monthly_basic',
      status: 'active',
      lastPaymentOrderId: order.outTradeNo,
    })
    expect(subscription?.currentPeriodEnd.getTime()).toBe(
      subscription!.currentPeriodStart.getTime() + 30 * 24 * 60 * 60 * 1000,
    )

    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted).toMatchObject({
      status: 'paid',
      periodDays: 30,
      planName: '基础月度订阅',
      subject: '基础月度订阅',
      fluxAmount: 100,
      amountFen: 600,
    })
  })

  it('duplicate valid notify returns success without duplicate ledger credit', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)
    const order = await createPendingOrder(service)
    const notify = successNotify(order.outTradeNo)

    await service.handleNotify(notify)
    await service.handleNotify(notify)

    expect(billingService.creditFlux).toHaveBeenCalledTimes(1)
    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted?.status).toBe('paid')
    expect(persisted?.fluxCredited).toBe(1)
  })

  it('rejects notify with invalid signature', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)
    const order = await createPendingOrder(service)

    await expect(service.handleNotify({
      ...successNotify(order.outTradeNo),
      sign: 'bad-sign',
    })).rejects.toThrow('INVALID_SIGN')

    expect(billingService.creditFlux).not.toHaveBeenCalled()
  })

  it('rejects notify for the wrong merchant pid', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)
    const order = await createPendingOrder(service)

    await expect(service.handleNotify(successNotify(order.outTradeNo, {
      pid: 'other-merchant',
    }))).rejects.toThrow('INVALID_PID')

    expect(billingService.creditFlux).not.toHaveBeenCalled()
  })

  it('rejects notify when paid amount differs from the order amount', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)
    const order = await createPendingOrder(service)

    await expect(service.handleNotify(successNotify(order.outTradeNo, {
      money: '0.01',
    }))).rejects.toThrow('AMOUNT_MISMATCH')

    expect(billingService.creditFlux).not.toHaveBeenCalled()
    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted?.status).toBe('pending')
    expect(persisted?.fluxCredited).toBe(0)
  })

  it('rejects notify for an unknown order', async () => {
    const billingService = createBillingService()
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)

    await expect(service.handleNotify(successNotify('missing-order'))).rejects.toThrow('ORDER_NOT_FOUND')

    expect(billingService.creditFlux).not.toHaveBeenCalled()
  })

  it('keeps paid order retryable when Flux crediting fails', async () => {
    const billingService = createBillingService()
    billingService.creditFlux.mockRejectedValueOnce(new Error('ledger unavailable'))
    const service = createEpayService(db, billingService as any, createSubscriptionServiceMock(), config)
    const order = await createPendingOrder(service)

    await expect(service.handleNotify(successNotify(order.outTradeNo))).rejects.toThrow('ledger unavailable')

    const persisted = await service.getOrder(order.outTradeNo)
    expect(persisted).toMatchObject({
      status: 'credit_failed',
      fluxCredited: 0,
    })
  })
})

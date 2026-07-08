import type { EpayOrder } from '../../schemas/epay-order'
import type { SubscriptionPlan } from '../../schemas/subscriptions'
import type { EpayService } from '../../services/domain/epay'
import type { HonoEnv } from '../../types/hono'

import { createHash } from 'node:crypto'

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { createEpayRoutes } from '.'
import { ApiError } from '../../utils/error'

const testEnv = {
  API_SERVER_URL: 'https://api.example.com',
  WEB_APP_URL: 'https://app.example.com',
  EPAY_API_URL: 'https://pay.example.com',
  EPAY_PID: '1001',
  EPAY_KEY: 'secret-key',
} as any

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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function signParams(params: Record<string, string>): Record<string, string> {
  const payload = Object.keys(params)
    .filter(key => key !== 'sign' && key !== 'sign_type' && params[key] !== '')
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')

  return {
    ...params,
    sign: createHash('md5').update(payload + testEnv.EPAY_KEY).digest('hex'),
    sign_type: 'MD5',
  }
}

function createOrder(overrides: Partial<EpayOrder> = {}): EpayOrder {
  return {
    id: 'order-row-1',
    outTradeNo: 'airi_order_1',
    userId: 'user-1',
    amountFen: 600,
    fluxAmount: 100,
    type: 'alipay',
    status: 'paid',
    tradeNo: 'epay-trade-1',
    fluxCredited: 1,
    notifyPayload: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    paidAt: new Date(),
    ...overrides,
  }
}

function createMockEpayService(overrides: Partial<EpayService> = {}): EpayService {
  return {
    createOrder: vi.fn(async () => ({
      outTradeNo: 'airi_order_1',
      payUrl: 'https://pay.example.com/submit.php?out_trade_no=airi_order_1',
    })),
    listPlans: vi.fn(async () => [createPlan()]),
    handleNotify: vi.fn(async () => 'success' as const),
    getOrder: vi.fn(async () => createOrder()),
    ...overrides,
  } as EpayService
}

function createTestApp(epayService: EpayService, envOverrides: Record<string, unknown> = {}) {
  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({
        error: err.errorCode,
        message: err.message,
        details: err.details,
      }, err.statusCode)
    }
    return c.json({ error: 'Internal Server Error', message: err.message }, 500)
  })

  app.use('*', async (c, next) => {
    const user = (c.env as any)?.user
    if (user)
      c.set('user', user)
    await next()
  })

  app.route('/api/v1/epay', createEpayRoutes(epayService, { ...testEnv, ...envOverrides } as any))
  return app
}

describe('epayRoutes', () => {
  it('returns public subscription plans from the epay service', async () => {
    const epayService = createMockEpayService()
    const app = createTestApp(epayService)

    const res = await app.request('/api/v1/epay/packages')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      {
        id: 'monthly_basic',
        label: '基础月度订阅',
        description: '每月 100 Flux',
        amountFen: 600,
        amountYuan: '6.00',
        fluxAmount: 100,
        periodDays: 30,
        kind: 'subscription_plan',
      },
    ])
    expect(epayService.listPlans).toHaveBeenCalledTimes(1)
  })

  it('keeps the legacy packages response only when plan listing is unavailable', async () => {
    const epayService = createMockEpayService() as EpayService & { listPlans?: EpayService['listPlans'] }
    Reflect.deleteProperty(epayService, 'listPlans')
    const app = createTestApp(epayService)

    const res = await app.request('/api/v1/epay/packages')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([
      { id: 'flux_100', label: '100 Flux', amountYuan: '6.00', fluxAmount: 100 },
      { id: 'flux_600', label: '600 Flux', amountYuan: '30.00', fluxAmount: 600 },
      { id: 'flux_2400', label: '2400 Flux', amountYuan: '98.00', fluxAmount: 2400 },
    ])
  })

  it('creates checkout orders with server notify and return URLs', async () => {
    const epayService = createMockEpayService()
    const app = createTestApp(epayService)

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/epay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: 'monthly_basic', type: 'alipay' }),
      }),
      { user: testUser } as any,
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      outTradeNo: 'airi_order_1',
      payUrl: 'https://pay.example.com/submit.php?out_trade_no=airi_order_1',
      planId: 'monthly_basic',
      amountYuan: '6.00',
      fluxAmount: 100,
    })
    expect(epayService.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      planId: 'monthly_basic',
      orderKind: 'subscription',
      amountFen: 600,
      fluxAmount: 100,
      type: 'alipay',
      subject: '基础月度订阅',
      notifyUrl: 'https://api.example.com/api/v1/epay/notify',
      returnUrl: 'https://api.example.com/api/v1/epay/return',
    }))
  })

  it('returns sanitized setup guidance for checkout when real epay config is missing', async () => {
    const epayService = createMockEpayService()
    const app = createTestApp(epayService, {
      API_SERVER_URL: '',
      EPAY_API_URL: '',
      EPAY_PID: '',
      EPAY_KEY: '',
    })

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/epay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: 'flux_100' }),
      }),
      { user: testUser } as any,
    )

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body).toEqual({
      error: 'EPAY_NOT_CONFIGURED',
      message: 'Epay checkout is not configured. Configure an Epay merchant account (EPAY_PID, EPAY_KEY, EPAY_API_URL) and a public callback base URL via EPAY_CALLBACK_BASE_URL or API_SERVER_URL.',
      details: {
        missing: ['EPAY_API_URL', 'EPAY_PID', 'EPAY_KEY', 'EPAY_CALLBACK_BASE_URL or API_SERVER_URL'],
        required: ['EPAY_API_URL', 'EPAY_PID', 'EPAY_KEY', 'EPAY_CALLBACK_BASE_URL or API_SERVER_URL'],
      },
    })
    expect(JSON.stringify(body)).not.toContain('secret-key')
    expect(epayService.createOrder).not.toHaveBeenCalled()
  })

  it('accepts POST notify and returns plain success', async () => {
    const epayService = createMockEpayService()
    const app = createTestApp(epayService)
    const params = signParams({
      pid: '1001',
      out_trade_no: 'airi_order_1',
      trade_no: 'epay-trade-1',
      money: '6.00',
      trade_status: 'TRADE_SUCCESS',
    })

    const res = await app.request('/api/v1/epay/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('success')
    expect(epayService.handleNotify).toHaveBeenCalledWith(expect.objectContaining({
      out_trade_no: 'airi_order_1',
    }))
  })

  it('accepts GET notify for epay retry compatibility', async () => {
    const epayService = createMockEpayService()
    const app = createTestApp(epayService)
    const params = signParams({
      pid: '1001',
      out_trade_no: 'airi_order_1',
      trade_no: 'epay-trade-1',
      money: '6.00',
      trade_status: 'TRADE_SUCCESS',
    })

    const res = await app.request(`/api/v1/epay/notify?${new URLSearchParams(params)}`)

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('success')
    expect(epayService.handleNotify).toHaveBeenCalledWith(expect.objectContaining({
      out_trade_no: 'airi_order_1',
    }))
  })

  it('redirects valid returns back to the Flux page', async () => {
    const app = createTestApp(createMockEpayService({
      getOrder: vi.fn(async () => createOrder({ status: 'paid', fluxCredited: 1 })),
    }))
    const params = signParams({
      pid: '1001',
      out_trade_no: 'airi_order_1',
      trade_no: 'epay-trade-1',
      money: '6.00',
      trade_status: 'TRADE_SUCCESS',
    })

    const res = await app.request(`/api/v1/epay/return?${new URLSearchParams(params)}`)

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://app.example.com/settings/flux?epay_trade=airi_order_1&epay_return=paid')
  })

  it('only lets users query their own epay order', async () => {
    const app = createTestApp(createMockEpayService({
      getOrder: vi.fn(async () => createOrder({ userId: 'other-user' })),
    }))

    const res = await app.fetch(
      new Request('https://api.example.com/api/v1/epay/order/airi_order_1'),
      { user: testUser } as any,
    )

    expect(res.status).toBe(404)
  })
})

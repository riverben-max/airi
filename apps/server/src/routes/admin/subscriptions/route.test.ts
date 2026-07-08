import type { SubscriptionPlan } from '../../../schemas/subscriptions'
import type { AdminSubscriptionPlanService } from '../../../services/domain/subscriptions'
import type { HonoEnv } from '../../../types/hono'

import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'

import { createAdminSubscriptionRoutes } from '.'
import { ApiError } from '../../../utils/error'

const adminUser = { id: 'admin-user', email: 'admin@example.com', name: 'Admin', role: 'admin' }

function createPlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return {
    id: 'monthly_basic',
    name: '基础月度订阅',
    description: '每月 100 Flux',
    enabled: true,
    displayOrder: 10,
    periodDays: 30,
    amountFen: 600,
    fluxAmount: 100,
    createdAt: new Date('2026-07-04T00:00:00.000Z'),
    updatedAt: new Date('2026-07-04T00:00:00.000Z'),
    ...overrides,
  }
}

function createService(overrides: Partial<AdminSubscriptionPlanService> = {}): AdminSubscriptionPlanService {
  return {
    listPlansForAdmin: vi.fn(async () => [
      createPlan(),
      createPlan({ id: 'disabled_plan', enabled: false, displayOrder: 20 }),
    ]),
    createPlan: vi.fn(async input => createPlan({ ...input, enabled: input.enabled ?? true, displayOrder: input.displayOrder ?? 0, description: input.description ?? null })),
    updatePlan: vi.fn(async (id, input) => createPlan({ id, ...input })),
    disablePlan: vi.fn(async id => createPlan({ id, enabled: false })),
    ensureDefaultPlans: vi.fn(async () => ({
      plans: [createPlan(), createPlan({ id: 'monthly_pro', name: '专业月度订阅', displayOrder: 20 })],
      createdPlanIds: ['monthly_basic', 'monthly_pro'],
    })),
    ...overrides,
  }
}

function createTestApp(service: AdminSubscriptionPlanService, user: Record<string, unknown> | null = adminUser) {
  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({
        error: err.errorCode,
        message: err.message,
        details: err.details,
      }, err.statusCode)
    }
    return c.json({ error: 'Internal Server Error', message: String(err) }, 500)
  })

  app.use('*', async (c, next) => {
    c.set('user', user as never)
    c.set('session', user == null ? null : ({} as never))
    await next()
  })

  app.route('/api/admin/subscriptions', createAdminSubscriptionRoutes(service))
  return app
}

describe('admin subscription plan routes', () => {
  it('lists all plans including disabled plans for admins', async () => {
    const service = createService()
    const app = createTestApp(service)

    const res = await app.request('/api/admin/subscriptions/plans')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      plans: [
        {
          id: 'monthly_basic',
          name: '基础月度订阅',
          description: '每月 100 Flux',
          enabled: true,
          displayOrder: 10,
          periodDays: 30,
          amountFen: 600,
          fluxAmount: 100,
          createdAt: '2026-07-04T00:00:00.000Z',
          updatedAt: '2026-07-04T00:00:00.000Z',
        },
        {
          id: 'disabled_plan',
          name: '基础月度订阅',
          description: '每月 100 Flux',
          enabled: false,
          displayOrder: 20,
          periodDays: 30,
          amountFen: 600,
          fluxAmount: 100,
          createdAt: '2026-07-04T00:00:00.000Z',
          updatedAt: '2026-07-04T00:00:00.000Z',
        },
      ],
    })
    expect(service.listPlansForAdmin).toHaveBeenCalledTimes(1)
  })

  it('creates a plan after validating admin input', async () => {
    const service = createService()
    const app = createTestApp(service)

    const res = await app.request('/api/admin/subscriptions/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'monthly_pro',
        name: '专业月度订阅',
        description: '每月 600 Flux',
        enabled: true,
        displayOrder: 20,
        periodDays: 30,
        amountFen: 3000,
        fluxAmount: 600,
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json() as { plan: { id: string } }
    expect(body.plan.id).toBe('monthly_pro')
    expect(service.createPlan).toHaveBeenCalledWith({
      id: 'monthly_pro',
      name: '专业月度订阅',
      description: '每月 600 Flux',
      enabled: true,
      displayOrder: 20,
      periodDays: 30,
      amountFen: 3000,
      fluxAmount: 600,
    })
  })

  it('rejects invalid plan amounts before calling the service', async () => {
    const service = createService()
    const app = createTestApp(service)

    const res = await app.request('/api/admin/subscriptions/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'bad_plan',
        name: 'Bad Plan',
        periodDays: 0,
        amountFen: -1,
        fluxAmount: -1,
      }),
    })

    expect(res.status).toBe(400)
    expect(service.createPlan).not.toHaveBeenCalled()
  })

  it('patches only editable plan fields', async () => {
    const service = createService()
    const app = createTestApp(service)

    const res = await app.request('/api/admin/subscriptions/plans/monthly_basic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '基础套餐', enabled: false, fluxAmount: 120 }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as { plan: { enabled: boolean } }
    expect(body.plan.enabled).toBe(false)
    expect(service.updatePlan).toHaveBeenCalledWith('monthly_basic', { name: '基础套餐', enabled: false, fluxAmount: 120 })
  })

  it('disables plans instead of deleting them', async () => {
    const service = createService()
    const app = createTestApp(service)

    const res = await app.request('/api/admin/subscriptions/plans/monthly_basic', { method: 'DELETE' })

    expect(res.status).toBe(200)
    const body = await res.json() as { plan: { enabled: boolean } }
    expect(body.plan.enabled).toBe(false)
    expect(service.disablePlan).toHaveBeenCalledWith('monthly_basic')
  })

  it('explicitly seeds default example plans on admin request', async () => {
    const service = createService()
    const app = createTestApp(service)

    const res = await app.request('/api/admin/subscriptions/plans/defaults', { method: 'POST' })

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      plans: [
        expect.objectContaining({ id: 'monthly_basic' }),
        expect.objectContaining({ id: 'monthly_pro' }),
      ],
      createdPlanIds: ['monthly_basic', 'monthly_pro'],
    })
    expect(service.ensureDefaultPlans).toHaveBeenCalledTimes(1)
  })
})

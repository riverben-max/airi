import type { AdminModel, AdminRemoteClient, AdminSubscriptionPlan, AdminUser } from './adminApi'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyOfficialChatGateway,
  applyRouterConfig,
  banUser,
  createModel,
  createPlan,
  disableModel,
  disablePlan,
  discoverUpstreamModels,
  formatDate,
  formatFen,
  formatPeriodDays,
  getRouterConfig,
  getUser,
  grantUserFlux,
  listModels,
  listPlans,
  listUsers,
  seedDefaultPlans,
  setUserFlux,
  syncCapabilityAliases,
  unbanUser,
  updateModel,
  updatePlan,
} from './adminApi'

const mocks = vi.hoisted(() => ({
  authedFetch: vi.fn(),
}))

vi.mock('@proj-airi/stage-ui/libs/auth-fetch', () => ({
  authedFetch: mocks.authedFetch,
}))

vi.mock('@proj-airi/stage-ui/libs/server', () => ({
  SERVER_URL: 'https://api.example.test',
}))

interface MockResponse<T> {
  json: () => Promise<T>
  ok: boolean
  status: number
  text: () => Promise<string>
}

function okJson<T>(data: T): MockResponse<T> {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

function createUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    name: 'Alice',
    email: 'alice@example.test',
    emailVerified: true,
    image: null,
    role: 'user',
    banned: false,
    banReason: null,
    banExpires: null,
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    flux: 100,
    stripeCustomerId: null,
    ...overrides,
  }
}

function createAdminModel(overrides: Partial<AdminModel> = {}): AdminModel {
  return {
    id: 'model-1',
    capability: 'chat',
    routerModelId: 'openai/gpt-4.1-mini',
    displayName: 'GPT 4.1 mini',
    enabled: true,
    displayOrder: 0,
    fluxPerCall: 4,
    priceEnabled: true,
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...overrides,
  }
}

function createAdminPlan(overrides: Partial<AdminSubscriptionPlan> = {}): AdminSubscriptionPlan {
  return {
    id: 'monthly_basic',
    name: 'Monthly Basic',
    description: null,
    enabled: true,
    displayOrder: 0,
    periodDays: 30,
    amountFen: 600,
    fluxAmount: 100,
    createdAt: '2026-07-04T00:00:00.000Z',
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...overrides,
  }
}

function createMockClient(): AdminRemoteClient {
  return {
    api: {
      admin: {
        'users': {
          '$get': vi.fn(async () => okJson({ users: [], hasMore: false, nextOffset: null, total: 0 })),
          ':id': {
            $get: vi.fn(async () => okJson({ user: createUser(), recentFluxTransactions: [] })),
            flux: {
              $patch: vi.fn(async () => okJson({ balanceBefore: 1, balanceAfter: 2, fluxTransactionId: 'tx-1', changed: true })),
              grant: {
                $post: vi.fn(async () => okJson({ balanceBefore: 1, balanceAfter: 6, fluxTransactionId: 'tx-2', idempotent: false })),
              },
            },
          },
        },
        'provider-catalog': {
          models: {
            '$get': vi.fn(async () => okJson([])),
            '$post': vi.fn(async () => okJson(createAdminModel())),
            ':id': {
              $patch: vi.fn(async () => okJson(createAdminModel())),
              $delete: vi.fn(async () => okJson(createAdminModel({ enabled: false }))),
            },
          },
        },
        'config': {
          router: {
            $get: vi.fn(async () => okJson({
              request: {
                mode: 'merge' as const,
                slices: [],
                defaults: {},
              },
              preview: {},
              loadedAt: '2026-07-06T00:00:00.000Z',
              missingKeys: [],
            })),
            $post: vi.fn(async () => okJson({
              applied: [],
              invalidatedKeys: ['LLM_ROUTER_CONFIG', 'DEFAULT_CHAT_MODEL'],
              preview: {
                DEFAULT_CHAT_MODEL: 'openai/gpt-5-mini',
              },
            })),
          },
        },
        'capability-aliases': {
          sync: {
            $post: vi.fn(async () => okJson({
              aliases: [{
                id: 'alias-1',
                surface: 'llm' as const,
                aliasId: 'auto',
                displayName: 'Auto',
                enabled: true,
                displayOrder: 0,
                fallbackEnabled: true,
                loadBalancingEnabled: false,
                createdAt: '2026-07-06T00:00:00.000Z',
                updatedAt: '2026-07-06T00:00:00.000Z',
              }],
            })),
          },
        },
        'subscriptions': {
          plans: {
            '$get': vi.fn(async () => okJson({ plans: [] })),
            '$post': vi.fn(async () => okJson({ plan: createAdminPlan() })),
            'defaults': {
              $post: vi.fn(async () => okJson({ plans: [], createdPlanIds: [] })),
            },
            ':id': {
              $patch: vi.fn(async () => okJson({ plan: createAdminPlan() })),
              $delete: vi.fn(async () => okJson({ plan: createAdminPlan({ enabled: false }) })),
            },
          },
        },
      },
    },
  }
}

describe('admin API adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authedFetch.mockResolvedValue(okJson({}))
  })

  it('maps user list filters to admin query parameters', async () => {
    const client = createMockClient()

    await listUsers({ query: 'alice', page: 3, pageSize: 25, status: 'verified' }, client)

    expect(client.api.admin.users.$get).toHaveBeenCalledWith({
      query: {
        limit: '25',
        offset: '50',
        query: 'alice',
        status: 'verified',
      },
    })
  })

  it('maps user detail and flux operations to user routes', async () => {
    const client = createMockClient()

    await getUser('user-1', client)
    await setUserFlux('user-1', 900, client)
    await grantUserFlux('user-1', 50, 'Manual adjustment', client)

    expect(client.api.admin.users[':id'].$get).toHaveBeenCalledWith({ param: { id: 'user-1' } })
    expect(client.api.admin.users[':id'].flux.$patch).toHaveBeenCalledWith({
      param: { id: 'user-1' },
      json: { balance: 900 },
    })
    expect(client.api.admin.users[':id'].flux.grant.$post).toHaveBeenCalledWith({
      param: { id: 'user-1' },
      json: { amount: 50, description: 'Manual adjustment' },
    })
  })

  it('maps model operations to provider catalog routes', async () => {
    const client = createMockClient()
    const input = {
      capability: 'chat' as const,
      routerModelId: 'openai/gpt-4.1-mini',
      displayName: 'GPT 4.1 mini',
      fluxPerCall: 4,
    }

    await listModels(client)
    await createModel(input, client)
    await updateModel('model-1', { enabled: false, priceEnabled: false }, client)
    await disableModel('model-1', client)

    expect(client.api.admin['provider-catalog'].models.$get).toHaveBeenCalledWith()
    expect(client.api.admin['provider-catalog'].models.$post).toHaveBeenCalledWith({ json: input })
    expect(client.api.admin['provider-catalog'].models[':id'].$patch).toHaveBeenCalledWith({
      param: { id: 'model-1' },
      json: { enabled: false, priceEnabled: false },
    })
    expect(client.api.admin['provider-catalog'].models[':id'].$delete).toHaveBeenCalledWith({ param: { id: 'model-1' } })
  })

  it('maps subscription plan operations to plan routes', async () => {
    const client = createMockClient()
    const input = {
      id: 'monthly_basic',
      name: 'Monthly Basic',
      periodDays: 30,
      amountFen: 600,
      fluxAmount: 100,
    }

    await listPlans(client)
    await createPlan(input, client)
    await updatePlan('monthly_basic', { enabled: false, fluxAmount: 120 }, client)
    await disablePlan('monthly_basic', client)
    await seedDefaultPlans(client)

    expect(client.api.admin.subscriptions.plans.$get).toHaveBeenCalledWith()
    expect(client.api.admin.subscriptions.plans.$post).toHaveBeenCalledWith({ json: input })
    expect(client.api.admin.subscriptions.plans[':id'].$patch).toHaveBeenCalledWith({
      param: { id: 'monthly_basic' },
      json: { enabled: false, fluxAmount: 120 },
    })
    expect(client.api.admin.subscriptions.plans[':id'].$delete).toHaveBeenCalledWith({ param: { id: 'monthly_basic' } })
    expect(client.api.admin.subscriptions.plans.defaults.$post).toHaveBeenCalledWith()
  })

  it('maps router config and alias helpers to admin routes', async () => {
    const client = createMockClient()

    await getRouterConfig(client)
    await applyRouterConfig({
      mode: 'merge',
      dryRun: false,
      slices: [{
        kind: 'openai-compatible',
        modelName: 'openai/gpt-5-mini',
        overrideModel: 'gpt-5-mini',
        baseURL: 'https://api.openai.com/v1',
        plaintextKey: 'sk-test',
      }],
      defaults: { chatModel: 'openai/gpt-5-mini' },
    }, client)
    await syncCapabilityAliases('llm', client)

    expect(client.api.admin.config.router.$get).toHaveBeenCalledWith()
    expect(client.api.admin.config.router.$post).toHaveBeenCalledWith({
      json: {
        mode: 'merge',
        dryRun: false,
        slices: [{
          kind: 'openai-compatible',
          modelName: 'openai/gpt-5-mini',
          overrideModel: 'gpt-5-mini',
          baseURL: 'https://api.openai.com/v1',
          plaintextKey: 'sk-test',
        }],
        defaults: { chatModel: 'openai/gpt-5-mini' },
      },
    })
    expect(client.api.admin['capability-aliases'].sync.$post).toHaveBeenCalledWith({ json: { surface: 'llm' } })
  })

  it('maps upstream model discovery to the router config route', async () => {
    const client = createMockClient()
    const models = { $post: vi.fn(async () => okJson({ models: ['gpt-5-mini'] })) }
    ;(client.api.admin.config.router as { models?: typeof models }).models = models

    await expect(discoverUpstreamModels({
      providerKind: 'openai-compatible',
      baseURL: 'https://gateway.example/v1',
      plaintextKey: 'sk-test',
    }, client)).resolves.toEqual(['gpt-5-mini'])

    expect(models.$post).toHaveBeenCalledWith({
      json: {
        providerKind: 'openai-compatible',
        baseURL: 'https://gateway.example/v1',
        plaintextKey: 'sk-test',
      },
    })
  })

  it('maps official chat gateway setup to router config, alias sync, and billable model upsert', async () => {
    const client = createMockClient()

    const result = await applyOfficialChatGateway({
      providerKind: 'openai-compatible',
      routerModelId: 'openai/gpt-5-mini',
      upstreamModel: 'gpt-5-mini',
      baseURL: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      displayName: 'GPT-5 Mini',
      fluxPerCall: 2,
      setAsDefault: true,
      enabled: true,
      priceEnabled: true,
    }, client)

    expect(client.api.admin.config.router.$post).toHaveBeenCalledWith({
      json: {
        mode: 'merge',
        dryRun: false,
        slices: [{
          kind: 'openai-compatible',
          modelName: 'openai/gpt-5-mini',
          overrideModel: 'gpt-5-mini',
          baseURL: 'https://api.openai.com/v1',
          plaintextKey: 'sk-test',
        }],
        defaults: { chatModel: 'openai/gpt-5-mini' },
      },
    })
    expect(client.api.admin['capability-aliases'].sync.$post).toHaveBeenCalledWith({ json: { surface: 'llm' } })
    expect(client.api.admin['provider-catalog'].models.$post).toHaveBeenCalledWith({
      json: {
        capability: 'chat',
        routerModelId: 'openai/gpt-5-mini',
        displayName: 'GPT-5 Mini',
        fluxPerCall: 2,
        enabled: true,
        priceEnabled: true,
      },
    })
    expect(result.routerConfig.preview.DEFAULT_CHAT_MODEL).toBe('openai/gpt-5-mini')
    expect(result.aliases).toHaveLength(1)
    expect(result.model.routerModelId).toBe('openai/gpt-4.1-mini')
  })

  it('uses Better Auth admin routes for ban and unban', async () => {
    await banUser('user-1', 'Chargeback risk', 3600)
    await unbanUser('user-1')

    expect(mocks.authedFetch).toHaveBeenNthCalledWith(1, new URL('/api/auth/admin/ban-user', 'https://api.example.test'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-1',
        banReason: 'Chargeback risk',
        banExpiresIn: 3600,
      }),
    })
    expect(mocks.authedFetch).toHaveBeenNthCalledWith(2, new URL('/api/auth/admin/unban-user', 'https://api.example.test'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'user-1' }),
    })
  })

  it('formats admin display values without side effects', () => {
    expect(formatFen(0)).toBe('¥0.00')
    expect(formatFen(605)).toBe('¥6.05')
    expect(formatFen(-120)).toBe('-¥1.20')
    expect(formatDate('2026-07-04T12:34:56.000Z')).toBe('2026-07-04 12:34')
    expect(formatDate(null)).toBe('-')
    expect(formatPeriodDays(30)).toBe('30 days')
    expect(formatPeriodDays(null)).toBe('-')
  })
})

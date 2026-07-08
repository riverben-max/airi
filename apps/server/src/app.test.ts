import { describe, expect, it, vi } from 'vitest'

import { buildApp } from './app'

const TEST_AUTH_TOKEN = 'test-auth-token'
const DISABLED_SYNC_ERROR = 'PRIVATE_SYNC_DISABLED'

function createTestDeps() {
  const authServerMetadata = {
    issuer: 'http://localhost:3000/api/auth',
    authorization_endpoint: 'http://localhost:3000/api/auth/oauth2/authorize',
    token_endpoint: 'http://localhost:3000/api/auth/oauth2/token',
  }

  const openIdConfig = {
    issuer: 'http://localhost:3000/api/auth',
    jwks_uri: 'http://localhost:3000/api/auth/jwks',
    authorization_endpoint: 'http://localhost:3000/api/auth/oauth2/authorize',
    token_endpoint: 'http://localhost:3000/api/auth/oauth2/token',
  }

  const auth = {
    api: {
      getSession: vi.fn(async () => null),
      getOAuthServerConfig: vi.fn(async () => authServerMetadata),
      getOpenIdConfig: vi.fn(async () => openIdConfig),
    },
    handler: vi.fn(async () => new Response('not-found', { status: 404 })),
  } as any

  const redisSubscriber = {
    on: vi.fn(),
    subscribe: vi.fn(async () => 1),
    unsubscribe: vi.fn(async () => 0),
  }

  const redis = {
    duplicate: vi.fn(() => redisSubscriber),
    publish: vi.fn(async () => 0),
    ping: vi.fn(async () => 'PONG'),
  }

  const chatService = {
    createChat: vi.fn(async () => ({ id: 'chat-1' })),
    listChats: vi.fn(async () => []),
    getChat: vi.fn(async () => ({ id: 'chat-1' })),
    updateChat: vi.fn(async () => ({ id: 'chat-1' })),
    deleteChat: vi.fn(async () => ({ id: 'chat-1' })),
    addMember: vi.fn(async () => ({ id: 'member-1' })),
    removeMember: vi.fn(async () => ({ id: 'member-1' })),
  }

  const characterService = {
    findAll: vi.fn(async () => []),
    findByOwnerId: vi.fn(async () => []),
    findById: vi.fn(async () => ({ id: 'character-1', ownerId: 'test-user-id' })),
    create: vi.fn(async () => ({ id: 'character-1' })),
    update: vi.fn(async () => ({ id: 'character-1' })),
    delete: vi.fn(async () => undefined),
    like: vi.fn(async () => ({ liked: true })),
    bookmark: vi.fn(async () => ({ bookmarked: true })),
  }

  const deps = {
    auth,
    db: {
      execute: vi.fn(async () => undefined),
    } as any,
    characterService: characterService as any,
    chatService: chatService as any,
    providerService: {} as any,
    fluxService: {} as any,
    fluxTransactionService: {} as any,
    stripeService: {} as any,
    epayService: {} as any,
    billingService: {} as any,
    adminFluxGrantsService: {} as any,
    adminRouterConfigService: {} as any,
    adminUsersService: {} as any,
    ttsMeter: {} as any,
    requestLogService: {} as any,
    voicePackService: {} as any,
    providerCatalogService: {
      listBillableModels: vi.fn(async () => []),
      getFixedModelPrice: vi.fn(async () => null),
      assertTtsModelEnabled: vi.fn(async () => ({})),
      assertTtsVoiceEnabled: vi.fn(async () => ({})),
    } as any,
    productEventService: {
      track: vi.fn(async () => undefined),
      countDistinctUsersByFeature: vi.fn(async () => []),
    },
    configKV: {
      getOrThrow: vi.fn(async (key: string) => {
        switch (key) {
          case 'AUTH_RATE_LIMIT_MAX':
            return 20
          case 'AUTH_RATE_LIMIT_WINDOW_SEC':
            return 60
          default:
            throw new Error(`Unexpected config key: ${key}`)
        }
      }),
    } as any,
    redis: redis as any,
    env: {
      API_SERVER_URL: 'http://localhost:3000',
      ADDITIONAL_TRUSTED_ORIGINS: '',
      TEST_AUTH_TOKEN,
      TEST_AUTH_USER_ID: 'test-user-id',
      TEST_AUTH_USER_EMAIL: 'test@example.com',
      TEST_AUTH_USER_NAME: 'Test User',
      TEST_AUTH_USER_ROLE: '',
    } as any,
    otel: null,
    userDeletionService: {} as any,
    llmRouter: {
      route: vi.fn(async () => new Response('{}', { status: 200 })),
      invalidateConfig: vi.fn(),
    } as any,
    envelopeCrypto: {
      encryptKey: vi.fn(),
      decryptKey: vi.fn(),
    } as any,
  }

  return {
    deps,
    auth,
    authServerMetadata,
    openIdConfig,
    redis,
    chatService,
    characterService,
  }
}

describe('app well-known metadata routes', () => {
  it('serves oauth authorization server metadata at the root well-known path', async () => {
    const { deps, auth, authServerMetadata } = createTestDeps()
    const { app } = await buildApp(deps)

    const res = await app.request('/.well-known/oauth-authorization-server/api/auth')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(authServerMetadata)
    expect(auth.api.getOAuthServerConfig).toHaveBeenCalledTimes(1)
    expect(auth.api.getOpenIdConfig).not.toHaveBeenCalled()
  })

  it('serves openid configuration at the issuer-appended well-known path', async () => {
    const { deps, auth, openIdConfig } = createTestDeps()
    const { app } = await buildApp(deps)

    const res = await app.request('/api/auth/.well-known/openid-configuration')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual(openIdConfig)
    expect(auth.api.getOpenIdConfig).toHaveBeenCalledTimes(1)
    expect(auth.api.getOAuthServerConfig).not.toHaveBeenCalled()
  })
})

async function expectDisabledSyncResponse(res: Response) {
  expect(res.status).toBe(410)
  expect(res.headers.get('content-type')).toContain('application/json')
  expect(await res.json()).toMatchObject({ error: DISABLED_SYNC_ERROR })
}

function expectNoPrivateSyncServiceCalls(service: Record<string, unknown>) {
  for (const value of Object.values(service)) {
    if (vi.isMockFunction(value))
      expect(value).not.toHaveBeenCalled()
  }
}

describe('app private sync hard-block routes', () => {
  it('blocks representative chat REST methods before they reach the chat service', async () => {
    const { deps, chatService } = createTestDeps()
    const { app } = await buildApp(deps)
    const headers = {
      'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    }

    const responses = await Promise.all([
      app.request('/api/v1/chats', { method: 'GET', headers }),
      app.request('/api/v1/chats', { method: 'POST', headers, body: JSON.stringify({ title: 'Private chat' }) }),
      app.request('/api/v1/chats/chat-1', { method: 'PATCH', headers, body: JSON.stringify({ title: 'Updated title' }) }),
      app.request('/api/v1/chats/chat-1', { method: 'DELETE', headers }),
    ])

    for (const res of responses)
      await expectDisabledSyncResponse(res)
    expectNoPrivateSyncServiceCalls(chatService)
  })

  it('blocks representative character REST methods before they reach the character service', async () => {
    const { deps, characterService } = createTestDeps()
    const { app } = await buildApp(deps)
    const headers = {
      'Authorization': `Bearer ${TEST_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    }

    const responses = await Promise.all([
      app.request('/api/v1/characters', { method: 'GET', headers }),
      app.request('/api/v1/characters', { method: 'POST', headers, body: JSON.stringify({ character: { name: 'Private character' } }) }),
      app.request('/api/v1/characters/character-1', { method: 'PATCH', headers, body: JSON.stringify({ name: 'Updated character' }) }),
      app.request('/api/v1/characters/character-1', { method: 'DELETE', headers }),
    ])

    for (const res of responses)
      await expectDisabledSyncResponse(res)
    expectNoPrivateSyncServiceCalls(characterService)
  })

  it('returns an HTTP disabled response for the old chat websocket route', async () => {
    const { deps, chatService } = createTestDeps()
    const { app } = await buildApp(deps)

    const res = await app.request(`/ws/chat?token=${TEST_AUTH_TOKEN}`, {
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
      },
    })

    await expectDisabledSyncResponse(res)
    expect(res.status).not.toBe(101)
    expectNoPrivateSyncServiceCalls(chatService)
  })
})

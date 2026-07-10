import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { triggerSignIn } from './auth'

const hoisted = vi.hoisted(() => ({
  events: [] as string[],
}))

vi.mock('better-auth/vue', () => ({
  createAuthClient: () => ({}),
}))

vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn(),
}))

vi.mock('./auth-config', () => ({
  OIDC_CLIENT_ID: 'stage-web-client',
  OIDC_REDIRECT_URI: 'https://airi.example/auth/callback',
}))

vi.mock('./auth-oidc', () => ({
  buildAuthorizationURL: vi.fn(async () => {
    hoisted.events.push('build')
    return {
      url: 'https://airi.example/api/auth/oauth2/authorize',
      flowState: {
        codeVerifier: 'code-verifier',
        state: 'oidc-state',
      },
    }
  }),
  persistFlowState: vi.fn(() => {
    hoisted.events.push('persist')
  }),
}))

vi.mock('./server', () => ({
  SERVER_URL: 'https://airi.example',
}))

describe('web OIDC sign-in', () => {
  beforeEach(() => {
    hoisted.events.length = 0
    vi.stubGlobal('window', {
      location: {
        get href() {
          return 'https://airi.example/'
        },
        set href(_value: string) {
          hoisted.events.push('navigate')
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports the persisted OIDC state before navigation', async () => {
    await triggerSignIn({
      onFlowState: (state) => {
        hoisted.events.push(`state:${state}`)
      },
    })

    expect(hoisted.events).toEqual([
      'build',
      'persist',
      'state:oidc-state',
      'navigate',
    ])
  })
})

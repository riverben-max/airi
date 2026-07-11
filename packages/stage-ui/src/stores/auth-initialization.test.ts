import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from './auth'

const mocks = vi.hoisted(() => ({
  fetchSession: vi.fn<() => Promise<void>>(),
  fluxGet: vi.fn(),
  isStageTamagotchi: vi.fn(() => false),
  refreshAccessToken: vi.fn(),
  triggerSignIn: vi.fn(),
}))

vi.mock('@proj-airi/stage-shared', () => ({
  isStageTamagotchi: mocks.isStageTamagotchi,
}))

vi.mock('../composables/api', () => ({
  client: {
    api: {
      v1: {
        flux: {
          $get: mocks.fluxGet,
        },
      },
    },
  },
}))

vi.mock('../composables/use-breakpoints', async () => {
  const { shallowRef } = await vi.importActual<typeof import('vue')>('vue')

  return {
    useBreakpoints: () => ({ isMobile: shallowRef(false) }),
  }
})

vi.mock('../libs/auth', () => ({
  fetchSession: mocks.fetchSession,
  triggerSignIn: mocks.triggerSignIn,
}))

vi.mock('../libs/auth-oidc', () => ({
  refreshAccessToken: mocks.refreshAccessToken,
}))

describe('auth initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('starts automatically and shares one initialization across all callers', async () => {
    let resolveFetchSession!: () => void
    mocks.fetchSession.mockImplementation(() => new Promise<void>((resolve) => {
      resolveFetchSession = resolve
    }))

    const store = useAuthStore()

    await vi.waitFor(() => {
      expect(mocks.fetchSession).toHaveBeenCalledTimes(1)
    })

    expect(store.initialize).toBeTypeOf('function')
    expect(store.initialized).toBe(false)

    const first = store.initialize()
    const second = store.initialize()
    const firstResolved = vi.fn()
    const secondResolved = vi.fn()
    void first.then(firstResolved)
    void second.then(secondResolved)

    await Promise.resolve()
    expect(firstResolved).not.toHaveBeenCalled()
    expect(secondResolved).not.toHaveBeenCalled()
    expect(store.initialized).toBe(false)

    resolveFetchSession()
    await Promise.all([first, second])

    expect(store.initialized).toBe(true)
    expect(mocks.fetchSession).toHaveBeenCalledTimes(1)

    await store.initialize()
    expect(mocks.fetchSession).toHaveBeenCalledTimes(1)
  })
})

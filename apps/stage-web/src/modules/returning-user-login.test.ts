import { describe, expect, it, vi } from 'vitest'

import {
  createReturningUserLoginGate,
  isAuthCallbackLocation,
  startReturningUserLoginIfNeeded,
} from './returning-user-login'

describe('returning user login lifecycle', () => {
  it('detects the callback from the browser location before the router is ready', () => {
    expect(isAuthCallbackLocation('/', '/auth/callback')).toBe(true)
    expect(isAuthCallbackLocation('/auth/callback', '/')).toBe(true)
    expect(isAuthCallbackLocation('/', '/settings')).toBe(false)
  })

  it('shares an in-flight check and reruns it only for a persisted page restore', async () => {
    let finishFirstCheck!: (loginStarted: boolean) => void
    const checkLogin = vi.fn<() => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => {
        finishFirstCheck = resolve
      }))
      .mockResolvedValue(false)
    const gate = createReturningUserLoginGate(checkLogin)

    const first = gate.check()
    const second = gate.check()

    expect(first).toBe(second)
    await vi.waitFor(() => expect(checkLogin).toHaveBeenCalledOnce())

    gate.handlePageShow({ persisted: true })
    await Promise.resolve()
    expect(checkLogin).toHaveBeenCalledOnce()

    finishFirstCheck(true)
    await Promise.all([first, second])

    gate.handlePageShow({ persisted: false })
    await Promise.resolve()
    expect(checkLogin).toHaveBeenCalledOnce()

    gate.handlePageShow({ persisted: true })
    await vi.waitFor(() => expect(checkLogin).toHaveBeenCalledTimes(2))
  })
})

describe('startReturningUserLoginIfNeeded', () => {
  it('keeps first-time users in onboarding without checking authentication', async () => {
    const initializeAuth = vi.fn(async () => undefined)
    const isAuthenticated = vi.fn(() => false)
    const requestLogin = vi.fn(async () => undefined)

    const loginStarted = await startReturningUserLoginIfNeeded({
      needsOnboarding: true,
      isAuthCallback: false,
      initializeAuth,
      isAuthenticated,
      requestLogin,
    })

    expect(loginStarted).toBe(false)
    expect(initializeAuth).not.toHaveBeenCalled()
    expect(isAuthenticated).not.toHaveBeenCalled()
    expect(requestLogin).not.toHaveBeenCalled()
  })

  it('bypasses authentication checks on the callback route', async () => {
    const initializeAuth = vi.fn(async () => undefined)
    const isAuthenticated = vi.fn(() => false)
    const requestLogin = vi.fn(async () => undefined)

    const loginStarted = await startReturningUserLoginIfNeeded({
      needsOnboarding: false,
      isAuthCallback: true,
      initializeAuth,
      isAuthenticated,
      requestLogin,
    })

    expect(loginStarted).toBe(false)
    expect(initializeAuth).not.toHaveBeenCalled()
    expect(isAuthenticated).not.toHaveBeenCalled()
    expect(requestLogin).not.toHaveBeenCalled()
  })

  it('waits for authentication initialization before accepting a valid session', async () => {
    const calls: string[] = []
    let finishInitialization!: () => void
    const initializeAuth = vi.fn(() => new Promise<void>((resolve) => {
      calls.push('initialize')
      finishInitialization = resolve
    }))
    const isAuthenticated = vi.fn(() => {
      calls.push('check')
      return true
    })
    const requestLogin = vi.fn(async () => undefined)

    const result = startReturningUserLoginIfNeeded({
      needsOnboarding: false,
      isAuthCallback: false,
      initializeAuth,
      isAuthenticated,
      requestLogin,
    })

    expect(calls).toEqual(['initialize'])
    expect(isAuthenticated).not.toHaveBeenCalled()

    finishInitialization()

    await expect(result).resolves.toBe(false)
    expect(calls).toEqual(['initialize', 'check'])
    expect(requestLogin).not.toHaveBeenCalled()
  })

  it('starts login for a returning user without a valid session', async () => {
    const calls: string[] = []
    const requestLogin = vi.fn(async () => {
      calls.push('login')
    })

    const loginStarted = await startReturningUserLoginIfNeeded({
      needsOnboarding: false,
      isAuthCallback: false,
      initializeAuth: async () => { calls.push('initialize') },
      isAuthenticated: () => {
        calls.push('check')
        return false
      },
      requestLogin,
    })

    expect(loginStarted).toBe(true)
    expect(calls).toEqual(['initialize', 'check', 'login'])
    expect(requestLogin).toHaveBeenCalledOnce()
  })

  it('reports an initialization failure once without starting login', async () => {
    const error = new Error('session unavailable')
    const isAuthenticated = vi.fn(() => false)
    const requestLogin = vi.fn(async () => undefined)
    const onError = vi.fn()

    const loginStarted = await startReturningUserLoginIfNeeded({
      needsOnboarding: false,
      isAuthCallback: false,
      initializeAuth: async () => {
        throw error
      },
      isAuthenticated,
      requestLogin,
      onError,
    })

    expect(loginStarted).toBe(false)
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(error)
    expect(isAuthenticated).not.toHaveBeenCalled()
    expect(requestLogin).not.toHaveBeenCalled()
  })

  it('reports a login failure once without retrying', async () => {
    const error = new Error('login unavailable')
    const requestLogin = vi.fn(async () => {
      throw error
    })
    const onError = vi.fn()

    const loginStarted = await startReturningUserLoginIfNeeded({
      needsOnboarding: false,
      isAuthCallback: false,
      initializeAuth: async () => undefined,
      isAuthenticated: () => false,
      requestLogin,
      onError,
    })

    expect(loginStarted).toBe(false)
    expect(requestLogin).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith(error)
  })
})

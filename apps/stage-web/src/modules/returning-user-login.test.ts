import { describe, expect, it, vi } from 'vitest'

import { startReturningUserLoginIfNeeded } from './returning-user-login'

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

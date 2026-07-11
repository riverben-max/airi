import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

describe('prepareAuthCallbackSession', () => {
  it('waits for auth initialization before exchanging and applying tokens', async () => {
    const { prepareAuthCallbackSession } = await import('./auth-callback-session')
    const calls: string[] = []
    let finishInitialization!: () => void
    const initializeAuth = vi.fn(() => new Promise<void>((resolve) => {
      calls.push('initialize')
      finishInitialization = resolve
    }))
    const tokens = { accessToken: 'access-token' }
    const exchangeTokens = vi.fn(async () => {
      calls.push('exchange')
      return tokens
    })
    const applyTokens = vi.fn(async () => {
      calls.push('apply')
    })

    const preparation = prepareAuthCallbackSession({
      initializeAuth,
      exchangeTokens,
      applyTokens,
    })

    expect(calls).toEqual(['initialize'])
    expect(exchangeTokens).not.toHaveBeenCalled()
    expect(applyTokens).not.toHaveBeenCalled()

    finishInitialization()
    await preparation

    expect(calls).toEqual(['initialize', 'exchange', 'apply'])
    expect(applyTokens).toHaveBeenCalledWith(tokens)
  })

  it('propagates initialization failures without exchanging or applying tokens', async () => {
    const { prepareAuthCallbackSession } = await import('./auth-callback-session')
    const failure = new Error('session restoration failed')
    const exchangeTokens = vi.fn(async () => ({ accessToken: 'access-token' }))
    const applyTokens = vi.fn(async () => undefined)

    await expect(prepareAuthCallbackSession({
      initializeAuth: async () => { throw failure },
      exchangeTokens,
      applyTokens,
    })).rejects.toBe(failure)

    expect(exchangeTokens).not.toHaveBeenCalled()
    expect(applyTokens).not.toHaveBeenCalled()
  })

  it('wires callback initialization before onboarding finalization', () => {
    const source = readFileSync(new URL('../pages/auth/callback.vue', import.meta.url), 'utf8')
    const preparationIndex = source.indexOf('await prepareAuthCallbackSession({')
    const onboardingFinalizationIndex = source.indexOf('await finalizeOnboardingLogin(')

    expect(preparationIndex).toBeGreaterThan(-1)
    expect(onboardingFinalizationIndex).toBeGreaterThan(preparationIndex)
    expect(source).toContain('initializeAuth: () => authStore.initialize(),')
    expect(source).toContain('exchangeTokens: () => exchangeCodeForTokens(')
    expect(source).toContain('applyTokens: tokens => applyOIDCTokens(')
  })
})

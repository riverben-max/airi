import { describe, expect, it, vi } from 'vitest'

import {
  clearOnboardingProgress,
  ONBOARDING_LOGIN_PENDING_KEY,
  ONBOARDING_STATE_KEY,
  startOnboardingLogin,
} from './onboarding-login'

describe('web onboarding login state', () => {
  it('clears saved multi-step onboarding progress', () => {
    const removeItem = vi.fn()

    clearOnboardingProgress({ removeItem })

    expect(removeItem).toHaveBeenCalledWith(ONBOARDING_STATE_KEY)
  })

  it('marks the onboarding login before requesting OIDC sign-in', async () => {
    const events: string[] = []
    const setItem = vi.fn(() => {
      events.push('pending')
    })
    const removeItem = vi.fn()
    const requestLogin = vi.fn(async () => {
      events.push('login')
    })

    await startOnboardingLogin(requestLogin, { setItem, removeItem })

    expect(setItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY, 'true')
    expect(events).toEqual(['pending', 'login'])
    expect(removeItem).not.toHaveBeenCalled()
  })

  it('clears the pending marker when login cannot start', async () => {
    const failure = new Error('OIDC navigation failed')
    const setItem = vi.fn()
    const removeItem = vi.fn()

    await expect(startOnboardingLogin(
      async () => { throw failure },
      { setItem, removeItem },
    )).rejects.toBe(failure)

    expect(removeItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
  })
})

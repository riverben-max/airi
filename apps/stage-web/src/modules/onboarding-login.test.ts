import { describe, expect, it, vi } from 'vitest'

import {
  clearOnboardingProgress,
  consumeOnboardingLogin,
  finalizeOnboardingLogin,
  isOnboardingLoginPending,
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

  it('does not throw when saved onboarding progress cannot be cleared', () => {
    const removeItem = vi.fn(() => {
      throw new Error('local storage unavailable')
    })

    expect(() => clearOnboardingProgress({ removeItem })).not.toThrow()
  })

  it('stores the OIDC state supplied before sign-in navigation', async () => {
    const events: string[] = []
    const setItem = vi.fn(() => {
      events.push('pending')
    })
    const removeItem = vi.fn()
    const requestLogin = vi.fn(async (onFlowState: (state: string) => void) => {
      events.push('login')
      onFlowState('oidc-state')
    })

    await startOnboardingLogin(requestLogin, { setItem, removeItem })

    expect(setItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY, 'oidc-state')
    expect(events).toEqual(['login', 'pending'])
    expect(removeItem).not.toHaveBeenCalled()
  })

  it('keeps the original login error when pending cleanup also fails', async () => {
    const failure = new Error('OIDC navigation failed')
    const setItem = vi.fn()
    const removeItem = vi.fn(() => {
      throw new Error('session storage unavailable')
    })

    await expect(startOnboardingLogin(
      async () => { throw failure },
      { setItem, removeItem },
    )).rejects.toBe(failure)

    expect(removeItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
  })

  it('completes onboarding after a pending login creates a session', async () => {
    const fetchSession = vi.fn(async () => true)
    const markCompleted = vi.fn()
    const getItem = vi.fn(() => 'oidc-state')
    const pendingRemoveItem = vi.fn()
    const progressRemoveItem = vi.fn()

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(true)

    expect(markCompleted).toHaveBeenCalledOnce()
    expect(progressRemoveItem).toHaveBeenCalledWith(ONBOARDING_STATE_KEY)
    expect(pendingRemoveItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
  })

  it('does not complete onboarding when the callback has no session', async () => {
    const fetchSession = vi.fn(async () => false)
    const markCompleted = vi.fn()
    const getItem = vi.fn(() => 'oidc-state')
    const pendingRemoveItem = vi.fn()
    const progressRemoveItem = vi.fn()

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(false)

    expect(markCompleted).not.toHaveBeenCalled()
    expect(pendingRemoveItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
    expect(progressRemoveItem).not.toHaveBeenCalled()
  })

  it('does not complete onboarding for a regular login callback', async () => {
    const fetchSession = vi.fn(async () => true)
    const markCompleted = vi.fn()
    const getItem = vi.fn(() => null)
    const pendingRemoveItem = vi.fn()
    const progressRemoveItem = vi.fn()

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(false)

    expect(markCompleted).not.toHaveBeenCalled()
    expect(pendingRemoveItem).not.toHaveBeenCalled()
    expect(progressRemoveItem).not.toHaveBeenCalled()
  })

  it('does not complete onboarding when the callback state does not match', async () => {
    const fetchSession = vi.fn(async () => true)
    const markCompleted = vi.fn()
    const getItem = vi.fn(() => 'other-state')
    const pendingRemoveItem = vi.fn()
    const progressRemoveItem = vi.fn()

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(false)

    expect(markCompleted).not.toHaveBeenCalled()
    expect(pendingRemoveItem).not.toHaveBeenCalled()
    expect(progressRemoveItem).not.toHaveBeenCalled()
  })

  it('does not complete onboarding when pending state cannot be read', async () => {
    const fetchSession = vi.fn(async () => true)
    const markCompleted = vi.fn()
    const getItem = vi.fn(() => {
      throw new Error('session storage unavailable')
    })
    const pendingRemoveItem = vi.fn()
    const progressRemoveItem = vi.fn()

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(false)

    expect(markCompleted).not.toHaveBeenCalled()
    expect(pendingRemoveItem).not.toHaveBeenCalled()
    expect(progressRemoveItem).not.toHaveBeenCalled()
  })

  it('keeps a verified onboarding login successful when cleanup fails', async () => {
    const fetchSession = vi.fn(async () => true)
    const markCompleted = vi.fn()
    const getItem = vi.fn(() => 'oidc-state')
    const pendingRemoveItem = vi.fn(() => {
      throw new Error('session storage unavailable')
    })
    const progressRemoveItem = vi.fn(() => {
      throw new Error('local storage unavailable')
    })

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(true)

    expect(markCompleted).toHaveBeenCalledOnce()
  })

  it('keeps a verified onboarding login successful when completion persistence fails', async () => {
    const fetchSession = vi.fn(async () => true)
    const markCompleted = vi.fn(() => {
      throw new Error('onboarding persistence unavailable')
    })
    const getItem = vi.fn(() => 'oidc-state')
    const pendingRemoveItem = vi.fn()
    const progressRemoveItem = vi.fn()

    await expect(finalizeOnboardingLogin(
      'oidc-state',
      fetchSession,
      markCompleted,
      { getItem, removeItem: pendingRemoveItem },
      { removeItem: progressRemoveItem },
    )).resolves.toBe(true)

    expect(progressRemoveItem).toHaveBeenCalledWith(ONBOARDING_STATE_KEY)
    expect(pendingRemoveItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
  })

  it('recognizes and consumes matching onboarding callback state best-effort', () => {
    const getItem = vi.fn(() => 'oidc-state')
    const removeItem = vi.fn(() => {
      throw new Error('session storage unavailable')
    })

    expect(consumeOnboardingLogin('oidc-state', { getItem, removeItem })).toBe(true)
    expect(removeItem).toHaveBeenCalledWith(ONBOARDING_LOGIN_PENDING_KEY)
  })

  it('treats unreadable pending state as a regular callback', () => {
    const getItem = vi.fn(() => {
      throw new Error('session storage unavailable')
    })
    const removeItem = vi.fn()

    expect(isOnboardingLoginPending('oidc-state', { getItem, removeItem })).toBe(false)
    expect(removeItem).not.toHaveBeenCalled()
  })
})

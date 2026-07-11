import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { startCharacterFirstInitialization } from './app-startup'

describe('startCharacterFirstInitialization', () => {
  it('finishes character steps before starting optional services', async () => {
    const calls: string[] = []
    const { characterReady, optionalReady } = startCharacterFirstInitialization({
      characterSteps: [
        { name: 'models', run: async () => { calls.push('models') } },
        { name: 'stage', run: async () => { calls.push('stage') } },
      ],
      optionalSteps: [
        { name: 'chat', run: async () => { calls.push('chat') } },
      ],
      onError: vi.fn(),
    })

    await characterReady
    await optionalReady

    expect(calls).toEqual(['models', 'stage', 'chat'])
  })

  it('isolates optional failures and continues later optional steps', async () => {
    const onError = vi.fn()
    const laterStep = vi.fn(async () => undefined)
    const { optionalReady } = startCharacterFirstInitialization({
      characterSteps: [],
      optionalSteps: [
        { name: 'server', run: async () => { throw new Error('offline') } },
        { name: 'context', run: laterStep },
      ],
      onError,
    })

    await optionalReady

    expect(laterStep).toHaveBeenCalledOnce()
    expect(onError).toHaveBeenCalledWith('server', expect.any(Error))
  })

  it('continues character setup and optional services after a character storage failure', async () => {
    const calls: string[] = []
    const onError = vi.fn()
    const { characterReady, optionalReady } = startCharacterFirstInitialization({
      characterSteps: [
        { name: 'models', run: async () => { throw new Error('indexeddb unavailable') } },
        { name: 'stage', run: async () => { calls.push('stage') } },
      ],
      optionalSteps: [
        { name: 'chat', run: async () => { calls.push('chat') } },
      ],
      onError,
    })

    await characterReady
    await optionalReady

    expect(calls).toEqual(['stage', 'chat'])
    expect(onError).toHaveBeenCalledWith('models', expect.any(Error))
  })

  it('keeps the App wiring character-first', () => {
    const source = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
    const characterIndex = source.indexOf('name: \'display models\'')
    const optionalIndex = source.indexOf('name: \'chat session\'')

    expect(source).toContain('startCharacterFirstInitialization({')
    expect(characterIndex).toBeGreaterThan(-1)
    expect(optionalIndex).toBeGreaterThan(characterIndex)
  })

  it('checks returning-user authentication before starting Stage services', () => {
    const source = readFileSync(new URL('../App.vue', import.meta.url), 'utf8')
    const pageShowListenerIndex = source.indexOf('window.addEventListener(\'pageshow\', handlePageShow)')
    const authDecisionIndex = source.indexOf('const loginStarted = await returningUserLoginGate.check()')
    const earlyReturnIndex = source.indexOf('if (loginStarted)')
    const characterInitializationIndex = source.indexOf('const { characterReady, optionalReady } = startCharacterFirstInitialization')

    expect(pageShowListenerIndex).toBeGreaterThan(-1)
    expect(authDecisionIndex).toBeGreaterThan(pageShowListenerIndex)
    expect(authDecisionIndex).toBeGreaterThan(-1)
    expect(earlyReturnIndex).toBeGreaterThan(authDecisionIndex)
    expect(characterInitializationIndex).toBeGreaterThan(earlyReturnIndex)
    expect(source).toContain('needsOnboarding: onboardingStore.needsOnboarding')
    expect(source).toContain('isAuthCallback: isAuthCallbackLocation(route.path, window.location.pathname)')
    expect(source).toContain('window.removeEventListener(\'pageshow\', handlePageShow)')
  })
})

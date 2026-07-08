import { describe, expect, it } from 'vitest'

import { stageWebNavigateFallbackDenylist } from './pwa-navigation'

function isDeniedNavigation(path: string): boolean {
  return stageWebNavigateFallbackDenylist.some(pattern => pattern.test(path))
}

describe('stage-web PWA navigation fallback denylist', () => {
  it('lets server-owned auth entry routes reach the network while keeping the OIDC callback in the SPA', () => {
    expect(isDeniedNavigation('/auth/sign-in')).toBe(true)
    expect(isDeniedNavigation('/auth/reset-password')).toBe(true)
    expect(isDeniedNavigation('/auth/delete-account')).toBe(true)

    expect(isDeniedNavigation('/auth/callback')).toBe(false)
    expect(isDeniedNavigation('/auth/callback?code=abc')).toBe(false)
  })
})

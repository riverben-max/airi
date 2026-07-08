import { describe, expect, it } from 'vitest'

import { buildAuthUiSignInRedirectUrl } from './auth-entry-redirect'

describe('buildAuthUiSignInRedirectUrl', () => {
  it('moves legacy auth sign-in entry URLs to the standalone auth UI', () => {
    const redirectUrl = buildAuthUiSignInRedirectUrl(
      new URL('https://airi.aifamily.vip/auth/sign-in?response_type=code&client_id=airi-stage-web&redirect_uri=https%3A%2F%2Fairi.aifamily.vip%2Fauth%2Fcallback#top'),
      'https://airi.aifamily.vip',
    )

    expect(redirectUrl.href).toBe('https://airi.aifamily.vip/ui/sign-in?response_type=code&client_id=airi-stage-web&redirect_uri=https%3A%2F%2Fairi.aifamily.vip%2Fauth%2Fcallback&api_server_url=https%3A%2F%2Fairi.aifamily.vip#top')
  })

  it('keeps an explicit api server URL when the server already supplied one', () => {
    const redirectUrl = buildAuthUiSignInRedirectUrl(
      new URL('https://airi.aifamily.vip/auth/sign-in?api_server_url=https%3A%2F%2Fapi.example.test&x=1'),
      'https://airi.aifamily.vip',
    )

    expect(redirectUrl.searchParams.get('api_server_url')).toBe('https://api.example.test')
    expect(redirectUrl.searchParams.get('x')).toBe('1')
  })
})

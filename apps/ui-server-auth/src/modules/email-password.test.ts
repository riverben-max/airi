import { describe, expect, it, vi } from 'vitest'

import { signUpWithEmail } from './email-password'

describe('email/password auth helpers', () => {
  it('relies on the server sign-up flow to send the verification email', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      const url = String(input)

      if (url.endsWith('/api/auth/sign-up/email')) {
        return new Response(JSON.stringify({
          token: null,
          user: { id: 'user-1', email: 'alice@example.test' },
        }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ message: `Unexpected URL: ${url}` }), { status: 500 })
    })

    await expect(signUpWithEmail({
      apiServerUrl: 'https://api.airi.test',
      email: 'alice@example.test',
      password: 'correct horse battery staple',
      name: 'Alice',
      callbackURL: 'https://accounts.airi.test/ui/verify-email?verified=true',
      fetchImpl,
    })).resolves.toEqual({ requiresVerification: true })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.airi.test/api/auth/sign-up/email')
  })
})

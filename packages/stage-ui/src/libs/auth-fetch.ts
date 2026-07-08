import { useAuthStore } from '../stores/auth'
import { getAuthToken } from './auth'

export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = (token: string | null): Promise<Response> => {
    const headers = new Headers(init?.headers)
    if (token)
      headers.set('Authorization', `Bearer ${token}`)
    return fetch(input, { ...init, headers, credentials: 'omit' })
  }

  const response = await doFetch(getAuthToken())
  if (response.status !== 401)
    return response

  const url = typeof input === 'string'
    ? input
    : input instanceof URL ? input.toString() : input.url
  if (url.includes('/oauth2/token'))
    return response

  const authStore = useAuthStore()
  const newToken = await authStore.refreshTokenNow()
  if (!newToken) {
    promptReLogin(authStore)
    return response
  }

  const retried = await doFetch(newToken)
  if (retried.status === 401)
    promptReLogin(authStore)
  return retried
}

function promptReLogin(authStore: ReturnType<typeof useAuthStore>): void {
  authStore.clearAllAuthState()
  authStore.needsLogin = true
}

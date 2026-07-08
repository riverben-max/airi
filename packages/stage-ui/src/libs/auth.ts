import type { OIDCFlowParams, TokenResponse } from './auth-oidc'

import { createAuthClient } from 'better-auth/vue'

import { useAuthStore } from '../stores/auth'
import { OIDC_CLIENT_ID, OIDC_REDIRECT_URI } from './auth-config'
import { buildAuthorizationURL, persistFlowState } from './auth-oidc'
import { SERVER_URL } from './server'

export { SERVER_URL } from './server'

export type OAuthProvider = 'google' | 'github'

export const REMOTE_SYNC_STORAGE_KEY = 'settings/privacy/remote-sync-enabled'

export function isRemoteSyncEnabled() {
  if (typeof localStorage === 'undefined')
    return false

  return localStorage.getItem(REMOTE_SYNC_STORAGE_KEY) === 'true'
}

export function getAuthToken(): string | null {
  if (typeof localStorage === 'undefined')
    return null

  return localStorage.getItem('auth/v1/token')
}

export const authClient = createAuthClient({
  baseURL: SERVER_URL,
  fetchOptions: {
    credentials: 'omit',
    auth: {
      type: 'Bearer',
      token: () => getAuthToken() ?? '',
    },
  },
})

let initialized = false

export async function initializeAuth() {
  if (initialized)
    return

  initialized = true

  const authStore = useAuthStore()

  const hasRefreshToken = !!authStore.refreshToken
  const hasClientId = !!authStore.oidcClientId
  if (hasRefreshToken !== hasClientId)
    authStore.clearAllAuthState()

  authStore.onTokenRefreshed(async (accessToken) => {
    authStore.token = accessToken
    await fetchSession()
  })

  await authStore.restoreRefreshSchedule()
  await fetchSession().catch(() => {})
}

/**
 * Persist OIDC tokens locally and schedule refresh.
 */
export async function applyOIDCTokens(tokens: TokenResponse, clientId: string): Promise<void> {
  const authStore = useAuthStore()
  authStore.token = tokens.access_token
  if (tokens.refresh_token)
    authStore.refreshToken = tokens.refresh_token
  if (tokens.id_token)
    authStore.idToken = tokens.id_token

  authStore.oidcClientId = clientId
  if (tokens.expires_in)
    authStore.tokenExpiry = Date.now() + tokens.expires_in * 1000

  authStore.scheduleTokenRefresh(tokens.expires_in)
}

export async function fetchSession() {
  const { data } = await authClient.getSession()
  const authStore = useAuthStore()

  if (data) {
    authStore.user = data.user
    authStore.session = data.session
    return true
  }

  authStore.clearAllAuthState()
  return false
}

export async function listSessions() {
  return await authClient.listSessions()
}

export async function signOut() {
  const authStore = useAuthStore()

  const idTokenHint = authStore.idToken
  const clientId = authStore.oidcClientId
  const bearerToken = authStore.token

  try {
    if (idTokenHint && clientId) {
      const url = new URL('/api/auth/oauth2/end-session', SERVER_URL)
      url.searchParams.set('id_token_hint', idTokenHint)
      url.searchParams.set('client_id', clientId)
      await fetch(url.toString(), { method: 'GET' })
    }
    else if (bearerToken) {
      const url = new URL('/api/auth/sign-out', SERVER_URL)
      await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearerToken}` },
      })
    }
  }
  catch {
    // Network failure: still clear local state below.
  }

  authStore.clearAllAuthState()
}

/**
 * Initiate OIDC Authorization Code + PKCE sign-in flow.
 */
export async function signInOIDC(params: OIDCFlowParams) {
  const { provider, ...oidcParams } = params
  const { url, flowState } = await buildAuthorizationURL(oidcParams)
  persistFlowState(flowState, params)

  if (!provider) {
    window.location.href = url
    return
  }

  await authClient.signIn.social({
    provider,
    callbackURL: url.toString(),
  })
}

export async function triggerSignIn(opts?: { provider?: OAuthProvider }): Promise<void> {
  await signInOIDC({
    clientId: OIDC_CLIENT_ID,
    redirectUri: OIDC_REDIRECT_URI,
    ...opts,
  })
}

export async function signIn(provider: OAuthProvider): Promise<void> {
  await triggerSignIn({ provider })
}

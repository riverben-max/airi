import { generateCodeChallenge, generateCodeVerifier, generateState } from '@proj-airi/stage-shared/auth'

import { SERVER_URL } from './server'

const OIDC_AUTHORIZE_PATH = '/api/auth/oauth2/authorize'
const OIDC_TOKEN_PATH = '/api/auth/oauth2/token'

export interface OIDCFlowParams {
  clientId: string
  redirectUri: string
  scopes?: string[]
  clientSecret?: string
  provider?: 'google' | 'github'
}

export interface OIDCFlowState {
  codeVerifier: string
  state: string
}

export async function buildAuthorizationURL(
  params: OIDCFlowParams,
): Promise<{ url: string, flowState: OIDCFlowState }> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  const state = generateState()

  const scopes = params.scopes ?? ['openid', 'profile', 'email', 'offline_access']

  const url = new URL(OIDC_AUTHORIZE_PATH, SERVER_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('scope', scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('resource', SERVER_URL)

  if (params.provider)
    url.searchParams.set('provider', params.provider)

  return {
    url: url.toString(),
    flowState: { codeVerifier, state },
  }
}

export interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  id_token?: string
  scope?: string
}

export async function exchangeCodeForTokens(
  code: string,
  flowState: OIDCFlowState,
  params: OIDCFlowParams,
  returnedState: string,
): Promise<TokenResponse> {
  if (returnedState !== flowState.state)
    throw new Error('OIDC state mismatch — possible CSRF attack')

  const bodyParams: Record<string, string> = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: flowState.codeVerifier,
    resource: SERVER_URL,
  }

  if (params.clientSecret)
    bodyParams.client_secret = params.clientSecret

  const body = new URLSearchParams(bodyParams)

  const response = await fetch(new URL(OIDC_TOKEN_PATH, SERVER_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${response.status} ${error}`)
  }

  return await response.json()
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
  clientSecret?: string,
): Promise<TokenResponse> {
  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    resource: SERVER_URL,
  }

  if (clientSecret)
    params.client_secret = clientSecret

  const body = new URLSearchParams(params)

  const response = await fetch(new URL(OIDC_TOKEN_PATH, SERVER_URL), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok)
    throw new Error(`Token refresh failed: ${response.status}`)

  return await response.json()
}

const FLOW_STATE_KEY = 'auth/v1/oidc-flow-state'
const FLOW_PARAMS_KEY = 'auth/v1/oidc-flow-params'

export function persistFlowState(flowState: OIDCFlowState, params: OIDCFlowParams): void {
  sessionStorage.setItem(FLOW_STATE_KEY, JSON.stringify(flowState))
  sessionStorage.setItem(FLOW_PARAMS_KEY, JSON.stringify(params))
}

export function consumeFlowState(): { flowState: OIDCFlowState, params: OIDCFlowParams } | null {
  const flowStateRaw = sessionStorage.getItem(FLOW_STATE_KEY)
  const paramsRaw = sessionStorage.getItem(FLOW_PARAMS_KEY)

  if (!flowStateRaw || !paramsRaw)
    return null

  sessionStorage.removeItem(FLOW_STATE_KEY)
  sessionStorage.removeItem(FLOW_PARAMS_KEY)

  return {
    flowState: JSON.parse(flowStateRaw),
    params: JSON.parse(paramsRaw),
  }
}

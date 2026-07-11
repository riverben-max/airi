import type { Session, User } from 'better-auth'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { StorageSerializers, useLocalStorage, useTimeoutFn, whenever } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { client } from '../composables/api'
import { useBreakpoints } from '../composables/use-breakpoints'
import { fetchSession, triggerSignIn } from '../libs/auth'
import { refreshAccessToken } from '../libs/auth-oidc'

interface RequestLoginOptions {
  onFlowState?: (state: string) => void
}

export const useAuthStore = defineStore('auth', () => {
  const user = useLocalStorage<User | null>('auth/v1/user', null, {
    serializer: StorageSerializers.object,
  })
  const session = useLocalStorage<Session | null>('auth/v1/session', null, { serializer: StorageSerializers.object })
  const token = useLocalStorage<string | null>('auth/v1/token', null)
  const refreshToken = useLocalStorage<string | null>('auth/v1/refresh-token', null)
  const idToken = useLocalStorage<string | null>('auth/v1/oidc-id-token', null)
  const isAuthenticated = computed(() => !!user.value && !!session.value)
  const userId = computed(() => user.value?.id ?? 'local')

  const oidcClientId = useLocalStorage<string | null>('auth/v1/oidc-client-id', null)
  const tokenExpiry = useLocalStorage<number | null>('auth/v1/oidc-token-expiry', null)

  const credits = useLocalStorage<number>('user/v1/flux', 0)

  const isLoginDrawerOpen = ref(false)
  const needsLogin = ref(false)
  const { isMobile } = useBreakpoints()

  async function requestLogin(options?: RequestLoginOptions): Promise<void> {
    if (isStageTamagotchi()) {
      needsLogin.value = true
      return
    }

    needsLogin.value = false
    await triggerSignIn(options)
  }

  whenever(needsLogin, async () => {
    await requestLogin()
  })

  watch(isMobile, () => needsLogin.value = false)

  type AuthHook = () => void | Promise<void>
  const authenticatedHooks: AuthHook[] = []
  const logoutHooks: AuthHook[] = []

  function onAuthenticated(hook: AuthHook) {
    authenticatedHooks.push(hook)
    if (isAuthenticated.value)
      hook()
    return () => {
      const idx = authenticatedHooks.indexOf(hook)
      if (idx >= 0)
        authenticatedHooks.splice(idx, 1)
    }
  }

  function onLogout(hook: AuthHook) {
    logoutHooks.push(hook)
    return () => {
      const idx = logoutHooks.indexOf(hook)
      if (idx >= 0)
        logoutHooks.splice(idx, 1)
    }
  }

  watch(isAuthenticated, async (val, oldVal) => {
    if (val && !oldVal) {
      for (const hook of authenticatedHooks) {
        try {
          await hook()
        }
        catch (e) {
          console.error('auth hook error', e)
        }
      }
    }
    if (!val && oldVal) {
      for (const hook of logoutHooks) {
        try {
          await hook()
        }
        catch (e) {
          console.error('logout hook error', e)
        }
      }
    }
  })

  const refreshDelayMs = ref(0)
  type TokenRefreshedHook = (accessToken: string) => void | Promise<void>
  const tokenRefreshedHooks: TokenRefreshedHook[] = []
  let inflightRefresh: Promise<string | null> | null = null

  async function refreshTokenNow(): Promise<string | null> {
    if (inflightRefresh)
      return inflightRefresh

    if (!refreshToken.value || !oidcClientId.value)
      return null

    inflightRefresh = (async () => {
      try {
        const tokens = await refreshAccessToken(oidcClientId.value!, refreshToken.value!)
        token.value = tokens.access_token
        if (tokens.refresh_token)
          refreshToken.value = tokens.refresh_token
        if (tokens.expires_in) {
          tokenExpiry.value = Date.now() + tokens.expires_in * 1000
          scheduleTokenRefresh(tokens.expires_in)
        }

        for (const hook of tokenRefreshedHooks) {
          try {
            await hook(tokens.access_token)
          }
          catch (e) {
            console.error('token refresh hook error', e)
          }
        }

        return tokens.access_token
      }
      catch {
        clearAllAuthState()
        return null
      }
      finally {
        inflightRefresh = null
      }
    })()

    return inflightRefresh
  }

  const { start: startRefreshTimer, stop: stopRefreshTimer } = useTimeoutFn(
    () => { refreshTokenNow() },
    refreshDelayMs,
    { immediate: false },
  )

  function scheduleTokenRefresh(expiresInSeconds: number): void {
    stopRefreshTimer()
    if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0)
      return
    refreshDelayMs.value = expiresInSeconds * 0.8 * 1000
    startRefreshTimer()
  }

  async function restoreRefreshSchedule(): Promise<void> {
    if (!refreshToken.value || !oidcClientId.value)
      return

    if (tokenExpiry.value) {
      const remainingMs = tokenExpiry.value - Date.now()
      if (remainingMs > 0) {
        scheduleTokenRefresh(remainingMs / 1000)
        return
      }
    }

    await refreshTokenNow()
  }

  function onTokenRefreshed(hook: TokenRefreshedHook) {
    tokenRefreshedHooks.push(hook)
    return () => {
      const idx = tokenRefreshedHooks.indexOf(hook)
      if (idx >= 0)
        tokenRefreshedHooks.splice(idx, 1)
    }
  }

  function clearAllAuthState(): void {
    stopRefreshTimer()
    user.value = null
    session.value = null
    token.value = null
    refreshToken.value = null
    oidcClientId.value = null
    tokenExpiry.value = null
    idToken.value = null
    isLoginDrawerOpen.value = false
    needsLogin.value = false
  }

  const updateCredits = async () => {
    if (!isAuthenticated.value)
      return
    const res = await client.api.v1.flux.$get()
    if (res.ok) {
      const data = await res.json()
      credits.value = data.flux
    }
  }

  const initialized = ref(false)
  let initializationPromise: Promise<void> | null = null
  function initialize(): Promise<void> {
    if (initializationPromise)
      return initializationPromise

    initializationPromise = (async () => {
      try {
        const hasRefreshToken = !!refreshToken.value
        const hasClientId = !!oidcClientId.value
        if (hasRefreshToken !== hasClientId)
          clearAllAuthState()

        onTokenRefreshed(async (accessToken) => {
          token.value = accessToken
          await fetchSession()
        })

        await restoreRefreshSchedule()
        await fetchSession().catch(() => {})
      }
      finally {
        initialized.value = true
      }
    })()

    return initializationPromise
  }

  void initialize()

  watch(isAuthenticated, async (val) => {
    if (val) {
      updateCredits()

      needsLogin.value = false
    }
    else {
      credits.value = 0
    }
  }, { immediate: true })

  return {
    user,
    userId,
    session,
    token,
    refreshToken,
    idToken,
    isAuthenticated,
    credits,
    updateCredits,
    needsLogin,
    requestLogin,
    isLoginDrawerOpen,
    onAuthenticated,
    onLogout,
    oidcClientId,
    tokenExpiry,
    scheduleTokenRefresh,
    restoreRefreshSchedule,
    refreshTokenNow,
    clearAllAuthState,
    onTokenRefreshed,
    initialize,
    initialized,
  }
})

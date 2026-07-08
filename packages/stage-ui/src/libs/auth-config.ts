const FALLBACK = 'http://localhost'

function getEnvStatus() {
  if (typeof window === 'undefined')
    return { isAndroidNative: false, isNative: false }

  // @ts-expect-error Capacitor is injected by the native runtime when available.
  const capacitor = window.Capacitor
  const isAndroidNative = !!(capacitor?.getPlatform?.() === 'android')
  const isNative = !!capacitor || isAndroidNative

  return { isAndroidNative, isNative }
}

function getRedirectOrigin() {
  if (import.meta.env.VITE_OIDC_REDIRECT_URI)
    return import.meta.env.VITE_OIDC_REDIRECT_URI

  const { isAndroidNative } = getEnvStatus()

  if (isAndroidNative)
    return 'ai.moeru.airi-pocket://links'

  if (typeof window !== 'undefined')
    return window.location?.origin ?? FALLBACK

  return FALLBACK
}

const { isNative } = getEnvStatus()
const origin = getRedirectOrigin()

export const OIDC_CLIENT_ID = import.meta.env.VITE_OIDC_CLIENT_ID
  || (isNative ? 'airi-stage-pocket' : 'airi-stage-web')

export const OIDC_REDIRECT_URI = `${origin}/auth/callback`

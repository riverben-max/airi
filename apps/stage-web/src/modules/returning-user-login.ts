export interface ReturningUserLoginOptions {
  needsOnboarding: boolean
  isAuthCallback: boolean
  initializeAuth: () => Promise<void>
  isAuthenticated: () => boolean
  requestLogin: () => Promise<void>
  onError?: (error: unknown) => void
}

export interface ReturningUserLoginGate {
  check: () => Promise<boolean>
  handlePageShow: (event: Pick<PageTransitionEvent, 'persisted'>) => void
}

export function isAuthCallbackLocation(routePath: string, browserPathname: string): boolean {
  return routePath === '/auth/callback' || browserPathname === '/auth/callback'
}

export function createReturningUserLoginGate(checkLogin: () => Promise<boolean>): ReturningUserLoginGate {
  let inFlight: Promise<boolean> | null = null

  function check(): Promise<boolean> {
    if (inFlight)
      return inFlight

    inFlight = Promise.resolve()
      .then(checkLogin)
      .finally(() => {
        inFlight = null
      })

    return inFlight
  }

  function handlePageShow(event: Pick<PageTransitionEvent, 'persisted'>): void {
    if (!event.persisted)
      return

    void check().catch(() => {})
  }

  return { check, handlePageShow }
}

export async function startReturningUserLoginIfNeeded(options: ReturningUserLoginOptions): Promise<boolean> {
  if (options.needsOnboarding || options.isAuthCallback)
    return false

  try {
    await options.initializeAuth()
    if (options.isAuthenticated())
      return false

    await options.requestLogin()
    return true
  }
  catch (error) {
    options.onError?.(error)
    return false
  }
}

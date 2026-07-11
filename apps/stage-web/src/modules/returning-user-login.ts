export interface ReturningUserLoginOptions {
  needsOnboarding: boolean
  isAuthCallback: boolean
  initializeAuth: () => Promise<void>
  isAuthenticated: () => boolean
  requestLogin: () => Promise<void>
  onError?: (error: unknown) => void
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

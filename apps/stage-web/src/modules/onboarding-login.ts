type StorageRemover = Pick<Storage, 'removeItem'>
type PendingStorageWriter = Pick<Storage, 'removeItem' | 'setItem'>

export const ONBOARDING_LOGIN_PENDING_KEY = 'onboarding/web-login-pending'
export const ONBOARDING_STATE_KEY = 'airi-onboarding-state'

export function clearOnboardingProgress(storage: StorageRemover = localStorage): void {
  storage.removeItem(ONBOARDING_STATE_KEY)
}

export async function startOnboardingLogin(
  requestLogin: () => Promise<void>,
  storage: PendingStorageWriter = sessionStorage,
): Promise<void> {
  storage.setItem(ONBOARDING_LOGIN_PENDING_KEY, 'true')

  try {
    await requestLogin()
  }
  catch (error) {
    storage.removeItem(ONBOARDING_LOGIN_PENDING_KEY)
    throw error
  }
}

type StorageRemover = Pick<Storage, 'removeItem'>
type PendingStorageReader = Pick<Storage, 'getItem' | 'removeItem'>
type PendingStorageWriter = Pick<Storage, 'removeItem' | 'setItem'>

export const ONBOARDING_LOGIN_PENDING_KEY = 'onboarding/web-login-pending'
export const ONBOARDING_STATE_KEY = 'airi-onboarding-state'

function getLocalStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  }
  catch {
    return undefined
  }
}

function getSessionStorage(): Storage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  }
  catch {
    return undefined
  }
}

function readStorageItem(storage: Pick<Storage, 'getItem'> | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  }
  catch {
    return null
  }
}

function writeStorageItem(storage: Pick<Storage, 'setItem'> | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  }
  catch {
  }
}

function removeStorageItem(storage: StorageRemover | undefined, key: string): void {
  try {
    storage?.removeItem(key)
  }
  catch {
  }
}

export function clearOnboardingProgress(storage?: StorageRemover): void {
  removeStorageItem(storage ?? getLocalStorage(), ONBOARDING_STATE_KEY)
}

export async function startOnboardingLogin(
  requestLogin: (onFlowState: (state: string) => void) => Promise<void>,
  storage?: PendingStorageWriter,
): Promise<void> {
  const pendingStorage = storage ?? getSessionStorage()

  try {
    await requestLogin((state) => {
      writeStorageItem(pendingStorage, ONBOARDING_LOGIN_PENDING_KEY, state)
    })
  }
  catch (error) {
    removeStorageItem(pendingStorage, ONBOARDING_LOGIN_PENDING_KEY)
    throw error
  }
}

export function isOnboardingLoginPending(
  expectedState: string | null,
  storage?: PendingStorageReader,
): boolean {
  if (!expectedState)
    return false

  const pendingStorage = storage ?? getSessionStorage()
  return readStorageItem(pendingStorage, ONBOARDING_LOGIN_PENDING_KEY) === expectedState
}

export function consumeOnboardingLogin(
  expectedState: string | null,
  storage?: PendingStorageReader,
): boolean {
  const pendingStorage = storage ?? getSessionStorage()
  if (!isOnboardingLoginPending(expectedState, pendingStorage))
    return false

  removeStorageItem(pendingStorage, ONBOARDING_LOGIN_PENDING_KEY)
  return true
}

export async function finalizeOnboardingLogin(
  expectedState: string,
  fetchSession: () => Promise<boolean>,
  markCompleted: () => void,
  pendingStorage?: PendingStorageReader,
  progressStorage?: StorageRemover,
): Promise<boolean> {
  const isOnboardingLogin = consumeOnboardingLogin(expectedState, pendingStorage)
  const hasSession = await fetchSession()
  if (!hasSession || !isOnboardingLogin)
    return false

  try {
    markCompleted()
  }
  catch {
  }

  clearOnboardingProgress(progressStorage)
  return true
}

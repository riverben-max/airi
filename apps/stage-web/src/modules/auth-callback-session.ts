export interface PrepareAuthCallbackSessionOptions<T> {
  initializeAuth: () => Promise<void>
  exchangeTokens: () => Promise<T>
  applyTokens: (tokens: T) => Promise<void>
}

export async function prepareAuthCallbackSession<T>(options: PrepareAuthCallbackSessionOptions<T>): Promise<void> {
  await options.initializeAuth()
  const tokens = await options.exchangeTokens()
  await options.applyTokens(tokens)
}

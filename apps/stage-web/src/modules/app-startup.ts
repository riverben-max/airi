export interface StartupStep {
  name: string
  run: () => Promise<void> | void
}

export interface CharacterFirstInitializationOptions {
  characterSteps: StartupStep[]
  optionalSteps: StartupStep[]
  onError: (name: string, error: unknown) => void
}

async function runSteps(steps: StartupStep[], onError: CharacterFirstInitializationOptions['onError']) {
  for (const step of steps) {
    try {
      await step.run()
    }
    catch (error) {
      onError(step.name, error)
    }
  }
}

export function startCharacterFirstInitialization(options: CharacterFirstInitializationOptions) {
  const characterReady = runSteps(options.characterSteps, options.onError)
  const optionalReady = characterReady.then(() => runSteps(options.optionalSteps, options.onError))

  return { characterReady, optionalReady }
}

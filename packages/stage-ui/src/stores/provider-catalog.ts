import type { Ref } from 'vue'

import type { ProviderCatalogProvider } from '../database/repos/providers.repo'

import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { providersRepo } from '../database/repos/providers.repo'
import { getDefinedProvider, listProviders } from '../libs/providers/providers'

export interface PatchConfigParams {
  validated: boolean
  validationBypassed: boolean
}

function setProviderMap(target: Record<string, ProviderCatalogProvider>, providers: Record<string, ProviderCatalogProvider>) {
  for (const key of Object.keys(target))
    delete target[key]
  for (const [key, value] of Object.entries(providers))
    target[key] = value
}

export function createProviderCatalogListQueryOptions(params?: {
  client?: unknown
  model?: unknown
  service?: unknown
}) {
  void params
  return {
    key: ['inference-service-providers'],
    query: async () => providersRepo.getAll(),
    enabled: false,
  }
}

export function createProviderCatalogStoreController(params: {
  addProviderMutation?: unknown
  configs: Ref<Record<string, ProviderCatalogProvider>>
  commitProviderConfigMutation?: unknown
  model?: unknown
  providersQuery?: unknown
  removeProviderMutation?: unknown
  service?: unknown
}) {
  const { configs } = params
  const defs = computed(() => listProviders())
  const isLoading = ref(false)
  const error = ref<Error | null>(null)
  const mutationError = ref<Error | null>(null)

  async function fetchList() {
    isLoading.value = true
    error.value = null
    try {
      const cached = await providersRepo.getAll()
      if (Object.keys(cached).length > 0)
        setProviderMap(configs.value, cached)
      return cached
    }
    catch (err) {
      error.value = err as Error
      return configs.value
    }
    finally {
      isLoading.value = false
    }
  }

  async function addProvider(definitionId: string, initialConfig: Record<string, unknown> = {}) {
    mutationError.value = null
    try {
      const definition = getDefinedProvider(definitionId)
      if (!definition)
        throw new Error(`Provider definition with id "${definitionId}" not found.`)

      const provider: ProviderCatalogProvider = {
        id: nanoid(),
        definitionId,
        name: definition.name,
        config: initialConfig,
        validated: false,
        validationBypassed: false,
      }

      configs.value[provider.id] = provider
      await providersRepo.upsert(provider)
      return provider
    }
    catch (err) {
      mutationError.value = err as Error
      throw err
    }
  }

  async function removeProvider(providerId: string) {
    if (!configs.value[providerId])
      return

    mutationError.value = null
    try {
      delete configs.value[providerId]
      await providersRepo.remove(providerId)
    }
    catch (err) {
      mutationError.value = err as Error
      throw err
    }
  }

  async function commitProviderConfig(providerId: string, newConfig: Record<string, unknown>, options: PatchConfigParams) {
    const provider = configs.value[providerId]
    if (!provider)
      return

    mutationError.value = null
    try {
      const localProvider: ProviderCatalogProvider = {
        ...provider,
        config: { ...newConfig },
        validated: options.validated,
        validationBypassed: options.validationBypassed,
      }
      configs.value[providerId] = localProvider
      await providersRepo.upsert(localProvider)
      return localProvider
    }
    catch (err) {
      mutationError.value = err as Error
      throw err
    }
  }

  return {
    configs,
    defs,
    getDefinedProvider,
    isLoading,
    error,
    mutationError,

    fetchList,
    addProvider,
    removeProvider,
    commitProviderConfig,
  }
}

export const useProviderCatalogStore = defineStore('provider-catalog', () => {
  const configs = ref<Record<string, ProviderCatalogProvider>>({})
  return createProviderCatalogStoreController({ configs })
})

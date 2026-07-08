import type { ProviderCatalogProvider } from '../database/repos/providers.repo'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { providerOpenAICompatible } from '../libs/providers/providers/openai-compatible'
import { type PatchConfigParams, useProviderCatalogStore } from './provider-catalog'

vi.mock('../database/repos/providers.repo', () => ({
  providersRepo: {
    getAll: vi.fn(async () => ({})),
    saveAll: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  },
}))

const localProvider = {
  id: 'local-provider',
  definitionId: providerOpenAICompatible.id,
  name: 'OpenAI Compatible',
  config: {},
  validated: false,
  validationBypassed: false,
} satisfies ProviderCatalogProvider

describe('store provider-catalog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('keeps provider catalog data local-only', async () => {
    const store = useProviderCatalogStore()
    const repo = await import('../database/repos/providers.repo')
    vi.mocked(repo.providersRepo.getAll).mockResolvedValueOnce({ 'local-id': localProvider })

    await expect(store.fetchList()).resolves.toEqual({ 'local-id': localProvider })
    expect(store.configs['local-id']).toEqual(localProvider)

    await expect(store.addProvider(providerOpenAICompatible.id)).resolves.toEqual(expect.objectContaining({
      definitionId: providerOpenAICompatible.id,
      name: 'OpenAI Compatible',
    }))

    const addedId = Object.keys(store.configs).find(id => id !== 'local-id')
    expect(addedId).toBeDefined()

    store.configs[localProvider.id] = localProvider
    await store.commitProviderConfig(localProvider.id, { apiKey: 'sk-test' }, { validated: true, validationBypassed: false } satisfies PatchConfigParams)
    await store.removeProvider(localProvider.id)

    expect(repo.providersRepo.upsert).toHaveBeenCalled()
    expect(repo.providersRepo.remove).toHaveBeenCalledWith(localProvider.id)
  })
})

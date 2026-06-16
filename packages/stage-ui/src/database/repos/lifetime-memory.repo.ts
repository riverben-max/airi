import type { LifetimeMemoryArtifact } from '../../types/lifetime-memory'

import { storage } from '../storage'

export const lifetimeMemoryRepo = {
  async getByCharacter(characterId: string, universeId = 'global') {
    const key = `local:memory/lifetime/${characterId}:${universeId}`
    let item = await storage.getItemRaw<LifetimeMemoryArtifact>(key)
    if (!item && universeId === 'global') {
      const oldKey = `local:memory/lifetime/${characterId}`
      item = await storage.getItemRaw<LifetimeMemoryArtifact>(oldKey)
      if (item) {
        await storage.setItemRaw(key, item)
        await storage.removeItem(oldKey)
      }
    }
    return item
  },

  async save(characterId: string, universeId = 'global', artifact: LifetimeMemoryArtifact) {
    const key = `local:memory/lifetime/${characterId}:${universeId}`
    // Deep clone to strip any Vue/Pinia proxies that cause DataCloneError in IndexedDB
    const cleanArtifact = JSON.parse(JSON.stringify(artifact))
    await storage.setItemRaw(key, cleanArtifact)
  },

  async delete(characterId: string, universeId = 'global') {
    const key = `local:memory/lifetime/${characterId}:${universeId}`
    await storage.removeItem(key)
  },
}

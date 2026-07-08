import type { Character, CreateCharacterPayload } from '../types/character'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useCharacterStore } from './characters'

vi.mock('../database/repos/characters.repo', () => ({
  charactersRepo: {
    getAll: vi.fn(async () => []),
    saveAll: vi.fn(async () => {}),
    upsert: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  },
}))

vi.mock('./auth', () => ({
  useAuthStore: () => ({
    userId: 'user-1',
  }),
}))

const character = {
  id: 'character-1',
  version: '1',
  coverUrl: 'cover.png',
  avatarUrl: undefined,
  characterAvatarUrl: undefined,
  coverBackgroundUrl: undefined,
  creatorRole: undefined,
  priceCredit: '0',
  likesCount: 0,
  bookmarksCount: 0,
  interactionsCount: 0,
  forksCount: 0,
  creatorId: 'user-1',
  ownerId: 'user-1',
  characterId: 'airi',
  createdAt: new Date('2026-05-08T00:00:00.000Z'),
  updatedAt: new Date('2026-05-08T00:00:00.000Z'),
  deletedAt: undefined,
  capabilities: [],
  avatarModels: [],
  i18n: [],
  prompts: [],
  likes: [],
  bookmarks: [],
} satisfies Character

const payload = {
  character: { version: '1', coverUrl: 'cover.png', characterId: 'airi', id: 'local-character' },
  capabilities: [],
  avatarModels: [],
  i18n: [],
  prompts: [],
} satisfies CreateCharacterPayload

describe('store characters', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('reads and updates only the local character snapshot', async () => {
    const store = useCharacterStore()
    const repo = await import('../database/repos/characters.repo')
    vi.mocked(repo.charactersRepo.getAll).mockResolvedValueOnce([character])

    await expect(store.fetchList()).resolves.toEqual([character])
    expect(store.characters.get(character.id)).toBeDefined()

    await expect(store.create(payload)).resolves.toEqual(expect.objectContaining({ id: 'local-character' }))
    expect(store.characters.get('local-character')).toBeDefined()

    store.characters.set(character.id, character)
    await store.update(character.id, { version: '2' })
    await store.like(character.id)
    await store.bookmark(character.id)
    await store.remove(character.id)

    expect(repo.charactersRepo.upsert).toHaveBeenCalled()
    expect(repo.charactersRepo.remove).toHaveBeenCalledWith(character.id)
  })
})

import type { Ref } from 'vue'

import type { Character, CreateCharacterPayload, UpdateCharacterPayload } from '../types/character'

import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { parse } from 'valibot'
import { computed, ref } from 'vue'

import { charactersRepo } from '../database/repos/characters.repo'
import { CharacterWithRelationsSchema } from '../types/character'
import { useAuthStore } from './auth'

interface StoreQuery<TData> {
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  refetch: (force?: boolean) => Promise<{ data?: TData }>
}

interface StoreMutation<TVars, TData> {
  error: Ref<Error | null>
  mutateAsync: (vars: TVars) => Promise<TData>
}

function setCharactersMap(target: Map<string, Character>, characters: Character[]) {
  target.clear()
  for (const character of characters)
    target.set(character.id, character)
}

function buildLocalCharacter(userId: string, payload: CreateCharacterPayload) {
  const id = payload.character.id ?? nanoid()
  const now = new Date()

  return parse(CharacterWithRelationsSchema, {
    id,
    version: payload.character.version,
    coverUrl: payload.character.coverUrl,
    avatarUrl: undefined,
    characterAvatarUrl: undefined,
    coverBackgroundUrl: undefined,
    creatorRole: undefined,
    priceCredit: '0',
    likesCount: 0,
    bookmarksCount: 0,
    interactionsCount: 0,
    forksCount: 0,
    creatorId: userId,
    ownerId: userId,
    characterId: payload.character.characterId,
    createdAt: now,
    updatedAt: now,
    deletedAt: undefined,
    capabilities: payload.capabilities?.map(capability => ({
      id: nanoid(),
      characterId: id,
      type: capability.type,
      config: capability.config,
    })),
    avatarModels: payload.avatarModels?.map(model => ({
      id: nanoid(),
      characterId: id,
      name: model.name,
      type: model.type,
      description: model.description,
      config: model.config,
      createdAt: now,
      updatedAt: now,
    })),
    i18n: payload.i18n?.map(item => ({
      id: nanoid(),
      characterId: id,
      language: item.language,
      name: item.name,
      description: item.description,
      tags: item.tags,
      createdAt: now,
      updatedAt: now,
    })),
    prompts: payload.prompts?.map(prompt => ({
      id: nanoid(),
      characterId: id,
      language: prompt.language,
      type: prompt.type,
      content: prompt.content,
    })),
    likes: [],
    bookmarks: [],
  })
}

function createLocalOnlyListQuery(): StoreQuery<Character[]> {
  return {
    error: ref<Error | null>(null),
    isLoading: ref(false),
    async refetch() {
      return { data: [] }
    },
  }
}

function createLocalOnlyMutation<TVars, TData>(): StoreMutation<TVars, TData> {
  const error = ref<Error | null>(null)

  return {
    error,
    async mutateAsync() {
      const nextError = new Error('Remote character sync is disabled')
      error.value = nextError
      throw nextError
    },
  }
}

export function createCharactersListQueryOptions(params: {
  client?: unknown
  listAll: Ref<boolean>
  service?: unknown
}) {
  return {
    key: () => ['characters', { all: params.listAll.value }],
    query: async () => charactersRepo.getAll(),
    enabled: false,
  }
}

export function createCharacterStoreController(params: {
  auth: { userId: string }
  bookmarkMutation: StoreMutation<string, Character>
  characters: Ref<Map<string, Character>>
  createMutation: StoreMutation<CreateCharacterPayload, Character>
  model?: unknown
  likeMutation: StoreMutation<string, Character>
  listAll: Ref<boolean>
  listQuery: StoreQuery<Character[]>
  service?: unknown
  removeMutation: StoreMutation<string, void>
  updateMutation: StoreMutation<{ id: string, data: UpdateCharacterPayload }, Character>
}) {
  const {
    auth,
    bookmarkMutation,
    characters,
    createMutation,
    likeMutation,
    listAll,
    listQuery,
    removeMutation,
    updateMutation,
  } = params
  const mutationError = computed(() =>
    createMutation.error.value
    ?? updateMutation.error.value
    ?? removeMutation.error.value
    ?? likeMutation.error.value
    ?? bookmarkMutation.error.value)

  async function fetchList(all: boolean = false) {
    listAll.value = all
    const cached = await charactersRepo.getAll()
    if (cached.length > 0)
      setCharactersMap(characters.value, cached)
    return cached
  }

  async function fetchById(id: string) {
    const cached = characters.value.get(id) ?? (await charactersRepo.getAll()).find(character => character.id === id)
    if (cached)
      characters.value.set(cached.id, cached)
    return cached
  }

  async function create(payload: CreateCharacterPayload) {
    const localCharacter = buildLocalCharacter(auth.userId, payload)
    characters.value.set(localCharacter.id, localCharacter)
    await charactersRepo.upsert(localCharacter)
    return localCharacter
  }

  async function update(id: string, payload: UpdateCharacterPayload) {
    const character = characters.value.get(id)
    if (!character)
      return

    const localCharacter = {
      ...character,
      ...(payload.version !== undefined ? { version: payload.version } : {}),
      ...(payload.coverUrl !== undefined ? { coverUrl: payload.coverUrl } : {}),
      ...(payload.characterId !== undefined ? { characterId: payload.characterId } : {}),
      updatedAt: new Date(),
    }
    characters.value.set(localCharacter.id, localCharacter)
    await charactersRepo.upsert(localCharacter)
    return localCharacter
  }

  async function remove(id: string) {
    characters.value.delete(id)
    await charactersRepo.remove(id)
  }

  async function like(id: string) {
    const character = characters.value.get(id)
    if (!character)
      return

    const likes = character.likes ?? []
    if (!likes.some(item => item.userId === auth.userId)) {
      const localCharacter = {
        ...character,
        likes: [...likes, { userId: auth.userId, characterId: id }],
        likesCount: character.likesCount + 1,
        updatedAt: new Date(),
      }
      characters.value.set(localCharacter.id, localCharacter)
      await charactersRepo.upsert(localCharacter)
    }
  }

  async function bookmark(id: string) {
    const character = characters.value.get(id)
    if (!character)
      return

    const bookmarks = character.bookmarks ?? []
    if (!bookmarks.some(item => item.userId === auth.userId)) {
      const localCharacter = {
        ...character,
        bookmarks: [...bookmarks, { userId: auth.userId, characterId: id }],
        bookmarksCount: character.bookmarksCount + 1,
        updatedAt: new Date(),
      }
      characters.value.set(localCharacter.id, localCharacter)
      await charactersRepo.upsert(localCharacter)
    }
  }

  function getCharacter(id: string) {
    return characters.value.get(id)
  }

  return {
    characters,
    isLoading: computed(() => listQuery.isLoading.value),
    error: computed(() => listQuery.error.value),
    mutationError,

    fetchList,
    fetchById,
    create,
    update,
    remove,
    like,
    bookmark,
    getCharacter,
  }
}

export const useCharacterStore = defineStore('characters', () => {
  const characters = ref<Map<string, Character>>(new Map())
  const listAll = ref(false)
  const auth = useAuthStore()

  const listQuery = createLocalOnlyListQuery()
  const createMutation = createLocalOnlyMutation<CreateCharacterPayload, Character>()
  const updateMutation = createLocalOnlyMutation<{ id: string, data: UpdateCharacterPayload }, Character>()
  const removeMutation = createLocalOnlyMutation<string, void>()
  const likeMutation = createLocalOnlyMutation<string, Character>()
  const bookmarkMutation = createLocalOnlyMutation<string, Character>()

  return createCharacterStoreController({
    auth,
    bookmarkMutation,
    characters,
    createMutation,
    likeMutation,
    listAll,
    listQuery,
    removeMutation,
    updateMutation,
  })
})

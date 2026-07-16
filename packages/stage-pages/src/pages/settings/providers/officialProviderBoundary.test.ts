import { describe, expect, it } from 'vitest'

import {
  buildCustomerProviderSections,
  buildOfficialProviderSections,
  isCustomerVisibleProviderCard,
  isOfficialProviderCard,
  isSupportedProviderSettingsRoute,
} from './officialProviderBoundary'

const officialChat = {
  id: 'official-provider',
  category: 'chat',
  localizedName: 'AIRI Official',
  localizedDescription: 'Official backend provider',
}

const officialVision = {
  id: 'vision-official-provider',
  category: 'vision',
  localizedName: 'AIRI Official Vision',
  localizedDescription: 'Official backend vision provider',
}

const openai = {
  id: 'openai',
  category: 'chat',
  localizedName: 'OpenAI',
  localizedDescription: 'Third-party key setup',
}

const replicate = {
  id: 'replicate',
  category: 'artistry',
  localizedName: 'Replicate',
  localizedDescription: 'Third-party image provider',
}

describe('official provider boundary', () => {
  it('keeps only official provider cards in customer-facing settings sections', () => {
    const sections = buildOfficialProviderSections([
      {
        id: 'chat',
        icon: 'i-solar:chat-square-like-bold-duotone',
        title: 'Chat',
        description: 'Chat requests',
        providers: [officialChat, openai],
      },
      {
        id: 'vision',
        icon: 'i-solar:eye-bold-duotone',
        title: 'Vision',
        description: 'Vision requests',
        providers: [officialVision],
      },
      {
        id: 'artistry',
        icon: 'i-solar:palette-bold-duotone',
        title: 'Artistry',
        description: 'Image generation',
        providers: [replicate],
      },
    ])

    expect(sections).toHaveLength(2)
    expect(sections.map(section => section.id)).toEqual(['chat', 'vision'])
    expect(sections.flatMap(section => section.providers.map(provider => provider.id))).toEqual([
      'official-provider',
      'vision-official-provider',
    ])
  })

  it('classifies only official provider ids as supported product cards', () => {
    expect(isOfficialProviderCard({ id: 'official-provider' })).toBe(true)
    expect(isOfficialProviderCard({ id: 'official-provider-speech' })).toBe(true)
    expect(isOfficialProviderCard({ id: 'official-provider-speech-streaming' })).toBe(true)
    expect(isOfficialProviderCard({ id: 'official-provider-transcription' })).toBe(true)
    expect(isOfficialProviderCard({ id: 'vision-official-provider' })).toBe(true)

    expect(isOfficialProviderCard({ id: 'openai' })).toBe(false)
    expect(isOfficialProviderCard({ id: 'openrouter-ai' })).toBe(false)
    expect(isOfficialProviderCard({ id: 'ollama' })).toBe(false)
    expect(isOfficialProviderCard({ id: 'elevenlabs' })).toBe(false)
    expect(isOfficialProviderCard({ id: 'replicate' })).toBe(false)
    expect(isOfficialProviderCard({ id: 'comfyui' })).toBe(false)
  })

  it('keeps the restored local ComfyUI provider visible alongside official cards', () => {
    expect(isCustomerVisibleProviderCard({ id: 'comfyui' })).toBe(true)
    expect(buildCustomerProviderSections([
      {
        id: 'artistry',
        icon: 'i-solar:palette-bold-duotone',
        title: 'Artistry',
        description: 'Image generation',
        providers: [replicate, { ...replicate, id: 'comfyui' }],
      },
    ]).flatMap(section => section.providers.map(provider => provider.id))).toEqual(['comfyui'])
  })

  it('allows only official dynamic chat and vision provider settings routes', () => {
    expect(isSupportedProviderSettingsRoute('chat', 'official-provider')).toBe(true)
    expect(isSupportedProviderSettingsRoute('vision', 'official-provider')).toBe(true)

    expect(isSupportedProviderSettingsRoute('chat', 'openai')).toBe(false)
    expect(isSupportedProviderSettingsRoute('chat', 'openai-compatible')).toBe(false)
    expect(isSupportedProviderSettingsRoute('vision', 'ollama')).toBe(false)
    expect(isSupportedProviderSettingsRoute('vision', 'lm-studio')).toBe(false)
    expect(isSupportedProviderSettingsRoute('speech', 'official-provider-speech')).toBe(false)
  })
})

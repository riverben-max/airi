import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readWorkspaceFile(path: string) {
  return readFileSync(resolve(import.meta.dirname, path), 'utf-8')
}

const providerPagesRoot = resolve(import.meta.dirname)

const officialProviderPagePaths = new Set([
  'chat/official-provider.vue',
  'vision/official-provider.vue',
  'speech/official-provider-speech.vue',
  'speech/official-provider-speech-streaming.vue',
  'transcription/official-provider-transcription.vue',
  'artistry/comfyui.vue',
])

const providerCategoriesWithConcretePages = new Set([
  'artistry',
  'chat',
  'cloud',
  'speech',
  'transcription',
  'vision',
])

const setupFormIndicators = [
  'ProviderSettings',
  'SpeechProviderSettings',
  'TranscriptionProviderSettings',
  'useProvidersStore',
  'getProviderConfig',
  'getProviderInstance',
  'apiKey',
  'API key',
  'credentials',
  'FieldPassword',
]

function listVueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = resolve(dir, entry.name)

      if (entry.isDirectory())
        return listVueFiles(entryPath)

      if (!entry.name.endsWith('.vue'))
        return []

      return relative(providerPagesRoot, entryPath).replaceAll('\\', '/')
    })
}

function isNonOfficialConcreteProviderPage(path: string): boolean {
  const [category, filename] = path.split('/')

  if (!providerCategoriesWithConcretePages.has(category))
    return false

  if (!filename || filename.startsWith('['))
    return false

  return !officialProviderPagePaths.has(path)
}

describe('phase 1 provider settings surface', () => {
  it('exposes only supported provider setup from the supported providers index', () => {
    const text = readWorkspaceFile('index.vue')

    expect(text).toContain('useArtistryStore')
    expect(text).not.toContain('useSyncEngineStore')
    expect(text).not.toContain('isCustomProvidersDisabled')
    expect(text).toContain('/settings/providers/artistry/comfyui')
    expect(text).not.toContain('/settings/providers/cloud')
    expect(text).toContain('ComfyUI')
    expect(text).not.toContain('Replicate')
    expect(text).not.toContain('Nano Banana')
    expect(text).not.toContain('S3-Compatible Cloud Storage')
    expect(text).not.toContain('filterPricing')
    expect(text).not.toContain('filterDeployment')
  })

  it('hard-blocks every non-official concrete provider route before setup forms can render', () => {
    const blockedProviderPages = listVueFiles(providerPagesRoot)
      .filter(isNonOfficialConcreteProviderPage)
      .sort()

    expect(blockedProviderPages).toContain('chat/amazon-bedrock.vue')
    expect(blockedProviderPages).toContain('speech/elevenlabs.vue')
    expect(blockedProviderPages).toContain('transcription/openai-audio-transcription.vue')
    expect(blockedProviderPages).toContain('artistry/replicate.vue')
    expect(blockedProviderPages).toContain('vision/lm-studio.vue')
    expect(blockedProviderPages).toContain('cloud/local-fs.vue')
    expect(blockedProviderPages).toContain('cloud/s3.vue')
    expect(blockedProviderPages).not.toContain('artistry/comfyui.vue')
    expect(blockedProviderPages).not.toContain('chat/official-provider.vue')
    expect(blockedProviderPages).not.toContain('speech/official-provider-speech.vue')

    for (const page of blockedProviderPages) {
      const text = readWorkspaceFile(page)

      expect.soft(
        text,
        `${page} must render the shared Phase 1 unavailable redirect boundary`,
      ).toContain('ProviderUnavailableRoute')

      for (const indicator of setupFormIndicators) {
        expect.soft(
          text,
          `${page} must not keep third-party setup form indicator ${indicator}`,
        ).not.toContain(indicator)
      }
    }
  })

  it('keeps local data boundary messaging on the Data settings page', () => {
    const indexText = readWorkspaceFile('../data/index.vue')
    const noticeText = readWorkspaceFile('../data/components/localDataNotice.vue')

    expect(indexText).toContain('localDataNotice.vue')
    expect(indexText).toContain('<LocalDataNotice />')
    expect(noticeText).toContain('settings.pages.data.local_notice.title')
    expect(noticeText).toContain('settings.pages.data.local_notice.items.chats')
    expect(noticeText).toContain('settings.pages.data.local_notice.items.characters')
    expect(noticeText).toContain('settings.pages.data.local_notice.items.memory')
  })

  it('exposes local data export, clear, and delete actions on the Data settings page', () => {
    const indexText = readWorkspaceFile('../data/index.vue')
    const chatsSectionText = readWorkspaceFile('../data/components/chats-section.vue')
    const modelsModulesSectionText = readWorkspaceFile('../data/components/models-modules-section.vue')
    const dangerSectionText = readWorkspaceFile('../data/components/danger-section.vue')

    expect(indexText).toContain('ChatsSection')
    expect(indexText).toContain('ModelsModulesSection')
    expect(indexText).toContain('DangerSection')

    expect(chatsSectionText).toContain('exportChatSessions')
    expect(chatsSectionText).toContain('settings.pages.data.sections.chats.export')
    expect(chatsSectionText).toContain('deleteAllChatSessions')
    expect(chatsSectionText).toContain('settings.pages.data.sections.chats.delete')

    expect(modelsModulesSectionText).toContain('deleteAllModels')
    expect(modelsModulesSectionText).toContain('settings.pages.data.sections.models.delete')
    expect(modelsModulesSectionText).toContain('resetModulesSettings')
    expect(modelsModulesSectionText).toContain('settings.pages.data.sections.modules.reset')

    expect(dangerSectionText).toContain('resetProvidersSettings')
    expect(dangerSectionText).toContain('settings.pages.data.sections.providers.reset')
    expect(dangerSectionText).toContain('deleteAllData')
    expect(dangerSectionText).toContain('settings.pages.data.sections.all.delete')
  })
})

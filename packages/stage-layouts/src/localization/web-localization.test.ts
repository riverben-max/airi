import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workspaceRoot = resolve(import.meta.dirname, '../../../..')
const sourceRoots = [
  'apps/stage-web/src',
  'apps/ui-server-auth/src',
  'packages/stage-pages/src',
  'packages/stage-layouts/src',
  'packages/stage-ui/src',
]

const excludedPath = /[\\/]devtools[\\/]|[\\/]dist[\\/]|[\\/]stories[\\/]|\.test\.ts$|\.story\.vue$/
const deferredEnglishCatalogPrefixes = [
  // Task 5 restores the server auth locale sources and adds them to the web catalog.
  'server.auth.',
]
const allowedIdenticalEnglishMessages = new Map<string, string>([
  ['settings.live2d.scale-and-position.x', 'X'],
  ['settings.live2d.scale-and-position.y', 'Y'],
  ['settings.pages.admin.models.fields.id', 'ID'],
  ['settings.pages.admin.officialGateway.columns.flux', 'Flux'],
  ['settings.pages.admin.officialGateway.providers.openrouter', 'OpenRouter'],
  ['settings.pages.admin.plans.columns.flux', 'Flux'],
  ['settings.pages.admin.plans.fields.id', 'ID'],
  ['settings.pages.admin.users.columns.flux', 'Flux'],
  ['settings.pages.admin.users.fields.flux', 'Flux'],
  ['settings.pages.connection.hf-token.placeholder', 'hf_...'],
  ['settings.pages.flux.title', 'Flux'],
  ['settings.pages.modules.hearing.sections.section.hotkey.options.caps', 'Caps Lock'],
  ['settings.pages.modules.hearing.sections.section.hotkey.options.num', 'Num Lock'],
  ['settings.pages.modules.hearing.sections.section.hotkey.options.scroll', 'Scroll Lock'],
  ['settings.pages.modules.messaging-discord.title', 'Discord'],
  ['settings.pages.modules.x.title', 'X / Twitter'],
  ['settings.pages.providers.provider.302-ai.title', '302.AI'],
  ['settings.pages.providers.provider.aihubmix.title', 'AIHubMix'],
  ['settings.pages.providers.provider.amazon-bedrock.title', 'Amazon Bedrock'],
  ['settings.pages.providers.provider.anthropic.title', 'Anthropic | Claude'],
  ['settings.pages.providers.provider.azure-ai-foundry.title', 'Azure AI Foundry'],
  ['settings.pages.providers.provider.cerebras.title', 'Cerebras'],
  ['settings.pages.providers.provider.comet-api.title', 'Comet API'],
  ['settings.pages.providers.provider.featherless.title', 'Featherless AI'],
  ['settings.pages.providers.provider.fireworks.title', 'Fireworks.ai'],
  ['settings.pages.providers.provider.google-generative-ai.title', 'Google Gemini'],
  ['settings.pages.providers.provider.groq.title', 'Groq'],
  ['settings.pages.providers.provider.lm-studio.title', 'LM Studio'],
  ['settings.pages.providers.provider.minimax-global.title', 'MiniMax Global'],
  ['settings.pages.providers.provider.minimax.title', 'MiniMax'],
  ['settings.pages.providers.provider.mistral.title', 'Mistral'],
  ['settings.pages.providers.provider.n1n.title', 'n1n'],
  ['settings.pages.providers.provider.novita.title', 'Novita'],
  ['settings.pages.providers.provider.nvidia.title', 'NVIDIA NIM'],
  ['settings.pages.providers.provider.ollama.title', 'Ollama'],
  ['settings.pages.providers.provider.openai.title', 'OpenAI'],
  ['settings.pages.providers.provider.openrouter.title', 'OpenRouter'],
  ['settings.pages.providers.provider.perplexity.title', 'Perplexity'],
  ['settings.pages.providers.provider.together.title', 'Together.ai'],
  ['settings.pages.providers.provider.xai.title', 'xAI'],
  ['settings.pages.system.sections.section.developer.sections.section.markdown-stress.title', 'Markdown Stress'],
  ['stage.chat.message.character-name.airi', 'AIRI'],
  ['tamagotchi.settings.devtools.pages.context-flow.title', 'Context Flow'],
])

function canRemainEnglish(key: string, value: unknown) {
  return typeof value === 'string'
    && allowedIdenticalEnglishMessages.get(key) === value
}

function isUntranslatedEnglishMessage(key: string, englishValue: unknown, chineseValue: unknown) {
  return typeof englishValue === 'string'
    && englishValue === chineseValue
    && /[A-Z]/i.test(englishValue)
    && !canRemainEnglish(key, englishValue)
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (excludedPath.test(path))
      return []
    if (entry.isDirectory())
      return listSourceFiles(path)
    return /\.(?:ts|tsx|vue)$/.test(entry.name) ? [path] : []
  })
}

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value))
      flatten(child, prefix ? `${prefix}.${key}` : key, output)
  }
  else {
    output[prefix] = value
  }
  return output
}

function loadWebMessages(locale: 'en' | 'zh-Hans') {
  const localeRoot = resolve(workspaceRoot, 'packages/i18n/src/locales', locale)
  return flatten({
    base: parse(readFileSync(resolve(localeRoot, 'base.yaml'), 'utf8')),
    settings: parse(readFileSync(resolve(localeRoot, 'settings.yaml'), 'utf8')),
    stage: parse(readFileSync(resolve(localeRoot, 'stage.yaml'), 'utf8')),
    tamagotchi: {
      settings: parse(readFileSync(resolve(localeRoot, 'tamagotchi/settings.yaml'), 'utf8')),
    },
  })
}

function extractStaticTranslationKeys(source: string) {
  return [...source.matchAll(/(?<![\w$.])(?:t|\$t)\s*\(\s*(['"`])([\w.:-]+)\1/g)].map(match => match[2])
}

function collectStaticTranslationKeys() {
  const keys = new Set<string>()
  for (const root of sourceRoots) {
    for (const file of listSourceFiles(resolve(workspaceRoot, root))) {
      const source = readFileSync(file, 'utf8')
      for (const key of extractStaticTranslationKeys(source))
        keys.add(key)
    }
  }
  return [...keys].sort()
}

function interpolationVariables(value: unknown) {
  if (typeof value !== 'string')
    return []
  return [...value.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort()
}

describe('static translation call matching', () => {
  it('accepts constant literal calls with whitespace before the parenthesis', () => {
    const source = [
      't(\'base.direct\')',
      't ("settings.spaced")',
      '$t (`stage.template`)',
    ].join('\n')

    expect(extractStaticTranslationKeys(source).sort()).toEqual([
      'base.direct',
      'settings.spaced',
      'stage.template',
    ])
  })

  it('does not match unrelated methods or interpolated templates', () => {
    const source = [
      'translator.t(\'settings.unrelated-method\')',
      `t(\`settings.dynamic.\${suffix}\`)`,
      '$t(\'stage.valid\')',
    ].join('\n')

    expect(extractStaticTranslationKeys(source)).toEqual(['stage.valid'])
  })
})

describe('identical English message exceptions', () => {
  it('allows a known provider title with its exact value', () => {
    expect(canRemainEnglish('settings.pages.providers.provider.openai.title', 'OpenAI')).toBe(true)
  })

  it('rejects ordinary prose under a known provider title key', () => {
    expect(canRemainEnglish('settings.pages.providers.provider.openai.title', 'Configure Provider')).toBe(false)
  })

  it('allows a known technical value under an exact flux key', () => {
    expect(canRemainEnglish('settings.pages.admin.officialGateway.columns.flux', 'Flux')).toBe(true)
  })

  it('rejects ordinary prose under a known flux key', () => {
    expect(canRemainEnglish('settings.pages.admin.officialGateway.columns.flux', 'Configure Flux')).toBe(false)
  })

  it('detects ordinary one- and two-letter English messages', () => {
    for (const value of ['Go', 'No', 'On'])
      expect(isUntranslatedEnglishMessage('settings.test.action', value, value)).toBe(true)
  })

  it('allows exact technical X, Y, ID, and hf_... values', () => {
    expect([
      canRemainEnglish('settings.live2d.scale-and-position.x', 'X'),
      canRemainEnglish('settings.live2d.scale-and-position.y', 'Y'),
      canRemainEnglish('settings.pages.admin.models.fields.id', 'ID'),
      canRemainEnglish('settings.pages.connection.hf-token.placeholder', 'hf_...'),
    ]).toEqual([true, true, true, true])
  })
})

describe('simplified Chinese web localization', () => {
  const english = loadWebMessages('en')
  const chinese = loadWebMessages('zh-Hans')
  const referencedKeys = collectStaticTranslationKeys()
  const cataloguedReferencedKeys = referencedKeys.filter(key => key in english)

  it('accounts for every statically referenced key in an English catalog', () => {
    const missing = referencedKeys
      .filter(key => !(key in english))
      .filter(key => !deferredEnglishCatalogPrefixes.some(prefix => key.startsWith(prefix)))
    expect(missing).toEqual([])
  })

  it('defines every statically referenced English key in Simplified Chinese', () => {
    expect(cataloguedReferencedKeys.filter(key => !(key in chinese))).toEqual([])
  })

  it('preserves interpolation variables from English messages', () => {
    const mismatches = cataloguedReferencedKeys
      .filter(key => key in chinese)
      .filter(key => interpolationVariables(english[key]).join('|') !== interpolationVariables(chinese[key]).join('|'))
    expect(mismatches).toEqual([])
  })

  it('does not leave referenced user-facing sentences identical to English', () => {
    const untranslated = referencedKeys.filter(key => (
      isUntranslatedEnglishMessage(key, english[key], chinese[key])
    ))
    expect(untranslated).toEqual([])
  })
})

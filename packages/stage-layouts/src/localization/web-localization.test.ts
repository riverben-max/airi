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
const forbiddenEnglishByFile: Record<string, string[]> = {
  'packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue': [
    'New Profile',
    'Profile Name',
    'Base Provider',
    'Pitch Tuning',
    'Custom Replacement Rules',
    'Stop Playback',
    'e.g.',
  ],
  'packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue': [
    'Character Customizations',
    'Auto Blink',
    'Force Auto Blink (fallback)',
    'Reset value to default',
    'Mouse Tracking',
  ],
  'packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue': [
    'Character Customizations',
    'Enable Physics',
    'Enable IK Solvers',
    'Gravity Strength',
  ],
  'packages/stage-pages/src/pages/settings/airi-card/guided.vue': [
    'Confirm & Create',
    'Roster Settings',
    'Model Preview',
    'Auto-Assign Voices',
  ],
  'packages/stage-pages/src/pages/settings/airi-card/components/CardCreationDialog.vue': [
    'Journal:',
  ],
  'packages/stage-pages/src/pages/settings/airi-card/components/ConceptBuilderModal.vue': [
    'e.g.',
  ],
  'packages/stage-pages/src/pages/settings/airi-card/components/VoiceCreatorModal.vue': [
    'e.g.',
  ],
  'packages/stage-pages/src/pages/settings/modules/speech.vue': [
    'Add Provider',
    'No Speech Providers Configured',
    'Customize how your AI assistant speaks',
  ],
  'packages/stage-pages/src/pages/settings/modules/vision.vue': [
    'Not Configured',
    'No Vision Providers Configured',
    'Search models...',
    'Direct Response',
    'Forward to LLM',
  ],
  'packages/stage-pages/src/pages/settings/modules/hearing.vue': [
    'No Providers Configured',
    'Click here to set up your Transcription providers',
    'Voice Activity',
    'Last 2 seconds',
  ],
  'packages/stage-pages/src/pages/settings/modules/memory-short-term.vue': [
    'Active Character',
    'Window Size',
    'Rebuild From History',
    'Context Strategy',
    'Dream State Synthesis',
  ],
  'packages/stage-pages/src/pages/settings/modules/memory-long-term.vue': [
    'Character Filter',
    'Search Archive',
    'Archive Purpose',
    'Operational Rules',
    'Identity Anchors',
  ],
  'packages/stage-pages/src/pages/settings/modules/memory-signals.vue': [
    'The Dream State',
    'Enable Dream State',
    'Journaling Threshold',
    'Strict AFK Gating',
  ],
  'packages/stage-pages/src/pages/settings/data/index.vue': [
    'Backup Provider:',
    'Last Backup:',
    'Nuke Selected',
    'Restore Selected',
    'Confirm Restore',
  ],
  'packages/stage-pages/src/pages/v2/settings/providers.vue': [
    'Search configured...',
    'Customize options',
    'Search supported providers...',
    'No providers',
  ],
}

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

function stripSourceComments(source: string) {
  const blankComment = (comment: string) => comment.replace(/[^\r\n]/g, ' ')
  const stripHtmlComments = (content: string) => content.replace(/<!--[\s\S]*?-->/g, blankComment)
  const stripJavaScriptComments = (content: string) => {
    const result = [...content]
    let quote: '\'' | '"' | '`' | undefined
    let escaped = false

    for (let index = 0; index < result.length; index++) {
      const character = result[index]
      const nextCharacter = result[index + 1]

      if (quote) {
        if (escaped)
          escaped = false
        else if (character === '\\')
          escaped = true
        else if (character === quote)
          quote = undefined
        continue
      }

      if (character === '\'' || character === '"' || character === '`') {
        quote = character
        continue
      }

      if (character === '/' && nextCharacter === '/') {
        while (index < result.length && result[index] !== '\n' && result[index] !== '\r') {
          result[index] = ' '
          index++
        }
        index--
      }
      else if (character === '/' && nextCharacter === '*') {
        result[index] = ' '
        result[index + 1] = ' '
        index += 2
        while (index < result.length) {
          if (result[index] === '*' && result[index + 1] === '/') {
            result[index] = ' '
            result[index + 1] = ' '
            index++
            break
          }
          if (result[index] !== '\n' && result[index] !== '\r')
            result[index] = ' '
          index++
        }
      }
    }

    return result.join('')
  }

  const scriptPattern = /<script\b[^>]*>([\s\S]*?)<\/script>/gi
  let result = ''
  let lastIndex = 0
  for (const match of source.matchAll(scriptPattern)) {
    const matchIndex = match.index
    const scriptBlock = match[0]
    const scriptContent = match[1]
    const contentOffset = scriptBlock.indexOf(scriptContent)

    result += stripHtmlComments(source.slice(lastIndex, matchIndex))
    result += scriptBlock.slice(0, contentOffset)
    result += stripJavaScriptComments(scriptContent)
    result += scriptBlock.slice(contentOffset + scriptContent.length)
    lastIndex = matchIndex + scriptBlock.length
  }

  return result + stripHtmlComments(source.slice(lastIndex))
}

it('does not reintroduce audited English literals in production settings', () => {
  const violations = Object.entries(forbiddenEnglishByFile).flatMap(([file, phrases]) => {
    const source = stripSourceComments(readFileSync(resolve(workspaceRoot, file), 'utf8'))
    return phrases.filter(phrase => source.includes(phrase)).map(phrase => `${file}: ${phrase}`)
  })
  expect(violations).toEqual([])
})

describe('production settings source audit', () => {
  it('ignores forbidden phrases in Vue and JavaScript comments', () => {
    const source = [
      '<!-- Add Provider -->',
      '<script setup lang="ts">',
      '// Add Provider',
      '/* Add Provider */',
      '</script>',
    ].join('\n')

    expect(stripSourceComments(source)).not.toContain('Add Provider')
  })

  it('keeps forbidden phrases in template and script content', () => {
    const sources = [
      '<template><span>Add Provider</span></template>',
      '<script setup lang="ts">const toastText = \'Add Provider\'</script>',
      '<script setup lang="ts">const help = \'https://example.com/* Add Provider */\'</script>',
    ]

    for (const source of sources)
      expect(stripSourceComments(source)).toContain('Add Provider')
  })

  it('requires localized accessible names for icon-only provider actions', () => {
    const requirements = [
      {
        file: 'packages/stage-pages/src/pages/settings/modules/speech.vue',
        key: 'settings.pages.providers.actions.delete-provider',
        interpolation: '{ name:',
      },
      {
        file: 'packages/stage-pages/src/pages/settings/modules/vision.vue',
        key: 'settings.pages.providers.actions.delete-provider',
        interpolation: '{ name:',
      },
      {
        file: 'packages/stage-pages/src/pages/settings/modules/hearing.vue',
        key: 'settings.pages.modules.hearing.actions.add-provider',
      },
    ]
    const missing = requirements.flatMap(({ file, key, interpolation }) => {
      const source = stripSourceComments(readFileSync(resolve(workspaceRoot, file), 'utf8'))
      const ariaLabels = [...source.matchAll(/:aria-label="([^"]+)"/g)].map(match => match[1])
      const hasBinding = ariaLabels.some(label => label.includes(key) && (!interpolation || label.includes(interpolation)))
      return hasBinding ? [] : [`${file}: ${key}`]
    })

    expect(missing).toEqual([])
  })

  it('updates the default speech sample across locale changes without replacing edits', () => {
    const source = readFileSync(resolve(workspaceRoot, 'packages/stage-pages/src/pages/settings/modules/speech.vue'), 'utf8')

    expect(source).toContain('const translatedDefaultTestText = computed(')
    expect(source).toContain('const testText = ref(translatedDefaultTestText.value)')
    expect(source).toContain('watch(translatedDefaultTestText, (nextDefault, previousDefault) => {')
    expect(source).toContain('if (testText.value === previousDefault)')
  })

  it('localizes card filter and voice preset metadata before rendering', () => {
    const guided = readFileSync(resolve(workspaceRoot, 'packages/stage-pages/src/pages/settings/airi-card/guided.vue'), 'utf8')
    const voiceCreator = readFileSync(resolve(workspaceRoot, 'packages/stage-pages/src/pages/settings/airi-card/components/VoiceCreatorModal.vue'), 'utf8')

    expect(guided).not.toMatch(/\{\{\s*chip\.type\s*\}\}/)
    expect(guided.match(/chipTypeLabel\(chip\.type\)/g)).toHaveLength(2)
    expect(voiceCreator).not.toContain('{{ voice.description }}')
    expect(voiceCreator).not.toContain('{{ voice.gender }}')
    expect(voiceCreator).toContain('presetDescription(voice.id)')
    expect(voiceCreator).toContain('genderLabel(voice.gender)')
  })

  it('requires accessible card editor graphical controls and switches', () => {
    const guided = readFileSync(resolve(workspaceRoot, 'packages/stage-pages/src/pages/settings/airi-card/guided.vue'), 'utf8')
    const tools = readFileSync(resolve(workspaceRoot, 'packages/stage-pages/src/pages/settings/airi-card/components/tabs/CardCreationTabTools.vue'), 'utf8')
    const castAvatar = guided.match(/<!-- Cast avatars -->[\s\S]*?<!-- Next Action -->/)?.[0] ?? ''
    const modelAvatar = guided.match(/<!-- Avatar circle -->[\s\S]*?<!-- Voice display pill -->/)?.[0] ?? ''
    const toggleOpeningTag = (state: string) => {
      const clickMarker = `@click="${state} = !${state}"`
      const clickIndex = tools.indexOf(clickMarker)
      const buttonIndex = tools.lastIndexOf('<button', clickIndex)
      return tools.slice(buttonIndex, tools.indexOf('>', clickIndex) + 1)
    }

    expect(castAvatar).toContain('<button')
    expect(castAvatar).toContain(':aria-label="t(\'settings.pages.card.creation.guided.remove-character\', { name: char.name })"')
    expect(modelAvatar).toContain('<button')
    expect(modelAvatar).toContain(':aria-label="t(\'settings.pages.card.creation.guided.select-model-character\', { name: char.name })"')
    expect(toggleOpeningTag('selectedInjectDreamContext')).toContain(':aria-label="t(\'settings.pages.card.creation.tools-settings.dream-intrusion\')"')
    expect(toggleOpeningTag('selectedInjectJournalContext')).toContain(':aria-label="t(\'settings.pages.card.creation.tools-settings.journal-intrusion\')"')
    expect(toggleOpeningTag('selectedInjectArtistryContext')).toContain(':aria-label="t(\'settings.pages.card.creation.tools-settings.artistry-intrusion\')"')
  })

  it('keeps localized hover titles on every Live2D parameter reset control', () => {
    const source = readFileSync(resolve(workspaceRoot, 'packages/stage-ui/src/components/scenarios/settings/model-settings/live2d.vue'), 'utf8')
    const resetTitle = /:title="t\('settings\.model-settings\.common\.actions\.reset-parameter'/g
    const resetAria = /:aria-label="t\('settings\.model-settings\.common\.actions\.reset-parameter'/g

    expect(source.match(resetTitle)).toHaveLength(10)
    expect(source.match(resetAria)).toHaveLength(10)
  })
})

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

  it('does not retain unused Task 4 catalog leaves', () => {
    const unusedKeys = [
      'settings.model-settings.common.actions.show',
      'settings.model-settings.common.actions.hide',
      'settings.model-settings.common.actions.rename',
      'settings.model-settings.common.actions.add-to-idle-cycle',
      'settings.model-settings.common.actions.remove-from-idle-cycle',
      'settings.model-settings.common.actions.reset-value',
      'settings.model-settings.audio-studio.title',
      'settings.pages.card.creation.actions.save-changes',
      'settings.pages.card.creation.guided.select-model',
      'settings.pages.card.creation.guided.configure-voice',
    ]

    expect(unusedKeys.filter(key => key in english || key in chinese)).toEqual([])
  })
})

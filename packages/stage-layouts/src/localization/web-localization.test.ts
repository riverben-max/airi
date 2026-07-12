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
      't(`settings.dynamic.${suffix}`)',
      '$t(\'stage.valid\')',
    ].join('\n')

    expect(extractStaticTranslationKeys(source)).toEqual(['stage.valid'])
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
})

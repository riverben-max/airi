import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function read(relativePath: string): string {
  return readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8')
}

describe('header avatar account menu', () => {
  const source = read('./HeaderAvatar.vue')
  const enSettings = read('../../../../i18n/src/locales/en/settings.yaml')
  const zhHansSettings = read('../../../../i18n/src/locales/zh-Hans/settings.yaml')

  it('keeps the Flux balance and subscription entry discoverable', () => {
    expect(source).toContain('const { isAuthenticated, user, credits } = storeToRefs(authStore)')
    expect(source).toContain('const formattedCredits = computed(() => credits.value.toLocaleString())')
    expect(source).toContain('{{ formattedCredits }} Flux')
    expect(source).toContain('to="/settings/flux"')
  })

  it('uses localized account-menu and session feedback text', () => {
    expect(source).toContain('t(\'settings.pages.account.signedInAs\')')
    expect(source).toContain('t(\'settings.pages.account.activeSessions\')')
    expect(source).toContain('t(\'settings.pages.flux.title\')')
    expect(source).toContain('t(\'settings.title\')')
    expect(source).toContain('t(\'settings.pages.account.logout\')')
    expect(source).toContain('t(\'settings.pages.account.activeSessionsCount\', { count: sessions.length })')
    expect(source).toContain('t(\'settings.pages.account.sessionListErrorFallback\')')

    expect(source).not.toMatch(/>\s*(Signed in as|Active Sessions|Settings|Logout)\s*</)
    expect(source).not.toContain('You have ${sessions.length} active sessions.')
    expect(source).not.toContain('An unknown error occurred')
  })

  it('defines the new English and Simplified Chinese locale entries', () => {
    expect(enSettings).toContain('activeSessions: Active sessions')
    expect(enSettings).toContain('activeSessionsCount: \'You have {count} active sessions.\'')
    expect(enSettings).toContain('sessionListErrorFallback: Could not load active sessions.')

    expect(zhHansSettings).toContain('signedInAs: 已登录为')
    expect(zhHansSettings).toContain('activeSessions: 活跃会话')
    expect(zhHansSettings).toContain('activeSessionsCount: \'当前共有 {count} 个活跃会话。\'')
    expect(zhHansSettings).toContain('sessionListErrorFallback: 无法加载活跃会话，请稍后重试。')
  })
})

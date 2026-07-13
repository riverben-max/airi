import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

describe('chatArea voice popover', () => {
  it('renders the hearing popover through a portal above the chat surface', () => {
    const source = readFileSync(fileURLToPath(new URL('./ChatArea.vue', import.meta.url)), 'utf8')

    expect(source).toContain('PopoverPortal')
    expect(source).toMatch(/<PopoverPortal>\s*<PopoverContent[\s\S]*?<\/PopoverContent>\s*<\/PopoverPortal>/)
    expect(source).toContain('hearingPopoverLayerStyle')
    expect(source).toContain(':style="hearingPopoverLayerStyle"')
  })

  it('requests microphone permission when the hearing popover opens', () => {
    const source = readFileSync(fileURLToPath(new URL('./ChatArea.vue', import.meta.url)), 'utf8')

    expect(source).toContain('const settingsAudioDevice = useSettingsAudioDevice()')
    expect(source).toContain('storeToRefs(settingsAudioDevice)')
    expect(source).toMatch(/watch\(hearingPopoverOpen, async \(value\) => \{[\s\S]*?await settingsAudioDevice\.askPermission\(\)[\s\S]*?\}\)/)
  })
})

describe('dating sim chat panel', () => {
  it('uses a draggable, resizable desktop panel while dating sim is active', () => {
    const source = readFileSync(fileURLToPath(new URL('./ChatContainer.vue', import.meta.url)), 'utf8')

    expect(source).toContain('useDatingSimStore')
    expect(source).toContain('useDraggable')
    expect(source).toContain('isDatingSimDesktop')
    expect(source).toContain('chat-panel:dating-sim')
    expect(source).toContain('resize-handle')
    expect(source).toMatch(/watch\(isDatingSimDesktop, \(enabled\) => \{[\s\S]*?\}, \{ immediate: true \}\)/)
  })
})

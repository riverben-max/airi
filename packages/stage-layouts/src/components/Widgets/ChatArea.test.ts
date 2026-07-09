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
})

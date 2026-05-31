import { describe, expect, it } from 'vitest'

import { chunkTtsInput, processNarrative } from './tts-chunker'

describe('processNarrative', () => {
  it('should not strip narrative if stripNarrative is false', () => {
    const text = 'Hello [laughs] world'
    expect(processNarrative(text, { stripNarrative: false })).toBe(text)
    expect(processNarrative(text, {})).toBe(text)
  })

  it('should strip narrative if stripNarrative is true', () => {
    const text = 'Hello [laughs] world'
    expect(processNarrative(text, { stripNarrative: true })).toBe('Hello  world')
  })

  it('should keep narrative text if keepNarrativeText is true', () => {
    const text = 'Hello [laughs] world'
    expect(processNarrative(text, { stripNarrative: true, keepNarrativeText: true })).toBe('Hello laughs world')
  })

  it('should handle multiple brackets and types', () => {
    const text = 'Hi *waves* [smiling] (quietly)'
    expect(processNarrative(text, { stripNarrative: true, keepNarrativeText: false })).toBe('Hi   ')
    expect(processNarrative(text, { stripNarrative: true, keepNarrativeText: true })).toBe('Hi waves smiling quietly')
  })

  it('should handle CJK brackets', () => {
    const text = 'こんにちは（笑）【重要】'
    expect(processNarrative(text, { stripNarrative: true, keepNarrativeText: false })).toBe('こんにちは')
    expect(processNarrative(text, { stripNarrative: true, keepNarrativeText: true })).toBe('こんにちは笑重要')
  })

  it('should handle mixed bracket types with keepNarrativeText', () => {
    const text = 'Start <hidden> [box] (round) *star* End'
    expect(processNarrative(text, { stripNarrative: true, keepNarrativeText: true })).toBe('Start hidden box round star End')
  })
})

describe('chunkTtsInput', () => {
  it('should not split sentences on punctuation inside narrative brackets', async () => {
    const text = 'Hello *[she wheezes, slapping the table lightly]* how are you?'
    const chunks = []
    for await (const chunk of chunkTtsInput(text)) {
      chunks.push(chunk.text)
    }
    expect(chunks).toEqual(['Hello *[she wheezes, slapping the table lightly]* how are you?'])
  })
})

import { describe, expect, it } from 'vitest'

import { chunkTtsInput, TTS_SPECIAL_TOKEN } from './tts-chunker'

describe('tts-chunker', () => {
  it('should isolate special tokens from preceding text', async () => {
    const input = `Hello ${TTS_SPECIAL_TOKEN} how are you?`
    const chunks = []
    for await (const chunk of chunkTtsInput(input)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(3)
    // The preceding text is yielded as limit/hard
    expect(chunks[0]).toEqual({
      text: 'Hello',
      words: 1,
      reason: 'limit',
    })
    // The special token is yielded as its own empty chunk
    expect(chunks[1]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
    // The rest of the text is yielded
    expect(chunks[2]).toEqual({
      text: 'how are you?',
      words: 3,
      reason: 'hard',
    })
  })

  it('should handle special token with no preceding text', async () => {
    const input = `${TTS_SPECIAL_TOKEN}Hi`
    const chunks = []
    for await (const chunk of chunkTtsInput(input)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
    expect(chunks[1]).toEqual({
      text: 'Hi',
      words: 1,
      reason: 'flush',
    })
  })

  it('should handle consecutive special tokens cleanly', async () => {
    const input = `${TTS_SPECIAL_TOKEN}${TTS_SPECIAL_TOKEN}`
    const chunks = []
    for await (const chunk of chunkTtsInput(input)) {
      chunks.push(chunk)
    }

    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
    expect(chunks[1]).toEqual({
      text: '',
      words: 0,
      reason: 'special',
    })
  })
})

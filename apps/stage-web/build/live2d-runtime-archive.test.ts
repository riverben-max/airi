import JSZip from 'jszip'

import { describe, expect, it } from 'vitest'

import { createRuntimeOnlyLive2dArchive } from './live2d-runtime-archive'

describe('createRuntimeOnlyLive2dArchive', () => {
  it('removes Cubism editor sources and preserves every runtime reference', async () => {
    const source = new JSZip()
    source.file('model/runtime/model.model3.json', JSON.stringify({
      FileReferences: {
        Moc: 'model.moc3',
        Textures: ['textures/texture_00.png'],
        Physics: 'model.physics3.json',
        Motions: { Idle: [{ File: 'motions/idle.motion3.json' }] },
      },
    }))
    source.file('model/runtime/model.moc3', new Uint8Array([1]))
    source.file('model/runtime/textures/texture_00.png', new Uint8Array([2]))
    source.file('model/runtime/model.physics3.json', '{}')
    source.file('model/runtime/motions/idle.motion3.json', '{}')
    source.file('model/source.cmo3', new Uint8Array([3]))
    source.file('model/source.can3', new Uint8Array([4]))
    source.file('model/LICENSE.txt', 'license')

    const input = await source.generateAsync({ type: 'uint8array' })
    const output = await createRuntimeOnlyLive2dArchive(input)
    const runtime = await JSZip.loadAsync(output)

    expect(runtime.file(/\.cmo3$/i)).toHaveLength(0)
    expect(runtime.file(/\.can3$/i)).toHaveLength(0)
    expect(runtime.file('model/runtime/model.model3.json')).not.toBeNull()
    expect(runtime.file('model/runtime/model.moc3')).not.toBeNull()
    expect(runtime.file('model/runtime/textures/texture_00.png')).not.toBeNull()
    expect(runtime.file('model/LICENSE.txt')).not.toBeNull()
  })

  it('rejects an archive without a model3 manifest', async () => {
    const source = new JSZip()
    source.file('model/model.moc3', new Uint8Array([1]))
    const input = await source.generateAsync({ type: 'uint8array' })

    await expect(createRuntimeOnlyLive2dArchive(input)).rejects.toThrow('model3.json')
  })

  it('rejects an archive with a missing runtime reference', async () => {
    const source = new JSZip()
    source.file('model/model.model3.json', JSON.stringify({
      FileReferences: {
        Moc: 'missing.moc3',
        Textures: [],
      },
    }))
    const input = await source.generateAsync({ type: 'uint8array' })

    await expect(createRuntimeOnlyLive2dArchive(input)).rejects.toThrow('model/missing.moc3')
  })
})

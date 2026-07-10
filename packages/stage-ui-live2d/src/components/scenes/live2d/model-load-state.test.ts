import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('live2D model load state', () => {
  it('has one conditional mounted transition and one mutex release', () => {
    const source = readFileSync(new URL('./Model.vue', import.meta.url), 'utf8')
    const loadModel = source.slice(source.indexOf('async function loadModel()'), source.indexOf('async function setMotion('))

    expect(loadModel.match(/componentState\.value = 'mounted'/g)).toHaveLength(1)
    expect(loadModel.match(/modelLoadMutex\.release\(\)/g)).toHaveLength(1)
    expect(loadModel).toContain('if (loaded)\n      componentState.value = \'mounted\'')
    expect(loadModel).toContain('componentState.value = \'pending\'')
    expect(loadModel).toContain('throw new Error(\'No Live2D model source provided\')')
  })
})

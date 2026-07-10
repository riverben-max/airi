import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('spine model load state', () => {
  it('has one conditional mounted transition, one error emission, and one mutex release', () => {
    const source = readFileSync(new URL('./Model.vue', import.meta.url), 'utf8')
    const loadModel = source.slice(source.indexOf('async function loadModel()'), source.indexOf('/**\n * Plays'))

    expect(loadModel.match(/componentState\.value = 'mounted'/g)).toHaveLength(1)
    expect(loadModel.match(/modelLoadMutex\.release\(\)/g)).toHaveLength(1)
    expect(loadModel.match(/emits\('error'/g)).toHaveLength(1)
    expect(loadModel).toContain('if (loaded)\n      componentState.value = \'mounted\'')
    expect(loadModel).toContain('componentState.value = \'pending\'')
  })
})

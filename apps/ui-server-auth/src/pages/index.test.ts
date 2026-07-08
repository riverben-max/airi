// @vitest-environment jsdom
import { createApp } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import IndexPage from './index.vue'

describe('auth UI index route', () => {
  it('redirects the empty auth UI root to the profile page', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: IndexPage },
        { path: '/profile', component: { template: '<div />' } },
      ],
    })
    const replace = vi.spyOn(router, 'replace')
    const appRoot = document.createElement('div')
    document.body.append(appRoot)

    const app = createApp(IndexPage)
    app.use(router)
    app.mount(appRoot)

    expect(replace).toHaveBeenCalledWith('/profile')

    app.unmount()
    appRoot.remove()
  })
})

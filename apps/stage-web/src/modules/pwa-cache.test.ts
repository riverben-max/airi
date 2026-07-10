import { describe, expect, it } from 'vitest'

import { shouldCacheStageAsset, shouldCacheStageNavigation, stageWebWorkbox } from './pwa-cache'

describe('stageWebWorkbox', () => {
  it('does not precache product bundles', () => {
    expect(stageWebWorkbox.globPatterns).toEqual([])
    expect(stageWebWorkbox.navigateFallback).toBeNull()
    expect(stageWebWorkbox.cleanupOutdatedCaches).toBe(true)
  })

  it('uses NetworkFirst only for stage-web navigations', () => {
    const rule = stageWebWorkbox.runtimeCaching?.find(item => item.options?.cacheName === 'airi-pages-v1')
    expect(rule?.handler).toBe('NetworkFirst')

    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/settings' }, sameOrigin: true })).toBe(true)
    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/ui/sign-in' }, sameOrigin: true })).toBe(false)
    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/api/auth/get-session' }, sameOrigin: true })).toBe(false)
    expect(shouldCacheStageNavigation({ request: { mode: 'navigate' }, url: { pathname: '/auth/callback' }, sameOrigin: true })).toBe(false)
    expect(shouldCacheStageNavigation({ request: { mode: 'same-origin' }, url: { pathname: '/settings' }, sameOrigin: true })).toBe(false)
  })

  it('caches only requested same-origin assets', () => {
    const rule = stageWebWorkbox.runtimeCaching?.find(item => item.options?.cacheName === 'airi-assets-v1')
    expect(rule?.handler).toBe('CacheFirst')

    expect(shouldCacheStageAsset({ url: { pathname: '/assets/index-hash.js' }, sameOrigin: true })).toBe(true)
    expect(shouldCacheStageAsset({ url: { pathname: '/model.wasm' }, sameOrigin: false })).toBe(false)
  })
})

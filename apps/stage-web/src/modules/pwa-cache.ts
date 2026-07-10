import type { VitePWAOptions } from 'vite-plugin-pwa'

type WorkboxOptions = NonNullable<VitePWAOptions['workbox']>

interface StageNavigationRouteInput {
  request: Pick<Request, 'mode'>
  url: Pick<URL, 'pathname'>
  sameOrigin: boolean
}

interface StageAssetRouteInput {
  url: Pick<URL, 'pathname'>
  sameOrigin: boolean
}

export function shouldCacheStageNavigation({ request, url, sameOrigin }: StageNavigationRouteInput) {
  return sameOrigin
    && request.mode === 'navigate'
    && !url.pathname.startsWith('/docs/')
    && !url.pathname.startsWith('/ui/')
    && !url.pathname.startsWith('/remote-assets/')
    && !url.pathname.startsWith('/api/')
    && !url.pathname.startsWith('/auth/')
}

export function shouldCacheStageAsset({ url, sameOrigin }: StageAssetRouteInput) {
  return sameOrigin && url.pathname.startsWith('/assets/')
}

export const stageWebWorkbox = {
  cleanupOutdatedCaches: true,
  globPatterns: [],
  navigateFallback: null,
  runtimeCaching: [
    {
      urlPattern: shouldCacheStageNavigation,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'airi-pages-v1',
        networkTimeoutSeconds: 3,
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 4, maxAgeSeconds: 86400, purgeOnQuotaError: true },
      },
    },
    {
      urlPattern: shouldCacheStageAsset,
      handler: 'CacheFirst',
      options: {
        cacheName: 'airi-assets-v1',
        cacheableResponse: { statuses: [0, 200] },
        expiration: { maxEntries: 128, maxAgeSeconds: 2592000, purgeOnQuotaError: true },
      },
    },
  ],
} satisfies WorkboxOptions

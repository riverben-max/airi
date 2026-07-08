/**
 * Navigation URLs that must bypass the stage-web SPA fallback in the service worker.
 */
export const stageWebNavigateFallbackDenylist: RegExp[] = [
  /^\/docs\//,
  /^\/ui\//,
  /^\/remote-assets\//,
  /^\/api\//,
  /^\/auth\/(?!callback(?:[/?#]|$))/,
]

/**
 * Builds the standalone auth UI URL for historical stage-web auth entry routes.
 */
export function buildAuthUiSignInRedirectUrl(currentUrl: URL, apiServerUrl: string): URL {
  const redirectUrl = new URL('/ui/sign-in', currentUrl.origin)
  redirectUrl.search = currentUrl.search
  redirectUrl.hash = currentUrl.hash

  if (!redirectUrl.searchParams.has('api_server_url'))
    redirectUrl.searchParams.set('api_server_url', apiServerUrl)

  return redirectUrl
}

export interface ProviderSourceCard {
  id: string
  category: string
  to?: string
  icon?: string
  iconColor?: string
  iconImage?: string
  name?: string
  description?: string
  localizedName?: string
  localizedDescription?: string
  configured?: boolean
  pricing?: 'free' | 'paid'
  deployment?: 'local' | 'cloud'
  beginnerRecommended?: boolean
}

export interface ProviderSectionInput {
  id: string
  icon: string
  title: string
  description: string
  providers: ProviderSourceCard[]
}

export interface ProviderSection extends ProviderSectionInput {
  providers: Array<ProviderSourceCard & { renderIndex: number }>
}

const OFFICIAL_PROVIDER_IDS = new Set([
  'official-provider',
  'official-provider-speech',
  'official-provider-speech-streaming',
  'official-provider-transcription',
])

/**
 * Classifies provider cards that remain visible in the customer-facing build.
 *
 * The vision provider is derived from the chat provider metadata by prefixing
 * `vision-`, so it is intentionally handled by prefix instead of a single id.
 */
export function isOfficialProviderCard(provider: Pick<ProviderSourceCard, 'id'>): boolean {
  return OFFICIAL_PROVIDER_IDS.has(provider.id) || provider.id.startsWith('vision-official-provider')
}

export function buildOfficialProviderSections(sections: ProviderSectionInput[]): ProviderSection[] {
  let renderIndex = 0

  return sections
    .map((section) => {
      const providers = section.providers
        .filter(isOfficialProviderCard)
        .map(provider => ({
          ...provider,
          renderIndex: renderIndex++,
        }))

      return {
        ...section,
        providers,
      }
    })
    .filter(section => section.providers.length > 0)
}

export function isSupportedProviderSettingsRoute(category: string, providerId: string): boolean {
  if (category === 'chat')
    return providerId === 'official-provider'

  if (category === 'vision')
    return providerId === 'official-provider'

  return false
}

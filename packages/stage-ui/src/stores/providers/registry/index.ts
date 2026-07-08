import type { ComposerTranslation } from 'vue-i18n'

import type { ProviderMetadata } from '../types'

import { listProviders as listDefinedProviders } from '../../../libs/providers'
import { convertProviderDefinitionsToMetadata } from '../converters'

export function createProviderRegistry(
  t: ComposerTranslation,
  currentMetadata: Record<string, ProviderMetadata>,
): Record<string, ProviderMetadata> {
  const translatedProviderMetadata = convertProviderDefinitionsToMetadata(
    listDefinedProviders(),
    t,
    currentMetadata,
  )

  return {
    ...currentMetadata,
    ...translatedProviderMetadata,
  }
}

import type { BillableModelCapability } from '../../schemas/provider-catalog'
import type { ProviderCatalogService } from '../../services/domain/provider-catalog'
import type { HonoEnv } from '../../types/hono'

import { Hono } from 'hono'

import { authGuard } from '../../middlewares/auth'
import { createBadRequestError } from '../../utils/error'

const BILLABLE_MODEL_CAPABILITIES = new Set<BillableModelCapability>([
  'chat',
  'tts',
  'image',
  'transcription',
])

function parseCapability(value: string | undefined): BillableModelCapability | undefined {
  if (value == null || value === '')
    return undefined
  if (BILLABLE_MODEL_CAPABILITIES.has(value as BillableModelCapability))
    return value as BillableModelCapability
  throw createBadRequestError('Invalid model capability', 'INVALID_MODEL_CAPABILITY', { capability: value })
}

/**
 * Public authenticated model catalog for product clients.
 *
 * It exposes only enabled, priced billable models. Admin-only fields and
 * disabled/unpriced drafts remain behind `/api/admin/provider-catalog/models`.
 */
export function createModelCatalogRoutes(providerCatalogService: ProviderCatalogService) {
  return new Hono<HonoEnv>()
    .use('*', authGuard)
    .get('/', async (c) => {
      const capability = parseCapability(c.req.query('capability'))
      const rows = await providerCatalogService.listBillableModels(capability)
      const models = rows
        .filter(row => row.enabled && row.priceEnabled && row.fluxPerCall != null)
        .map(row => ({
          id: row.routerModelId,
          name: row.displayName,
          capability: row.capability,
          fluxPerCall: row.fluxPerCall!,
        }))

      return c.json({ models })
    })
}

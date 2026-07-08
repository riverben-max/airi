import type { ConfigKVService } from '../../services/adapters/config-kv'
import type { BillingService } from '../../services/domain/billing/billing-service'
import type { FluxService } from '../../services/domain/flux'
import type { ProductEventService } from '../../services/domain/product-events'
import type { ProviderCatalogService } from '../../services/domain/provider-catalog'
import type { RequestLogService } from '../../services/domain/request-log'
import type { EnvelopeCrypto } from '../../utils/envelope-crypto'

/**
 * Dependencies required by the streaming speech websocket proxy.
 */
export interface AudioSpeechWsHandlersOptions {
  /** Reads upstream websocket URL and encrypted API keys. */
  configKV: ConfigKVService
  /** Decrypts the selected upstream API key before the websocket handshake. */
  envelopeCrypto: EnvelopeCrypto
  /** Reads the user's current Flux balance for pre-flight and final billing. */
  fluxService: FluxService
  /** Debits the fixed Flux amount for successful streaming TTS sessions. */
  billingService: BillingService
  /** Validates model/voice catalog gates and resolves fixed per-model Flux prices. */
  providerCatalogService: ProviderCatalogService
  /** Persists request accounting after a stream finishes. */
  requestLogService: RequestLogService
  /** Writes first-party product analytics for distinct-user aggregation. */
  productEventService: ProductEventService
}

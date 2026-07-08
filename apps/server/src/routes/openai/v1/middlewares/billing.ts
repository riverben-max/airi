import type { RevenueMetrics } from '../../../../otel'
import type { ConfigKVService } from '../../../../services/adapters/config-kv'
import type { UsageInfo } from '../../../../services/domain/billing/billing'
import type { BillingService } from '../../../../services/domain/billing/billing-service'
import type { FluxMeter } from '../../../../services/domain/billing/flux-meter'
import type { FluxService } from '../../../../services/domain/flux'
import type { ProviderCatalogService } from '../../../../services/domain/provider-catalog'

import { createPaymentRequiredError } from '../../../../utils/error'
import { GEN_AI_ATTR_REQUEST_MODEL } from '../../../../utils/observability'

export interface ChatFluxDebitInput extends UsageInfo {
  billingService: BillingService
  revenue?: RevenueMetrics | null
  userId: string
  requestId: string
  model: string
  amount: number
  pricingSource?: ChatBillingPolicy['pricingSource']
  stage: 'streaming' | 'non_streaming'
  logger: {
    withFields: (fields: Record<string, unknown>) => {
      warn: (message: string) => void
    }
  }
}

export interface ChatBillingPolicy {
  fixedRate: number
  modelRates: Record<string, number>
  pricingSource: 'model_catalog' | 'config_fallback' | 'mixed'
}

export interface TtsBillingAuthorization {
  balance: number
  inputChars: number
}

export interface OpenAiRouteBilling {
  authorizeChat: (userId: string, model: string | string[]) => Promise<ChatBillingPolicy>
  authorizeTts: (userId: string, inputText: string) => Promise<TtsBillingAuthorization>
  priceChatUsage: (usage: UsageInfo, policy: ChatBillingPolicy, model: string) => number
  recordChatDebitFailure: (input: {
    amount: number
    model: string
    stage: 'streaming' | 'non_streaming'
  }) => void
  settleChat: (input: Omit<ChatFluxDebitInput, 'billingService' | 'revenue'>) => Promise<number>
  settleTts: (input: {
    userId: string
    inputText: string
    currentBalance: number
    requestId: string
    model: string
  }) => Promise<{ fluxDebited: number }>
}

export function createOpenAiRouteBilling(deps: {
  billingService: BillingService
  configKV: ConfigKVService
  fluxService: FluxService
  providerCatalogService: ProviderCatalogService
  revenue?: RevenueMetrics | null
  ttsMeter: FluxMeter
}): OpenAiRouteBilling {
  // NOTICE: Customer billing policy for this commercial track is fixed
  // Flux-per-call pricing per model/capability. Model catalog pricing is the
  // preferred source. The config fallback keeps existing deployments working
  // until admins seed per-model prices for every router model. Usage/token
  // fields from upstream responses are recorded only as observability metadata
  // and never influence the charged amount.
  async function authorizeChat(userId: string, model: string | string[]): Promise<ChatBillingPolicy> {
    const models = Array.isArray(model) ? Array.from(new Set(model)) : [model]
    const configFallbackRate = await deps.configKV.getOrThrow('FLUX_PER_REQUEST')
    const modelRates: Record<string, number> = {}
    let catalogPricedCount = 0

    for (const routerModelId of models) {
      const catalogPrice = await deps.providerCatalogService.getFixedModelPrice({
        capability: 'chat',
        routerModelId,
      })
      if (catalogPrice != null)
        catalogPricedCount += 1
      modelRates[routerModelId] = catalogPrice ?? configFallbackRate
    }

    const fixedRate = Math.max(...Object.values(modelRates))
    const flux = await deps.fluxService.getFlux(userId)
    if (flux.flux < fixedRate) {
      throw createPaymentRequiredError('Insufficient flux')
    }

    const pricingSource = catalogPricedCount === models.length
      ? 'model_catalog'
      : catalogPricedCount === 0
        ? 'config_fallback'
        : 'mixed'

    return { fixedRate, modelRates, pricingSource }
  }

  function priceChatUsage(_usage: UsageInfo, policy: ChatBillingPolicy, model: string): number {
    return policy.modelRates[model] ?? policy.fixedRate
  }

  async function settleChat(input: Omit<ChatFluxDebitInput, 'billingService' | 'revenue'>): Promise<number> {
    return debitChatFlux({
      ...input,
      billingService: deps.billingService,
      revenue: deps.revenue,
    })
  }

  function recordChatDebitFailure(input: {
    amount: number
    model: string
    stage: 'streaming' | 'non_streaming'
  }): void {
    deps.revenue?.fluxUnbilled.add(input.amount, {
      [GEN_AI_ATTR_REQUEST_MODEL]: input.model,
      reason: 'debit_failed',
      stage: input.stage,
    })
  }

  async function authorizeTts(userId: string, inputText: string): Promise<TtsBillingAuthorization> {
    const ttsPerRequest = await deps.configKV.getOrThrow('TTS_FLUX_PER_REQUEST')
    const flux = await deps.fluxService.getFlux(userId)
    if (flux.flux < ttsPerRequest) {
      throw createPaymentRequiredError('Insufficient flux')
    }

    return { balance: flux.flux, inputChars: inputText.length }
  }

  async function settleTts(input: {
    userId: string
    inputText: string
    currentBalance: number
    requestId: string
    model: string
  }) {
    const ttsPerRequest = await deps.configKV.getOrThrow('TTS_FLUX_PER_REQUEST')
    const result = await deps.billingService.consumeFluxForLLM({
      userId: input.userId,
      amount: ttsPerRequest,
      requestId: input.requestId,
      description: 'tts_request',
      model: input.model,
      capability: 'tts',
    })

    return { fluxDebited: result.charged }
  }

  return { authorizeChat, authorizeTts, priceChatUsage, recordChatDebitFailure, settleChat, settleTts }
}

export async function debitChatFlux(input: ChatFluxDebitInput): Promise<number> {
  const result = await input.billingService.consumeFluxForLLM({
    userId: input.userId,
    amount: input.amount,
    requestId: input.requestId,
    description: 'llm_request',
    model: input.model,
    capability: 'chat',
    pricingSource: input.pricingSource,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
  })

  if (result.charged < result.requested) {
    input.revenue?.fluxUnbilled.add(result.requested - result.charged, {
      [GEN_AI_ATTR_REQUEST_MODEL]: input.model,
      reason: 'partial_debit_drained',
      stage: input.stage,
    })
    input.logger.withFields({
      userId: input.userId,
      requestId: input.requestId,
      requested: result.requested,
      charged: result.charged,
      unbilled: result.requested - result.charged,
    }).warn(input.stage === 'streaming'
      ? 'Partial debit after streaming — flux drained to zero'
      : 'Partial debit on non-streaming completion — flux drained to zero')
  }

  return result.charged
}

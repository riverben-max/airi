import type { Buffer } from 'node:buffer'

import type { Context } from 'hono'

import type { ConfigKVService } from '../../services/adapters/config-kv'
import type { BillingService } from '../../services/domain/billing/billing-service'
import type { FluxService } from '../../services/domain/flux'
import type { ProviderCatalogService } from '../../services/domain/provider-catalog'
import type { HonoEnv } from '../../types/hono'
import type { EnvelopeCrypto } from '../../utils/envelope-crypto'

import { errorMessageFrom } from '@moeru/std'
import { Hono } from 'hono'

import { authGuard } from '../../middlewares/auth'
import { createKeyRotator } from '../../services/domain/llm-router/key-rotator'
import {
  createBadGatewayError,
  createBadRequestError,
  createPaymentRequiredError,
  createServiceUnavailableError,
} from '../../utils/error'
import { nanoid } from '../../utils/id'

interface ImageGenerationRouteDeps {
  billingService: BillingService
  configKV: ConfigKVService
  envelopeCrypto: EnvelopeCrypto
  fluxService: FluxService
  providerCatalogService: ProviderCatalogService
}

interface ImageGenerationBody extends Record<string, unknown> {
  model?: string
  prompt: string
  n?: number
  size?: string
  response_format?: string
}

interface ImageGenerationUpstream {
  baseURL: string
  overrideModel?: string
  keys: Array<{ id: string, ciphertext: string }>
  headerTemplate: string
  timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(c: Context<HonoEnv>): Promise<unknown> {
  try {
    return await c.req.json()
  }
  catch {
    throw createBadRequestError('Request body must be valid JSON', 'INVALID_JSON')
  }
}

function parseImageGenerationBody(raw: unknown): ImageGenerationBody {
  if (!isRecord(raw))
    throw createBadRequestError('Image generation request body must be a JSON object', 'INVALID_IMAGE_GENERATION_BODY')

  const prompt = raw.prompt
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw createBadRequestError('prompt is required', 'PROMPT_REQUIRED')
  }

  if (raw.model != null && (typeof raw.model !== 'string' || raw.model.trim().length === 0)) {
    throw createBadRequestError('model must be a non-empty string when provided', 'INVALID_MODEL')
  }

  if (raw.n != null) {
    if (typeof raw.n !== 'number' || !Number.isInteger(raw.n))
      throw createBadRequestError('n must be an integer when provided', 'INVALID_N')

    if (raw.n !== 1) {
      throw createBadRequestError(
        'Image generation MVP supports n=1 only',
        'IMAGE_GENERATION_N_NOT_SUPPORTED',
        { n: raw.n },
      )
    }
  }

  if (raw.size != null && typeof raw.size !== 'string')
    throw createBadRequestError('size must be a string when provided', 'INVALID_SIZE')

  if (raw.response_format != null && typeof raw.response_format !== 'string')
    throw createBadRequestError('response_format must be a string when provided', 'INVALID_RESPONSE_FORMAT')

  return raw as ImageGenerationBody
}

async function resolveImageModel(input: {
  body: ImageGenerationBody
  configKV: ConfigKVService
}): Promise<string> {
  const requestedModel = input.body.model?.trim()
  if (requestedModel)
    return requestedModel

  return await input.configKV.getOrThrow('DEFAULT_IMAGE_MODEL')
}

async function resolveImageUpstream(input: {
  configKV: ConfigKVService
  model: string
}): Promise<ImageGenerationUpstream> {
  const config = await input.configKV.getOrThrow('IMAGE_ROUTER_CONFIG')
  const upstream = config.image.models[input.model]?.upstream
  if (!upstream) {
    throw createServiceUnavailableError(
      'Image generation model is not configured in IMAGE_ROUTER_CONFIG',
      'CONFIG_NOT_SET',
      { model: input.model },
    )
  }

  return upstream
}

function normalizeImagesGenerationURL(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/images/generations`
}

function renderAuthHeader(headerTemplate: string, plaintextKey: Buffer): string {
  return headerTemplate.replace('{KEY}', plaintextKey.toString('utf8'))
}

async function callOpenAICompatibleImageUpstream(input: {
  body: ImageGenerationBody
  envelopeCrypto: EnvelopeCrypto
  model: string
  upstream: ImageGenerationUpstream
  abortSignal: AbortSignal
}): Promise<unknown> {
  const keyEntry = input.upstream.keys[0]
  if (!keyEntry) {
    throw createServiceUnavailableError(
      'Image generation upstream has no key entries',
      'CONFIG_NOT_SET',
      { model: input.model },
    )
  }

  const keyIterator = createKeyRotator(input.upstream, input.envelopeCrypto, input.model, null, 'image')[Symbol.iterator]()
  const rotatedKey = keyIterator.next()
  if (rotatedKey.done) {
    throw createServiceUnavailableError(
      'Image generation upstream has no decryptable key entries',
      'CONFIG_NOT_SET',
      { model: input.model },
    )
  }
  const plaintextKey = rotatedKey.value.plaintext

  try {
    const effectiveModel = input.upstream.overrideModel ?? input.model
    let response: Response
    try {
      response = await fetch(normalizeImagesGenerationURL(input.upstream.baseURL), {
        method: 'POST',
        headers: {
          'authorization': renderAuthHeader(input.upstream.headerTemplate, plaintextKey),
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ...input.body, model: effectiveModel, n: 1 }),
        signal: input.abortSignal,
      })
    }
    catch (error) {
      throw createBadGatewayError(
        'Image generation upstream request failed',
        { message: errorMessageFrom(error) ?? 'Unknown upstream fetch error' },
      )
    }

    const responseText = await response.text()
    let payload: unknown
    try {
      payload = responseText.length > 0 ? JSON.parse(responseText) : {}
    }
    catch (error) {
      throw createBadGatewayError(
        'Image generation upstream returned invalid JSON',
        { status: response.status, message: errorMessageFrom(error) ?? 'Unknown JSON parse error' },
      )
    }

    if (!response.ok) {
      throw createBadGatewayError(
        'Image generation upstream request failed',
        { status: response.status },
      )
    }

    return payload
  }
  finally {
    plaintextKey.fill(0)
  }
}

/**
 * Creates the official image generation gateway routes.
 *
 * NOTICE:
 * This is the commercial subscription track's official image gateway MVP.
 * Runtime request shape differences such as size, quality, and prompt length do
 * not change billing here; operators should expose separate catalog models when
 * those dimensions need different fixed Flux-per-call prices.
 */
export function createImageGenerationRoutes(deps: ImageGenerationRouteDeps) {
  const app = new Hono<HonoEnv>()

  app.use('*', authGuard)

  app.post('/generations', async (c) => {
    const user = c.get('user')!
    const body = parseImageGenerationBody(await readJson(c))
    const model = await resolveImageModel({ body, configKV: deps.configKV })

    const fluxPerCall = await deps.providerCatalogService.getFixedModelPrice({
      capability: 'image',
      routerModelId: model,
    })
    if (fluxPerCall == null) {
      throw createServiceUnavailableError(
        'Image generation model is not priced in the model catalog',
        'MODEL_PRICE_NOT_CONFIGURED',
        { capability: 'image', routerModelId: model },
      )
    }

    const flux = await deps.fluxService.getFlux(user.id)
    if (flux.flux < fluxPerCall)
      throw createPaymentRequiredError('Insufficient flux')

    const upstream = await resolveImageUpstream({
      configKV: deps.configKV,
      model,
    })
    const payload = await callOpenAICompatibleImageUpstream({
      body,
      envelopeCrypto: deps.envelopeCrypto,
      model,
      upstream,
      abortSignal: c.req.raw.signal,
    })

    await deps.billingService.consumeFluxForLLM({
      userId: user.id,
      amount: fluxPerCall,
      requestId: nanoid(),
      description: 'image_generation_request',
      model,
      capability: 'image',
      pricingSource: 'model_catalog',
    })

    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
    })
  })

  return app
}

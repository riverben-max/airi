import { client } from '@proj-airi/stage-ui/composables/api'
import { authedFetch } from '@proj-airi/stage-ui/libs/auth-fetch'
import { SERVER_URL } from '@proj-airi/stage-ui/libs/server'

export type AdminCapability = 'chat' | 'tts' | 'image' | 'transcription'
export type AdminCapabilityAliasSurface = 'llm' | 'asr'
export type OfficialGatewayProviderKind = 'openai-compatible' | 'openrouter'

export interface AdminUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string | null
  banned: boolean | null
  banReason: string | null
  banExpires: string | null
  createdAt: string
  updatedAt: string
  flux: number
  stripeCustomerId: string | null
}

export interface FluxTransaction {
  id: string
  type: string
  amount: number
  balanceBefore: number
  balanceAfter: number
  description: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface AdminUserDetail extends AdminUser {
  recentFluxTransactions: FluxTransaction[]
}

export interface AdminModel {
  id: string
  capability: AdminCapability
  routerModelId: string
  displayName: string
  enabled: boolean
  displayOrder: number
  fluxPerCall: number | null
  priceEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminSubscriptionPlan {
  id: string
  name: string
  description: string | null
  enabled: boolean
  displayOrder: number
  periodDays: number
  amountFen: number
  fluxAmount: number
  createdAt: string
  updatedAt: string
}

export interface AdminRouterConfigLlmSlice {
  kind: OfficialGatewayProviderKind | 'bedrock'
  modelName: string
  overrideModel: string
  plaintextKey?: string
  baseURL?: string
  keyEntryId?: string
  existingKeyEntryId?: string
  headerTemplate?: string
}

export type AdminRouterConfigSlice = AdminRouterConfigLlmSlice | Record<string, unknown>

export interface AdminRouterConfigDefaults {
  chatModel?: string
  ttsModel?: string
  ttsVoices?: Record<string, Record<string, string>>
}

export interface AdminRouterConfigCurrent {
  request: {
    mode: 'merge'
    slices: AdminRouterConfigSlice[]
    defaults: AdminRouterConfigDefaults
  }
  preview: Record<string, unknown>
  loadedAt: string
  missingKeys: string[]
}

export interface AdminRouterConfigApplyInput {
  mode?: 'merge' | 'reset'
  dryRun?: boolean
  slices?: AdminRouterConfigSlice[]
  defaults?: AdminRouterConfigDefaults
}

export interface AdminRouterConfigAppliedSummary {
  kind: string
  target: 'llm-router' | 'unspeech'
  surface?: AdminCapabilityAliasSurface | 'tts'
  modelName?: string
  keyEntryId: string | null
}

export interface AdminRouterConfigApplyResult {
  applied: AdminRouterConfigAppliedSummary[]
  invalidatedKeys: string[]
  preview: Record<string, unknown>
}

export interface AdminCapabilityAlias {
  id: string
  surface: AdminCapabilityAliasSurface
  aliasId: string
  displayName: string
  enabled: boolean
  displayOrder: number
  fallbackEnabled: boolean
  loadBalancingEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface ListUsersInput {
  query?: string
  page?: number
  pageSize?: number
  status?: string
}

export interface ListUsersResult {
  users: AdminUser[]
  hasMore: boolean
  nextOffset: number | null
  total: number
}

export interface FluxAdjustmentResult {
  balanceBefore: number
  balanceAfter: number
  fluxTransactionId: string
  changed?: boolean
  idempotent?: boolean
}

export interface AdminModelInput {
  capability: AdminCapability
  routerModelId: string
  displayName?: string
  enabled?: boolean
  displayOrder?: number
  fluxPerCall: number
  priceEnabled?: boolean
}

export type AdminModelUpdateInput = Partial<AdminModelInput>

export interface AdminSubscriptionPlanInput {
  id: string
  name: string
  description?: string | null
  enabled?: boolean
  displayOrder?: number
  periodDays: number
  amountFen: number
  fluxAmount: number
}

export type AdminSubscriptionPlanUpdateInput = Partial<Omit<AdminSubscriptionPlanInput, 'id'>>

export interface OfficialChatGatewayInput {
  providerKind: OfficialGatewayProviderKind
  routerModelId: string
  upstreamModel: string
  baseURL: string
  apiKey?: string
  keyEntryId?: string
  existingKeyEntryId?: string
  displayName: string
  fluxPerCall: number
  setAsDefault: boolean
  enabled: boolean
  priceEnabled: boolean
}

export interface ApplyOfficialChatGatewayResult {
  routerConfig: AdminRouterConfigApplyResult
  aliases: AdminCapabilityAlias[]
  model: AdminModel
}

export interface GrantUserFluxInput {
  amount: number
  description?: string
}

export interface SetUserFluxInput {
  balance: number
  description?: string
}

interface RequestOptions {
  init: { signal: AbortSignal }
}

interface JsonResponse<T> {
  json: () => Promise<T>
  ok: boolean
  status: number
  text: () => Promise<string>
}

export interface AdminRemoteClient {
  api: {
    admin: {
      'users': {
        '$get': (params: { query: Record<string, string> }, options?: RequestOptions) => Promise<JsonResponse<ListUsersResult>>
        ':id': {
          $get: (params: { param: { id: string } }, options?: RequestOptions) => Promise<JsonResponse<{
            user: AdminUser
            recentFluxTransactions: FluxTransaction[]
          }>>
          flux: {
            $patch: (params: { param: { id: string }, json: { balance: number, description?: string } }, options?: RequestOptions) => Promise<JsonResponse<FluxAdjustmentResult>>
            grant: {
              $post: (params: { param: { id: string }, json: { amount: number, description: string } }, options?: RequestOptions) => Promise<JsonResponse<FluxAdjustmentResult>>
            }
          }
        }
      }
      'provider-catalog': {
        models: {
          '$get': (params?: undefined, options?: RequestOptions) => Promise<JsonResponse<AdminModel[]>>
          '$post': (params: { json: AdminModelInput }, options?: RequestOptions) => Promise<JsonResponse<AdminModel>>
          ':id': {
            $patch: (params: { param: { id: string }, json: AdminModelUpdateInput }, options?: RequestOptions) => Promise<JsonResponse<AdminModel>>
            $delete: (params: { param: { id: string } }, options?: RequestOptions) => Promise<JsonResponse<AdminModel>>
          }
        }
      }
      'config': {
        router: {
          $get: (params?: undefined, options?: RequestOptions) => Promise<JsonResponse<AdminRouterConfigCurrent>>
          $post: (params: { json: AdminRouterConfigApplyInput }, options?: RequestOptions) => Promise<JsonResponse<AdminRouterConfigApplyResult>>
        }
      }
      'capability-aliases': {
        sync: {
          $post: (params: { json: { surface: AdminCapabilityAliasSurface } }, options?: RequestOptions) => Promise<JsonResponse<{ aliases: AdminCapabilityAlias[] }>>
        }
      }
      'subscriptions': {
        plans: {
          '$get': (params?: undefined, options?: RequestOptions) => Promise<JsonResponse<{ plans: AdminSubscriptionPlan[] }>>
          '$post': (params: { json: AdminSubscriptionPlanInput }, options?: RequestOptions) => Promise<JsonResponse<{ plan: AdminSubscriptionPlan }>>
          'defaults': {
            $post: (params?: undefined, options?: RequestOptions) => Promise<JsonResponse<{
              plans: AdminSubscriptionPlan[]
              createdPlanIds: string[]
            }>>
          }
          ':id': {
            $patch: (params: { param: { id: string }, json: AdminSubscriptionPlanUpdateInput }, options?: RequestOptions) => Promise<JsonResponse<{ plan: AdminSubscriptionPlan }>>
            $delete: (params: { param: { id: string } }, options?: RequestOptions) => Promise<JsonResponse<{ plan: AdminSubscriptionPlan }>>
          }
        }
      }
    }
  }
}

function trimmedOrUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function officialChatGatewaySlice(input: OfficialChatGatewayInput): AdminRouterConfigLlmSlice {
  const plaintextKey = trimmedOrUndefined(input.apiKey)
  const keyEntryId = trimmedOrUndefined(input.keyEntryId)
  const existingKeyEntryId = trimmedOrUndefined(input.existingKeyEntryId) ?? keyEntryId

  return {
    kind: input.providerKind,
    modelName: input.routerModelId.trim(),
    overrideModel: input.upstreamModel.trim(),
    baseURL: input.baseURL.trim(),
    ...(plaintextKey ? { plaintextKey } : {}),
    ...(plaintextKey && keyEntryId ? { keyEntryId } : {}),
    ...(!plaintextKey && existingKeyEntryId ? { existingKeyEntryId } : {}),
  }
}

const adminClient = client as AdminRemoteClient

function requestOptions(signal?: AbortSignal): RequestOptions | undefined {
  return signal ? { init: { signal } } : undefined
}

async function readJson<T>(response: JsonResponse<T>, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `${fallbackMessage} (${response.status})`)
  }

  return await response.json()
}

async function postAuthAdmin(path: '/api/auth/admin/ban-user' | '/api/auth/admin/unban-user', body: Record<string, string | number>): Promise<void> {
  const response = await authedFetch(new URL(path, SERVER_URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(text || `Admin auth request failed (${response.status})`)
  }
}

export async function listUsers(input: ListUsersInput = {}, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<ListUsersResult> {
  const pageSize = input.pageSize ?? 20
  const page = Math.max(1, input.page ?? 1)
  const query: Record<string, string> = {
    limit: String(pageSize),
    offset: String((page - 1) * pageSize),
  }

  if (input.query)
    query.query = input.query
  if (input.status)
    query.status = input.status

  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.users.$get({ query }, options)
    : await remoteClient.api.admin.users.$get({ query })
  return await readJson(response, 'Failed to list admin users')
}

export async function getUser(userId: string, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminUserDetail> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.users[':id'].$get({ param: { id: userId } }, options)
    : await remoteClient.api.admin.users[':id'].$get({ param: { id: userId } })
  const data = await readJson(response, 'Failed to get admin user')
  return {
    ...data.user,
    recentFluxTransactions: data.recentFluxTransactions,
  }
}

export async function setUserFlux(userId: string, fluxBalance: number, remoteClient?: AdminRemoteClient, signal?: AbortSignal): Promise<FluxAdjustmentResult>
export async function setUserFlux(userId: string, input: SetUserFluxInput, remoteClient?: AdminRemoteClient, signal?: AbortSignal): Promise<FluxAdjustmentResult>
export async function setUserFlux(userId: string, input: number | SetUserFluxInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<FluxAdjustmentResult> {
  const payload = typeof input === 'number'
    ? { balance: input }
    : {
        balance: input.balance,
        ...(input.description == null ? {} : { description: input.description }),
      }
  const params = {
    param: { id: userId },
    json: payload,
  }
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.users[':id'].flux.$patch(params, options)
    : await remoteClient.api.admin.users[':id'].flux.$patch(params)
  return await readJson(response, 'Failed to set user Flux')
}

export async function grantUserFlux(userId: string, amount: number, reason?: string, remoteClient?: AdminRemoteClient, signal?: AbortSignal): Promise<FluxAdjustmentResult>
export async function grantUserFlux(userId: string, input: GrantUserFluxInput, remoteClient?: AdminRemoteClient, signal?: AbortSignal): Promise<FluxAdjustmentResult>
export async function grantUserFlux(userId: string, input: number | GrantUserFluxInput, reasonOrClient: string | AdminRemoteClient = 'Admin Flux grant', remoteClientOrSignal: AdminRemoteClient | AbortSignal = adminClient, signal?: AbortSignal): Promise<FluxAdjustmentResult> {
  const amount = typeof input === 'number' ? input : input.amount
  const description = typeof input === 'number'
    ? (typeof reasonOrClient === 'string' ? reasonOrClient : 'Admin Flux grant')
    : input.description ?? 'Admin Flux grant'
  const remoteClient = typeof reasonOrClient === 'string'
    ? remoteClientOrSignal as AdminRemoteClient
    : reasonOrClient
  const effectiveSignal = remoteClientOrSignal instanceof AbortSignal ? remoteClientOrSignal : signal
  const params = {
    param: { id: userId },
    json: { amount, description },
  }
  const options = requestOptions(effectiveSignal)
  const response = options
    ? await remoteClient.api.admin.users[':id'].flux.grant.$post(params, options)
    : await remoteClient.api.admin.users[':id'].flux.grant.$post(params)
  return await readJson(response, 'Failed to grant user Flux')
}

export async function banUser(userId: string, banReason = 'Admin ban', banExpiresIn?: number): Promise<void> {
  await postAuthAdmin('/api/auth/admin/ban-user', {
    userId,
    banReason,
    ...(banExpiresIn == null ? {} : { banExpiresIn }),
  })
}

export async function unbanUser(userId: string): Promise<void> {
  await postAuthAdmin('/api/auth/admin/unban-user', { userId })
}

export async function listModels(remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminModel[]> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin['provider-catalog'].models.$get(undefined, options)
    : await remoteClient.api.admin['provider-catalog'].models.$get()
  return await readJson(response, 'Failed to list admin models')
}

export async function createModel(input: AdminModelInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminModel> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin['provider-catalog'].models.$post({ json: input }, options)
    : await remoteClient.api.admin['provider-catalog'].models.$post({ json: input })
  return await readJson(response, 'Failed to create admin model')
}

export async function updateModel(id: string, input: AdminModelUpdateInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminModel> {
  const params = {
    param: { id },
    json: input,
  }
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin['provider-catalog'].models[':id'].$patch(params, options)
    : await remoteClient.api.admin['provider-catalog'].models[':id'].$patch(params)
  return await readJson(response, 'Failed to update admin model')
}

export async function disableModel(id: string, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminModel> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin['provider-catalog'].models[':id'].$delete({ param: { id } }, options)
    : await remoteClient.api.admin['provider-catalog'].models[':id'].$delete({ param: { id } })
  return await readJson(response, 'Failed to disable admin model')
}

export async function getRouterConfig(remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminRouterConfigCurrent> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.config.router.$get(undefined, options)
    : await remoteClient.api.admin.config.router.$get()
  return await readJson(response, 'Failed to get admin router config')
}

export async function applyRouterConfig(input: AdminRouterConfigApplyInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminRouterConfigApplyResult> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.config.router.$post({ json: input }, options)
    : await remoteClient.api.admin.config.router.$post({ json: input })
  return await readJson(response, 'Failed to apply admin router config')
}

export async function syncCapabilityAliases(surface: AdminCapabilityAliasSurface, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminCapabilityAlias[]> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin['capability-aliases'].sync.$post({ json: { surface } }, options)
    : await remoteClient.api.admin['capability-aliases'].sync.$post({ json: { surface } })
  const data = await readJson(response, 'Failed to sync admin capability aliases')
  return data.aliases
}

export async function applyOfficialChatGateway(input: OfficialChatGatewayInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<ApplyOfficialChatGatewayResult> {
  const routerConfig = await applyRouterConfig({
    mode: 'merge',
    dryRun: false,
    slices: [officialChatGatewaySlice(input)],
    ...(input.setAsDefault ? { defaults: { chatModel: input.routerModelId.trim() } } : {}),
  }, remoteClient, signal)
  const aliases = await syncCapabilityAliases('llm', remoteClient, signal)
  const model = await createModel({
    capability: 'chat',
    routerModelId: input.routerModelId.trim(),
    displayName: input.displayName.trim() || input.routerModelId.trim(),
    fluxPerCall: input.fluxPerCall,
    enabled: input.enabled,
    priceEnabled: input.priceEnabled,
  }, remoteClient, signal)

  return {
    routerConfig,
    aliases,
    model,
  }
}

export async function listPlans(remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminSubscriptionPlan[]> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.subscriptions.plans.$get(undefined, options)
    : await remoteClient.api.admin.subscriptions.plans.$get()
  const data = await readJson(response, 'Failed to list admin subscription plans')
  return data.plans
}

export async function createPlan(input: AdminSubscriptionPlanInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminSubscriptionPlan> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.subscriptions.plans.$post({ json: input }, options)
    : await remoteClient.api.admin.subscriptions.plans.$post({ json: input })
  const data = await readJson(response, 'Failed to create admin subscription plan')
  return data.plan
}

export async function updatePlan(id: string, input: AdminSubscriptionPlanUpdateInput, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminSubscriptionPlan> {
  const params = {
    param: { id },
    json: input,
  }
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.subscriptions.plans[':id'].$patch(params, options)
    : await remoteClient.api.admin.subscriptions.plans[':id'].$patch(params)
  const data = await readJson(response, 'Failed to update admin subscription plan')
  return data.plan
}

export async function disablePlan(id: string, remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<AdminSubscriptionPlan> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.subscriptions.plans[':id'].$delete({ param: { id } }, options)
    : await remoteClient.api.admin.subscriptions.plans[':id'].$delete({ param: { id } })
  const data = await readJson(response, 'Failed to disable admin subscription plan')
  return data.plan
}

export async function seedDefaultPlans(remoteClient: AdminRemoteClient = adminClient, signal?: AbortSignal): Promise<{
  plans: AdminSubscriptionPlan[]
  createdPlanIds: string[]
}> {
  const options = requestOptions(signal)
  const response = options
    ? await remoteClient.api.admin.subscriptions.plans.defaults.$post(undefined, options)
    : await remoteClient.api.admin.subscriptions.plans.defaults.$post()
  return await readJson(response, 'Failed to seed default admin subscription plans')
}

export function formatFen(amountFen: number | null | undefined): string {
  if (amountFen == null || !Number.isFinite(amountFen))
    return '-'

  const sign = amountFen < 0 ? '-' : ''
  const absoluteFen = Math.abs(amountFen)
  const yuan = Math.floor(absoluteFen / 100)
  const fen = String(absoluteFen % 100).padStart(2, '0')
  return `${sign}¥${yuan}.${fen}`
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value)
    return '-'

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime()))
    return '-'

  return date.toISOString().slice(0, 16).replace('T', ' ')
}

export function formatPeriodDays(periodDays: number | null | undefined): string {
  if (periodDays == null || !Number.isFinite(periodDays))
    return '-'

  return periodDays === 1 ? '1 day' : `${periodDays} days`
}

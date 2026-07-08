import type { Context } from 'hono'
import type { GenericSchema, InferOutput } from 'valibot'

import type { SubscriptionPlan } from '../../../schemas/subscriptions'
import type { AdminSubscriptionPlanService } from '../../../services/domain/subscriptions'
import type { HonoEnv } from '../../../types/hono'

import { Hono } from 'hono'
import { boolean, integer, maxLength, minValue, nonEmpty, nullable, number, object, optional, pipe, regex, safeParse, string } from 'valibot'

import { adminGuard } from '../../../middlewares/admin-guard'
import { authGuard } from '../../../middlewares/auth'
import { createBadRequestError } from '../../../utils/error'

const PlanIdSchema = pipe(
  string(),
  maxLength(64, 'id must be at most 64 characters'),
  regex(/^[a-z0-9][a-z0-9_-]{0,63}$/, 'id must be a safe lowercase slug'),
)

const PlanNameSchema = pipe(string(), nonEmpty('name is required'), maxLength(120, 'name must be at most 120 characters'))
const PlanDescriptionSchema = nullable(pipe(string(), maxLength(500, 'description must be at most 500 characters')))
const NonNegativeIntegerSchema = pipe(number(), integer(), minValue(0))
const PositiveIntegerSchema = pipe(number(), integer(), minValue(1))

const PlanCreateBodySchema = object({
  id: PlanIdSchema,
  name: PlanNameSchema,
  description: optional(PlanDescriptionSchema),
  enabled: optional(boolean()),
  displayOrder: optional(NonNegativeIntegerSchema),
  periodDays: PositiveIntegerSchema,
  amountFen: NonNegativeIntegerSchema,
  fluxAmount: NonNegativeIntegerSchema,
})

const PlanUpdateBodySchema = object({
  name: optional(PlanNameSchema),
  description: optional(PlanDescriptionSchema),
  enabled: optional(boolean()),
  displayOrder: optional(NonNegativeIntegerSchema),
  periodDays: optional(PositiveIntegerSchema),
  amountFen: optional(NonNegativeIntegerSchema),
  fluxAmount: optional(NonNegativeIntegerSchema),
})

interface AdminSubscriptionPlanResponse {
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

function parseIssues(issues: Array<{ path?: Array<{ key: unknown }>, message: string }>) {
  return issues.map(i => ({
    path: i.path?.map(p => p.key).join('.'),
    message: i.message,
  }))
}

async function readJson(c: Context<HonoEnv>): Promise<unknown> {
  const raw = await c.req.json().catch(() => null)
  if (raw == null)
    throw createBadRequestError('Request body must be JSON', 'INVALID_BODY')
  return raw
}

async function readBody<S extends GenericSchema>(c: Context<HonoEnv>, schema: S): Promise<InferOutput<S>> {
  const parsed = safeParse(schema, await readJson(c))
  if (!parsed.success)
    throw createBadRequestError('Invalid request body', 'INVALID_BODY', parseIssues(parsed.issues))
  return parsed.output
}

function readPlanId(c: Context<HonoEnv>): string {
  const parsed = safeParse(PlanIdSchema, c.req.param('id'))
  if (!parsed.success)
    throw createBadRequestError('Invalid subscription plan id', 'INVALID_SUBSCRIPTION_PLAN_ID', parseIssues(parsed.issues))
  return parsed.output
}

/**
 * Admin routes for subscription plan curation.
 *
 * Mounted at `/api/admin/subscriptions`. These endpoints only manage periodic
 * subscription plans; they do not expose one-time top-ups or token/character
 * pricing knobs.
 */
export function createAdminSubscriptionRoutes(service: AdminSubscriptionPlanService) {
  return new Hono<HonoEnv>()
    .use('*', authGuard)
    .use('*', adminGuard)
    .get('/plans', async (c) => {
      const plans = await service.listPlansForAdmin()
      return c.json({ plans: plans.map(planToResponse) })
    })
    .post('/plans/defaults', async (c) => {
      const result = await service.ensureDefaultPlans()
      return c.json({
        plans: result.plans.map(planToResponse),
        createdPlanIds: result.createdPlanIds,
      })
    })
    .post('/plans', async (c) => {
      const body = await readBody(c, PlanCreateBodySchema)
      const plan = await service.createPlan(body)
      return c.json({ plan: planToResponse(plan) }, 201)
    })
    .patch('/plans/:id', async (c) => {
      const planId = readPlanId(c)
      const body = await readBody(c, PlanUpdateBodySchema)
      if (Object.keys(body).length === 0) {
        throw createBadRequestError('No subscription plan fields were provided', 'INVALID_BODY', {
          planId,
        })
      }

      const plan = await service.updatePlan(planId, body)
      return c.json({ plan: planToResponse(plan) })
    })
    .delete('/plans/:id', async (c) => {
      const plan = await service.disablePlan(readPlanId(c))
      return c.json({ plan: planToResponse(plan) })
    })
}

function planToResponse(plan: SubscriptionPlan): AdminSubscriptionPlanResponse {
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    enabled: plan.enabled,
    displayOrder: plan.displayOrder,
    periodDays: plan.periodDays,
    amountFen: plan.amountFen,
    fluxAmount: plan.fluxAmount,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

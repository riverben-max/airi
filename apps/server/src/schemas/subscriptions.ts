import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { nanoid } from '../utils/id'
import { user } from './accounts'

/** Lifecycle state for the user's current subscription window. */
export type UserSubscriptionStatus = 'active' | 'expired' | 'canceled'

export const subscriptionPlans = pgTable(
  'subscription_plans',
  {
    // Stable public identifiers such as `monthly_basic` are configured by admins.
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    enabled: boolean('enabled').notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    periodDays: integer('period_days').notNull(),
    amountFen: integer('amount_fen').notNull(),
    fluxAmount: integer('flux_amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('subscription_plans_enabled_display_order_idx').on(table.enabled, table.displayOrder),
  ],
)

export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    userId: text('user_id')
      .primaryKey()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Bare planId for audit: paid subscriptions must remain deliverable even
    // if an admin disables or removes the original plan after checkout.
    planId: text('plan_id').notNull(),
    status: text('status').notNull().$type<UserSubscriptionStatus>().default('active'),
    currentPeriodStart: timestamp('current_period_start').notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    lastPaymentOrderId: text('last_payment_order_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => [
    index('user_subscriptions_status_period_end_idx').on(table.status, table.currentPeriodEnd),
  ],
)

// NOTICE:
// This table is a financial/subscription audit ledger for paid Epay periods.
// It intentionally keeps bare text userId/planId values instead of cascading
// FKs so historical payment periods survive account or plan cleanup.
export const subscriptionPeriods = pgTable(
  'subscription_periods',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    userId: text('user_id').notNull(),
    planId: text('plan_id').notNull(),
    outTradeNo: text('out_trade_no').notNull(),
    periodStart: timestamp('period_start').notNull(),
    periodEnd: timestamp('period_end').notNull(),
    fluxAmount: integer('flux_amount').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  table => [
    uniqueIndex('subscription_periods_out_trade_no_uidx').on(table.outTradeNo),
    index('subscription_periods_user_id_idx').on(table.userId),
    index('subscription_periods_plan_id_idx').on(table.planId),
  ],
)

export type SubscriptionPlan = InferSelectModel<typeof subscriptionPlans>
export type NewSubscriptionPlan = InferInsertModel<typeof subscriptionPlans>
export type UserSubscription = InferSelectModel<typeof userSubscriptions>
export type NewUserSubscription = InferInsertModel<typeof userSubscriptions>
export type SubscriptionPeriod = InferSelectModel<typeof subscriptionPeriods>
export type NewSubscriptionPeriod = InferInsertModel<typeof subscriptionPeriods>

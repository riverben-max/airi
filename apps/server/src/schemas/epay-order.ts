import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { nanoid } from '../utils/id'

export type EpayOrderStatus = 'pending' | 'crediting' | 'paid' | 'credit_failed' | 'failed' | 'expired'
export type EpayOrderType = 'alipay' | 'wxpay' | 'qqpay' | 'bank'
export type EpayOrderKind = 'subscription' | 'flux_topup'

// NOTICE: bare userId — no FK to user.id, same policy as flux tables.
// better-auth hard-deletes user rows; this table is a financial audit log
// and must outlive the account.
export const epayOrders = pgTable('epay_orders', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),

  // Our internal order number sent to epay as `out_trade_no`.
  outTradeNo: text('out_trade_no').notNull().unique(),

  userId: text('user_id').notNull(),

  // Amount in CNY (e.g. 6.00 stored as integer fen: 600).
  amountFen: integer('amount_fen').notNull(),

  // How many Flux credits this order grants on success.
  fluxAmount: integer('flux_amount').notNull(),

  // Existing one-time Flux rows migrate to flux_topup; subscription-specific
  // foreign data stays nullable so historical rows do not need fake plan periods.
  orderKind: text('order_kind').notNull().$type<EpayOrderKind>().default('flux_topup'),
  planId: text('plan_id'),
  // Snapshot fields freeze the purchased subscription terms at checkout time.
  // Notify settlement must honor these values even if admins later edit plans.
  periodDays: integer('period_days'),
  planName: text('plan_name'),
  subject: text('subject'),
  periodStart: timestamp('period_start'),
  periodEnd: timestamp('period_end'),

  type: text('type').notNull().$type<EpayOrderType>().default('alipay'),
  status: text('status').notNull().$type<EpayOrderStatus>().default('pending'),

  // Epay's own trade number, populated on successful notify callback.
  tradeNo: text('trade_no'),

  // Idempotency: set to true once flux has been credited to prevent double-credit.
  fluxCredited: integer('flux_credited').notNull().default(0),

  // Raw epay notify params stored for audit.
  notifyPayload: text('notify_payload'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  paidAt: timestamp('paid_at'),
}, table => [
  index('epay_orders_user_id_idx').on(table.userId),
  index('epay_orders_status_idx').on(table.status),
])

type EpayOrderRow = InferSelectModel<typeof epayOrders>

// Keep newly added nullable columns optional at the TypeScript boundary so older
// route tests and in-flight workers that construct audit rows by hand do not
// need to learn about subscription columns until they actively use them.
export type EpayOrder = Omit<EpayOrderRow, 'orderKind' | 'planId' | 'periodDays' | 'planName' | 'subject' | 'periodStart' | 'periodEnd'> & Partial<Pick<EpayOrderRow, 'orderKind' | 'planId' | 'periodDays' | 'planName' | 'subject' | 'periodStart' | 'periodEnd'>>
export type NewEpayOrder = InferInsertModel<typeof epayOrders>

import { literal, object, optional, string, union } from 'valibot'

export const CreateOrderBodySchema = object({
  // Preferred Phase3-B field. A plan is a periodic subscription product, not a
  // one-time Flux top-up package.
  planId: optional(string()),

  // Backward-compatible input for older clients. Routes map this to a matching
  // subscription plan and no longer advertise one-time package purchase.
  packageId: optional(string()),
  type: optional(union([literal('alipay'), literal('wxpay')]), 'alipay'),
})

export const EpayNotifyQuerySchema = object({
  pid: optional(string()),
  trade_no: optional(string()),
  out_trade_no: optional(string()),
  type: optional(string()),
  name: optional(string()),
  money: optional(string()),
  trade_status: optional(string()),
  sign: optional(string()),
  sign_type: optional(string()),
})

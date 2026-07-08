import posthog from 'posthog-js'

import { useSharedAnalyticsStore } from '../stores/analytics'

export type FluxBalanceBucket = 'zero' | '1_100' | '101_1000' | '1001_10000' | '10000_plus' | 'unknown'

export function useAnalytics() {
  const analyticsStore = useSharedAnalyticsStore()

  function trackProviderClick(providerId: string, module: string) {
    posthog.capture('provider_card_clicked', {
      provider_id: providerId,
      module,
    })
  }

  function trackFirstMessage() {
    // Only track the first message once
    if (analyticsStore.firstMessageTracked)
      return

    analyticsStore.markFirstMessageTracked()

    // Calculate time from app start to message sent
    const timeToFirstMessageMs = analyticsStore.appStartTime
      ? Date.now() - analyticsStore.appStartTime
      : null

    posthog.capture('first_message_sent', {
      time_to_first_message_ms: timeToFirstMessageMs,
    })
  }

  function trackPricingViewed(surface: string, planPeriod?: 'monthly' | 'annual' | 'one_time') {
    posthog.capture('pricing_page_viewed', { surface, ...(planPeriod && { plan_period: planPeriod }) })
  }

  function trackPlanSelected(planId: string, properties?: { price_minor_unit?: number, currency?: string }) {
    posthog.capture('plan_selected', { plan_id: planId, ...properties })
  }

  function trackCheckoutStarted(planId: string, properties: { checkout_session_id?: string, price_minor_unit?: number, currency?: string }) {
    posthog.capture(
      'checkout_started',
      { plan_id: planId, ...properties },
      { send_instantly: true, transport: 'sendBeacon' },
    )
  }

  function trackPaywallSeen(properties: {
    surface: string
    reason: 'manual_topup' | 'insufficient_balance' | 'checkout_recovery' | 'unknown'
    flux_balance_bucket: FluxBalanceBucket
  }) {
    posthog.capture('paywall_seen', {
      surface: properties.surface,
      reason: properties.reason,
      flux_balance_bucket: properties.flux_balance_bucket,
    })
  }

  function trackQuotaLimitReached(properties: {
    limit_type: 'flux' | 'rate_limit' | 'subscription'
    current_usage: number
    limit_value?: number
    entry: string
  }) {
    posthog.capture('quota_limit_reached', properties)
  }

  function trackUpgradeClicked(properties: {
    source_page: string
    current_plan?: string
    trigger: 'quota_limit' | 'pricing_page' | 'manual_topup' | 'feature_gate'
  }) {
    posthog.capture('upgrade_clicked', properties)
  }

  return {
    trackProviderClick,
    trackFirstMessage,
    trackPricingViewed,
    trackPlanSelected,
    trackCheckoutStarted,
    trackPaywallSeen,
    trackQuotaLimitReached,
    trackUpgradeClicked,
  }
}

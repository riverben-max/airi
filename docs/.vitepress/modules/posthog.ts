import type { PostHogConfig } from 'posthog-js'

import posthog from 'posthog-js'

const POSTHOG_PROJECT_KEY_DOCS
  = import.meta.env.VITE_POSTHOG_PROJECT_KEY_DOCS
    ?? 'phc_pzjziJjrVZpa9SqnQqq0QEKvkmuCPH7GDTA6TbRTEf9' // cspell:disable-line

const DEFAULT_POSTHOG_CONFIG = {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
} as const satisfies Partial<PostHogConfig>

posthog.init(POSTHOG_PROJECT_KEY_DOCS, {
  ...DEFAULT_POSTHOG_CONFIG,
  // Project-specific config...
})

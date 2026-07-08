<script setup lang="ts">
import { SERVER_URL } from '@proj-airi/stage-ui/libs/server'

import { buildAuthUiSignInRedirectUrl } from '../../modules/auth-entry-redirect'

if (!import.meta.env.SSR && typeof window !== 'undefined') {
  const redirectUrl = buildAuthUiSignInRedirectUrl(new URL(window.location.href), SERVER_URL)
  window.location.replace(redirectUrl.href)
}
</script>

<template>
  <main />
</template>

<route lang="yaml">
meta:
  layout: plain
</route>

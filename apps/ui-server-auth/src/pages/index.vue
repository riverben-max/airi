<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// Keep `/ui/` from becoming a blank auth-shell page when a callback loses the
// intended continuation. The route block redirect is not emitted by the current
// pages plugin build, so perform the redirect from the route component itself.
void router.replace('/profile')
</script>

<template>
  <div />
</template>

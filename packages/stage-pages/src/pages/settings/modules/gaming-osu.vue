<script setup lang="ts">
import { GamingOsu } from '@proj-airi/stage-ui/components'
</script>

<template>
  <GamingOsu />
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.gaming-osu.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>

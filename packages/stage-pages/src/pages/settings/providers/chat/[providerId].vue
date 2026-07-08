<script setup lang="ts">
import { ProviderSettingsContainer, ProviderSettingsLayout } from '@proj-airi/stage-ui/components'
import { Callout } from '@proj-airi/ui'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { isSupportedProviderSettingsRoute } from '../officialProviderBoundary'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const providerId = computed(() => String(route.params.providerId ?? ''))
const supported = computed(() => isSupportedProviderSettingsRoute('chat', providerId.value))

onMounted(() => {
  if (!supported.value)
    router.replace('/settings/providers').catch(() => {})
})
</script>

<template>
  <ProviderSettingsLayout
    :provider-name="t('settings.pages.providers.unavailable.title')"
    provider-icon="i-solar:box-minimalistic-bold-duotone"
    provider-icon-color="text-primary-500"
    :on-back="() => router.push('/settings/providers')"
  >
    <ProviderSettingsContainer>
      <Callout theme="primary">
        <template #label>
          {{ t('settings.pages.providers.unavailable.title') }}
        </template>
        <p>{{ t('settings.pages.providers.unavailable.description') }}</p>
      </Callout>
    </ProviderSettingsContainer>
  </ProviderSettingsLayout>
</template>

<route lang="yaml">
meta:
  layout: settings
  stageTransition:
    name: slide
</route>

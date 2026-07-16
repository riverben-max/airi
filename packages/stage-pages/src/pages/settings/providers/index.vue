<script setup lang="ts">
import type { Ref } from 'vue'

import type { ProviderSectionInput, ProviderSourceCard } from './officialProviderBoundary'

import { IconStatusItem, RippleGrid } from '@proj-airi/stage-ui/components'
import { useAnalytics } from '@proj-airi/stage-ui/composables'
import { useRippleGridState } from '@proj-airi/stage-ui/composables/use-ripple-grid-state'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useProvidersStore } from '@proj-airi/stage-ui/stores/providers'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { buildCustomerProviderSections } from './officialProviderBoundary'

interface ProviderBlockConfig {
  id: string
  icon: string
  title: string
  description: string
  providersRef: Readonly<Ref<ProviderSourceCard[]>>
}

const { t } = useI18n()
const artistryStore = useArtistryStore()
const providersStore = useProvidersStore()
const { lastClickedIndex, setLastClickedIndex } = useRippleGridState()
const { trackProviderClick } = useAnalytics()

const {
  allChatProvidersMetadata,
  allAudioSpeechProvidersMetadata,
  allAudioTranscriptionProvidersMetadata,
  allVisionProvidersMetadata,
} = storeToRefs(providersStore)

const allArtistryProvidersMetadata = computed<ProviderSourceCard[]>(() => [
  {
    id: 'comfyui',
    category: 'artistry',
    icon: 'i-solar:gallery-bold-duotone',
    iconColor: 'text-indigo-500',
    name: 'ComfyUI',
    localizedName: 'ComfyUI',
    description: 'Local image generation runner.',
    localizedDescription: t('settings.pages.providers.categories.artistry.items.comfyui.description'),
    configured: !!artistryStore.comfyuiServerUrl,
    to: '/settings/providers/artistry/comfyui',
    pricing: 'free',
    deployment: 'local',
    beginnerRecommended: true,
  },
])

const providerBlocksConfig = computed<ProviderBlockConfig[]>(() => [
  {
    id: 'chat',
    icon: 'i-solar:chat-square-like-bold-duotone',
    title: t('settings.pages.providers.categories.chat.title'),
    description: t('settings.pages.providers.categories.chat.description'),
    providersRef: allChatProvidersMetadata,
  },
  {
    id: 'vision',
    icon: 'i-solar:eye-bold-duotone',
    title: t('settings.pages.providers.categories.vision.title'),
    description: t('settings.pages.providers.categories.vision.description'),
    providersRef: allVisionProvidersMetadata,
  },
  {
    id: 'artistry',
    icon: 'i-solar:palette-bold-duotone',
    title: t('settings.pages.providers.categories.artistry.title'),
    description: t('settings.pages.providers.categories.artistry.description'),
    providersRef: allArtistryProvidersMetadata,
  },
  {
    id: 'speech',
    icon: 'i-solar:user-speak-rounded-bold-duotone',
    title: t('settings.pages.providers.categories.speech.title'),
    description: t('settings.pages.providers.categories.speech.description'),
    providersRef: allAudioSpeechProvidersMetadata,
  },
  {
    id: 'transcription',
    icon: 'i-solar:microphone-3-bold-duotone',
    title: t('settings.pages.providers.categories.transcription.title'),
    description: t('settings.pages.providers.categories.transcription.description'),
    providersRef: allAudioTranscriptionProvidersMetadata,
  },
])

const providerBlocks = computed(() => {
  const sections: ProviderSectionInput[] = providerBlocksConfig.value.map(block => ({
    id: block.id,
    icon: block.icon,
    title: block.title,
    description: block.description,
    providers: block.providersRef.value,
  }))

  return buildCustomerProviderSections(sections)
})
</script>

<template>
  <div :class="['mb-6', 'flex', 'flex-col', 'gap-5', 'pb-10']">
    <div
      :class="[
        'rounded-lg bg-primary-500/10 p-4',
        'dark:bg-primary-800/25',
      ]"
    >
      <div :class="['mb-2 text-xl text-primary-800 font-normal', 'dark:text-primary-100']">
        {{ t('settings.pages.providers.helpinfo.title') }}
      </div>
      <div :class="['text-primary-700', 'dark:text-primary-300']">
        {{ t('settings.pages.providers.helpinfo.description') }}
      </div>
    </div>

    <div
      v-if="providerBlocks.length === 0"
      :class="[
        'rounded-lg border border-neutral-200/70 bg-white/70 p-4',
        'text-sm text-neutral-600',
        'dark:border-neutral-800/70 dark:bg-neutral-900/70 dark:text-neutral-300',
      ]"
    >
      {{ t('settings.pages.providers.empty.official') }}
    </div>

    <RippleGrid
      v-else
      :sections="providerBlocks"
      :get-items="block => block.providers"
      :columns="{ default: 1, sm: 2, xl: 3 }"
      :origin-index="lastClickedIndex"
      @item-click="({ globalIndex }) => setLastClickedIndex(globalIndex)"
    >
      <template #header="{ section: block }">
        <div :class="['flex flex-row items-center gap-2']">
          <div :id="block.id" :class="[block.icon, 'text-4xl text-neutral-500', 'dark:text-neutral-400']" />
          <div>
            <div>
              <span :class="['text-sm text-neutral-300 sm:text-base', 'dark:text-neutral-500']">
                {{ block.description }}
              </span>
            </div>
            <div :class="['flex text-nowrap text-2xl font-normal sm:text-3xl']">
              <div>
                {{ block.title }}
              </div>
            </div>
          </div>
        </div>
      </template>

      <template #item="{ item: provider }">
        <IconStatusItem
          :title="provider.localizedName || provider.name || t('settings.pages.providers.unknown')"
          :description="provider.localizedDescription || provider.description"
          :icon="provider.icon"
          :icon-color="provider.iconColor"
          :icon-image="provider.iconImage"
          :to="provider.to ?? `/settings/providers/${provider.category}/${provider.id}`"
          :configured="provider.configured"
          :pricing="provider.pricing"
          :deployment="provider.deployment"
          :beginner-recommended="provider.beginnerRecommended"
          @click="trackProviderClick(provider.id, provider.category)"
        />
      </template>
    </RippleGrid>
  </div>
  <div
    v-motion
    :class="[
      'pointer-events-none fixed bottom-0 right--5 top-[calc(100dvh-15rem)] z--1',
      'size-60 flex items-center justify-center',
      'text-neutral-500/5 dark:text-neutral-600/20',
    ]"
    :initial="{ scale: 0.9, opacity: 0, y: 20 }"
    :enter="{ scale: 1, opacity: 1, y: 0 }"
    :duration="500"
  >
    <div :class="['i-solar:box-minimalistic-bold-duotone text-60']" />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.providers.title
  subtitleKey: settings.title
  descriptionKey: settings.pages.providers.description
  icon: i-solar:box-minimalistic-bold-duotone
  settingsEntry: true
  order: 6
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>

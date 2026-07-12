<script setup lang="ts">
import { isStageCapacitor, isStageTamagotchi } from '@proj-airi/stage-shared'
import { AboutContent, AboutDialog } from '@proj-airi/stage-ui/components'
import { useBuildInfo } from '@proj-airi/stage-ui/composables'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const show = ref(false)
const buildInfo = useBuildInfo()

const aboutLinks = computed(() => [
  { label: t('stage.chat.navigation.home'), href: 'https://airi.moeru.ai/docs/', icon: 'i-solar:home-smile-outline' },
  { label: t('stage.chat.navigation.documentation'), href: 'https://airi.moeru.ai/docs/en/docs/overview/', icon: 'i-solar:document-add-outline' },
  { label: 'GitHub', href: 'https://github.com/moeru-ai/airi', icon: 'i-simple-icons:github' },
])

const edition = computed(() => isStageTamagotchi()
  ? t('base.edition.desktop')
  : isStageCapacitor()
    ? t('base.edition.mobile')
    : t('base.edition.web'))
</script>

<template>
  <button border="2 solid neutral-100/60 dark:neutral-800/30" bg="neutral-50/70 dark:neutral-800/70" w-fit flex items-center self-end justify-center rounded-xl p-2 backdrop-blur-md :title="t('stage.chat.navigation.about')" :aria-label="t('stage.chat.navigation.about')" :aria-pressed="show" @click="show = !show">
    <div i-solar:info-circle-outline size-5 text="neutral-500 dark:neutral-400" />
  </button>
  <AboutDialog v-model="show">
    <AboutContent :subtitle="edition" :build-info="buildInfo" :links="aboutLinks" />
  </AboutDialog>
</template>

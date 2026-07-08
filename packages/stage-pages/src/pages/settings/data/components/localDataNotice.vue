<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <section
    :class="[
      'rounded-xl border border-primary-500/20 bg-primary-500/10 p-4',
      'dark:border-primary-400/15 dark:bg-primary-800/25',
    ]"
  >
    <div :class="['flex flex-col gap-3 sm:flex-row sm:items-start']">
      <div
        :class="[
          'i-solar:database-bold-duotone mt-0.5 text-2xl text-primary-600',
          'dark:text-primary-300',
        ]"
      />
      <div :class="['flex min-w-0 flex-col gap-2']">
        <div :class="['text-base text-primary-800 font-medium', 'dark:text-primary-100']">
          {{ t('settings.pages.data.local_notice.title') }}
        </div>
        <p :class="['text-sm text-primary-700', 'dark:text-primary-200']">
          {{ t('settings.pages.data.local_notice.description') }}
        </p>
        <ul :class="['m-0 list-disc pl-5 text-sm text-primary-700', 'dark:text-primary-200']">
          <li>{{ t('settings.pages.data.local_notice.items.chats') }}</li>
          <li>{{ t('settings.pages.data.local_notice.items.characters') }}</li>
          <li>{{ t('settings.pages.data.local_notice.items.memory') }}</li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { GamingMinecraft } from '@proj-airi/stage-ui/components'
import { Callout } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div space-y-4>
    <!-- Warning Callout -->
    <Callout theme="orange">
      <template #label>
        <div flex items-center gap-1 font-normal>
          <div i-solar:danger-circle-bold-duotone text-lg />
          <div text-base>
            {{ t('settings.pages.modules.gaming-minecraft.unavailable.title') }}
          </div>
        </div>
      </template>
      <div text-base>
        {{ t('settings.pages.modules.gaming-minecraft.unavailable.description') }}
      </div>
    </Callout>

    <!-- Instructions Section -->
    <div bg="neutral-50 dark:neutral-900/50" rounded-lg p-4 border="~ neutral-200 dark:neutral-800">
      <h3 text="base font-semibold mb-3 neutral-800 dark:neutral-200">
        {{ t('settings.pages.modules.gaming-minecraft.setup.title') }}
      </h3>

      <ol list="decimal pl-4 space-y-2" text="sm neutral-600 dark:neutral-300">
        <li>
          <div>
            <span font="medium neutral-700 dark:neutral-200">{{ t('settings.pages.modules.gaming-minecraft.setup.checkout') }}</span>
            <code text="xs neutral-500 dark:neutral-400" block>git clone https://github.com/moeru-ai/airi</code>
          </div>
        </li>
        <li>
          <div>
            <span font="medium neutral-700 dark:neutral-200">{{ t('settings.pages.modules.gaming-minecraft.setup.navigate') }}</span>
            <code text="xs neutral-500 dark:neutral-400" block>cd services/minecraft</code>
          </div>
        </li>
        <li>
          <div>
            <span font="medium neutral-700 dark:neutral-200">{{ t('settings.pages.modules.gaming-minecraft.setup.install') }}</span>
            <code text="xs neutral-500 dark:neutral-400" block>pnpm install</code>
          </div>
        </li>
        <li>
          <div>
            <span font="medium neutral-700 dark:neutral-200">{{ t('settings.pages.modules.gaming-minecraft.setup.environment') }}</span>
            <code text="xs neutral-500 dark:neutral-400" block>cp .env .env.local</code>
            <div text="xs neutral-500 dark:neutral-400" mt-1>
              {{ t('settings.pages.modules.gaming-minecraft.setup.environment-description') }}
            </div>
          </div>
        </li>
        <li>
          <div>
            <span font="medium neutral-700 dark:neutral-200">{{ t('settings.pages.modules.gaming-minecraft.setup.run') }}</span>
            <code text="xs neutral-500 dark:neutral-400" block>pnpm dev</code>
          </div>
        </li>
      </ol>

      <div bg="neutral-100 dark:neutral-800/50" mt-4 rounded p-3 text="xs neutral-500 dark:neutral-400">
        <div flex items-start gap-2>
          <div i-solar:info-circle-bold-duotone mt-0.5 flex-shrink-0 />
          <div>
            <strong>{{ t('settings.pages.modules.gaming-minecraft.setup.note-label') }}</strong> {{ t('settings.pages.modules.gaming-minecraft.setup.note') }}
          </div>
        </div>
      </div>
    </div>
    <GamingMinecraft />
  </div>
</template>

<route lang="yaml">
meta:
  layout: settings
  titleKey: settings.pages.modules.gaming-minecraft.title
  subtitleKey: settings.title
  stageTransition:
    name: slide
    pageSpecificAvailable: true
</route>

<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main
    :class="[
      'min-h-screen w-full',
      'flex items-center justify-center',
      'bg-neutral-50 px-6 py-10 text-neutral-900',
      'dark:bg-neutral-950 dark:text-neutral-50',
    ]"
  >
    <section
      :class="[
        'w-full max-w-sm',
        'flex flex-col items-center gap-6 text-center',
      ]"
    >
      <div
        :class="[
          'flex flex-col items-center gap-3',
        ]"
      >
        <p
          :class="[
            'text-sm font-medium text-neutral-500 uppercase tracking-wide',
            'dark:text-neutral-400',
          ]"
        >
          404
        </p>
        <h1
          :class="[
            'text-2xl font-semibold',
          ]"
        >
          {{ t('server.auth.notFound.title') }}
        </h1>
        <p
          :class="[
            'text-sm leading-6 text-neutral-600',
            'dark:text-neutral-300',
          ]"
        >
          {{ t('server.auth.notFound.description') }}
        </p>
      </div>

      <div
        :class="[
          'flex flex-wrap items-center justify-center gap-3',
        ]"
      >
        <Button @click="router.push('/sign-in')">
          {{ t('server.auth.signIn.action.signIn') }}
        </Button>
        <Button variant="secondary" @click="router.go(-1)">
          {{ t('server.auth.notFound.back') }}
        </Button>
      </div>
    </section>
  </main>
</template>

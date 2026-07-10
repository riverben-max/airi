<script setup lang="ts">
import { errorMessageFrom } from '@moeru/std'
import { applyOIDCTokens, fetchSession, triggerSignIn } from '@proj-airi/stage-ui/libs/auth'
import { consumeFlowState, exchangeCodeForTokens } from '@proj-airi/stage-ui/libs/auth-oidc'
import { useOnboardingStore } from '@proj-airi/stage-ui/stores/onboarding'
import { Button } from '@proj-airi/ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import {
  consumeOnboardingLogin,
  finalizeOnboardingLogin,
  isOnboardingLoginPending,
  startOnboardingLogin,
} from '../../modules/onboarding-login'

const router = useRouter()
const onboardingStore = useOnboardingStore()
const { t } = useI18n()
const error = ref<string | null>(null)
const retryOnboardingLogin = ref(false)

onMounted(async () => {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    retryOnboardingLogin.value = consumeOnboardingLogin(state)
    error.value = url.searchParams.get('error_description') ?? errorParam
    return
  }

  if (!code || !state) {
    retryOnboardingLogin.value = consumeOnboardingLogin(state)
    error.value = t('server.auth.webCallback.message.missingCodeOrState')
    return
  }

  let expectedOnboardingState: string | null = state

  try {
    const persisted = consumeFlowState()
    if (!persisted) {
      retryOnboardingLogin.value = consumeOnboardingLogin(expectedOnboardingState)
      error.value = t('server.auth.webCallback.message.missingFlowState')
      return
    }

    expectedOnboardingState = persisted.flowState.state
    retryOnboardingLogin.value = isOnboardingLoginPending(expectedOnboardingState)

    const tokens = await exchangeCodeForTokens(code, persisted.flowState, persisted.params, state)
    await applyOIDCTokens(tokens, persisted.params.clientId)
    await finalizeOnboardingLogin(
      expectedOnboardingState,
      fetchSession,
      () => onboardingStore.markSetupCompleted(),
    )
    router.replace('/')
  }
  catch (err) {
    retryOnboardingLogin.value = consumeOnboardingLogin(expectedOnboardingState) || retryOnboardingLogin.value
    error.value = errorMessageFrom(err) ?? t('server.auth.webCallback.message.tokenExchangeFailed')
  }
})

async function handleTryAgain() {
  if (retryOnboardingLogin.value) {
    await startOnboardingLogin(onFlowState => triggerSignIn({ onFlowState }))
    return
  }

  await triggerSignIn()
}
</script>

<template>
  <main :class="['min-h-screen', 'flex flex-col items-center justify-center', 'px-6 py-10', 'font-cuteen']">
    <div v-if="error" :class="['sm:max-w-md md:max-w-lg', 'flex w-full flex-col items-center']">
      <div :class="['mb-8 text-3xl font-bold']">
        Project AIRI
      </div>

      <div
        :class="[
          'w-full rounded-xl p-5',
          'relative overflow-hidden',
          'bg-orange-50/70 dark:bg-orange-950/30',
        ]"
      >
        <div :class="['flex items-start gap-3']">
          <div
            aria-hidden="true"
            :class="[
              'absolute',
              'size-24 flex-shrink-0',
              'right-0 top-0 translate-x-[calc(25%)] translate-y-[-25%]',
              'i-solar:danger-circle-line-duotone text-orange-500/30 dark:text-orange-200/20',
            ]"
          />
          <div :class="['min-w-0']">
            <div :class="['text-xl font-semibold text-orange-800 dark:text-orange-200', 'mb-4']">
              {{ t('server.auth.webCallback.title.errorLabel') }}
            </div>
            <div :class="['mt-1 text-sm text-orange-700 dark:text-orange-300']">
              {{ error }}
            </div>
          </div>
        </div>
      </div>

      <Button :class="['mt-3 inline-flex']" @click="handleTryAgain">
        {{ t('server.auth.webCallback.action.tryAgain') }}
      </Button>
    </div>

    <div v-else :class="['text-center']">
      <div
        aria-hidden="true"
        :class="[
          'mx-auto mb-3',
          'h-15 w-15',
          'i-svg-spinners:ring-resize',
          'text-primary-500',
        ]"
      />
      <div :class="['text-lg']">
        {{ t('server.auth.webCallback.title.loading') }}
      </div>
      <p :class="['mt-2 text-sm text-neutral-600 dark:text-neutral-300']">
        {{ t('server.auth.webCallback.message.finalizing') }}
      </p>
    </div>
  </main>
</template>

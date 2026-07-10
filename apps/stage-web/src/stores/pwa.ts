import { isEnvTruthy } from '@proj-airi/stage-shared'
import { ToasterPWAUpdateReady } from '@proj-airi/stage-ui/components'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { nanoid } from 'nanoid'
import { defineStore } from 'pinia'
import { h, markRaw, ref } from 'vue'
import { toast } from 'vue-sonner'

export const usePWAStore = defineStore('pwa', () => {
  const updateReadyHooks = ref<(() => void)[]>([])
  const registered = ref(false)
  const breakpoints = useBreakpoints(breakpointsTailwind)
  const isMobile = breakpoints.smaller('md')

  async function register() {
    if (registered.value || import.meta.env.SSR || isEnvTruthy(import.meta.env.VITE_APP_TARGET_HUGGINGFACE_SPACE))
      return

    registered.value = true
    try {
      const { registerSW } = await import('../modules/pwa')
      const updateSW = registerSW({
        onNeedRefresh: () => {
          const id = nanoid()
          toast(markRaw(h(ToasterPWAUpdateReady, { id, onUpdate: () => updateSW() })), {
            id,
            duration: 30000,
            position: isMobile.value ? 'top-center' : 'bottom-right',
          })
        },
      })
      updateReadyHooks.value.push(updateSW)
    }
    catch (error) {
      registered.value = false
      throw error
    }
  }

  return { register, updateReadyHooks }
})

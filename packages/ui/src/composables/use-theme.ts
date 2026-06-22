import { useBroadcastChannel, useDark, useToggle } from '@vueuse/core'
import { watch } from 'vue'

const isDark = useDark({
  disableTransition: true,
})

const toggleDark = useToggle(isDark)

const { data, post } = useBroadcastChannel<boolean, boolean>({ name: 'airi-theme-sync' })

watch(isDark, (val) => {
  if (data.value !== val) {
    post(val)
  }
}, { immediate: true })

watch(data, (val) => {
  if (val !== undefined && isDark.value !== val) {
    isDark.value = val
  }
})

export function useTheme() {
  return {
    isDark,
    toggleDark,
  }
}

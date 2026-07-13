<script setup lang="ts">
import { useDatingSimStore } from '@proj-airi/stage-ui/stores/dating-sim'
import { useDraggable, useLocalStorage, useMediaQuery } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'

const datingSimStore = useDatingSimStore()
const panel = ref<HTMLElement>()
const dragHandle = ref<HTMLElement>()
const isDesktop = useMediaQuery('(min-width: 1024px)')
const isDatingSimDesktop = computed(() => datingSimStore.enabled && isDesktop.value)
const panelState = useLocalStorage('chat-panel:dating-sim', {
  x: 0,
  y: 120,
  width: 420,
  height: 620,
})

const { x, y } = useDraggable(panel, {
  handle: dragHandle,
  initialValue: panelState.value,
  preventDefault: true,
})

const resizing = ref(false)
let resizeStart: { x: number, y: number, width: number, height: number } | undefined

const panelStyle = computed(() => ({
  transform: `translate3d(${x.value}px, ${y.value}px, 0)`,
  width: `${panelState.value.width}px`,
  height: `${panelState.value.height}px`,
}))

watch([x, y, () => panelState.value.width, () => panelState.value.height], () => {
  panelState.value = {
    x: x.value,
    y: y.value,
    width: panelState.value.width,
    height: panelState.value.height,
  }
})

watch(isDatingSimDesktop, (enabled) => {
  if (enabled && panelState.value.x === 0)
    x.value = Math.max(16, window.innerWidth - panelState.value.width - 24)
})

function resizePanel(event: PointerEvent) {
  if (!resizing.value || !resizeStart)
    return

  const width = Math.min(Math.max(340, resizeStart.width + event.clientX - resizeStart.x), window.innerWidth - x.value - 16)
  const height = Math.min(Math.max(360, resizeStart.height + event.clientY - resizeStart.y), window.innerHeight - y.value - 16)
  panelState.value.width = width
  panelState.value.height = height
}

function stopResize() {
  resizing.value = false
  resizeStart = undefined
  window.removeEventListener('pointermove', resizePanel)
  window.removeEventListener('pointerup', stopResize)
}

function startResize(event: PointerEvent) {
  event.preventDefault()
  resizeStart = {
    x: event.clientX,
    y: event.clientY,
    width: panelState.value.width,
    height: panelState.value.height,
  }
  resizing.value = true
  window.addEventListener('pointermove', resizePanel)
  window.addEventListener('pointerup', stopResize, { once: true })
}

onUnmounted(stopResize)
</script>

<template>
  <div
    ref="panel"
    flex="~ col"
    border="solid 4 primary-200/20 dark:primary-400/20"
    :class="isDatingSimDesktop ? 'fixed left-0 top-0 z-60 shadow-2xl' : 'h-full w-full'"
    :style="isDatingSimDesktop ? panelStyle : undefined"
    rounded-xl
    bg="primary-50/50 dark:primary-950/70" backdrop-blur-md
  >
    <div
      v-if="isDatingSimDesktop"
      ref="dragHandle"
      class="h-7 flex shrink-0 cursor-move items-center justify-center border-b border-primary-200/20 bg-primary-100/30 dark:border-primary-400/20 dark:bg-primary-950/40"
    >
      <div class="i-solar:drag-horizontal-bold-duotone text-sm text-primary-500" />
    </div>
    <slot />
    <button
      v-if="isDatingSimDesktop"
      type="button"
      class="resize-handle absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize bg-transparent"
      aria-label="Resize chat panel"
      @pointerdown="startResize"
    >
      <span class="absolute bottom-1 right-1 h-2 w-2 border-b-2 border-r-2 border-primary-500/70" />
    </button>
  </div>
</template>

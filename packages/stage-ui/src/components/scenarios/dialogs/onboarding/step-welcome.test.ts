// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

import StepWelcome from './step-welcome.vue'

vi.mock('@proj-airi/ui', async () => {
  const { defineComponent, h } = await import('vue')

  return {
    Button: defineComponent({
      props: { label: String },
      emits: ['click'],
      setup(props, { emit }) {
        return () => h('button', {
          type: 'button',
          onClick: () => emit('click'),
        }, props.label)
      },
    }),
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

interface StepWelcomeProps extends Record<string, unknown> {
  onNext: () => Promise<void> | void
  onStart?: () => Promise<void> | void
}

async function mountAndClickStart(props: StepWelcomeProps) {
  const element = document.createElement('div')
  document.body.append(element)

  const app = createApp(StepWelcome, props)
  app.directive('motion', {})
  app.mount(element)

  try {
    const button = element.querySelector('button')
    if (!button)
      throw new Error('Expected onboarding welcome button to render')

    button.click()
    await nextTick()
    await Promise.resolve()
  }
  finally {
    app.unmount()
    element.remove()
  }
}

describe('step welcome', () => {
  it('runs the custom start action without advancing onboarding', async () => {
    const onStart = vi.fn()
    const onNext = vi.fn()

    await mountAndClickStart({ onStart, onNext })

    expect(onStart).toHaveBeenCalledOnce()
    expect(onNext).not.toHaveBeenCalled()
  })

  it('advances onboarding when no custom start action is provided', async () => {
    const onNext = vi.fn()

    await mountAndClickStart({ onNext })

    expect(onNext).toHaveBeenCalledOnce()
  })
})

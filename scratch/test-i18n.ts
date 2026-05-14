import messages from '../packages/i18n/dist/locales/index.mjs'

import { createI18n } from '../apps/stage-tamagotchi/src/main/libs/i18n/index.ts'

const i18n = createI18n({ messages, locale: 'en' })
console.log('Testing resolution:')
console.log('tamagotchi.electron.tray.menu.labels.label.show:', i18n.t('tamagotchi.electron.tray.menu.labels.label.show'))
console.log('Full object for tamagotchi.electron.tray:', JSON.stringify(messages.en.tamagotchi.electron.tray, null, 2))

/// <reference types="@histoire/plugin-vue/components.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '@fontsource-variable/dm-sans'
declare module '@fontsource-variable/jura'
declare module '@fontsource-variable/quicksand'
declare module '@fontsource-variable/urbanist'
declare module '@fontsource/dm-mono'
declare module '@fontsource/dm-serif-display'
declare module '@fontsource/gugi'
declare module '@fontsource/kiwi-maru'
declare module '@fontsource/m-plus-rounded-1c'
declare module '@fontsource/sniglet'

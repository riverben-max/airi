import { join } from 'node:path'
import { cwd } from 'node:process'

import { loadEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  return {
    plugins: [
      Vue(),
    ],
    test: {
      include: ['src/**/*.test.ts'],
      env: loadEnv(mode, join(cwd(), 'apps', 'ui-server-auth'), ''),
    },
  }
})

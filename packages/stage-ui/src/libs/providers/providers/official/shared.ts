import { createOpenAI } from '@xsai-ext/providers/create'
import { getActivePinia } from 'pinia'

import { getAuthToken } from '../../../../libs/auth'
import { SERVER_URL } from '../../../../libs/server'

export const OFFICIAL_ICON = 'i-solar:star-bold-duotone'

export function withCredentials() {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const token = getAuthToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    if (getActivePinia()) {
      const { useChatSessionStore } = await import('../../../../stores/chat/session-store')
      const chatSession = useChatSessionStore()
      if (chatSession.activeSessionId)
        headers.set('x-airi-session-id', chatSession.activeSessionId)
    }

    const requestInit = {
      ...init,
      headers,
      credentials: 'omit',
    } as RequestInit & { duplex?: 'half' }

    if (init?.body instanceof ReadableStream)
      requestInit.duplex = 'half'

    return globalThis.fetch(input, requestInit)
  }
}

export function createOfficialOpenAIProvider() {
  return createOpenAI('', `${SERVER_URL}/api/v1/openai/`)
}

/**
 * Provider scoped to the audio surface (`/api/v1/audio/`). The OpenAI helper
 * (`createOpenAI`) builds upstream URLs as `<baseURL><resource>`, where
 * `<resource>` is e.g. `audio/speech`. We point baseURL at `/api/v1/` so the
 * generated URL is `/api/v1/audio/speech` — matching the audio routes
 * mounted in app.ts after they were split out of `/api/v1/openai/`.
 *
 * Returned provider still exposes the OpenAI-shaped `.speech()` API so xsai's
 * `generateSpeech()` can consume it directly.
 */
export function createOfficialAudioProvider() {
  return createOpenAI('', `${SERVER_URL}/api/v1/`)
}

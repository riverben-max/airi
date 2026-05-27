/**
 * Kokoro TTS domain types.
 *
 * Worker communication uses the unified protocol from protocol.ts.
 * These types define the domain-specific data structures (voices, etc.).
 */

import type { GenerateOptions } from 'kokoro-js'

export type VoiceKey = NonNullable<GenerateOptions['voice']>

export interface Voice {
  language: string
  name: string
  gender: string
}

export type Voices = Record<string, Voice>

// ---------------------------------------------------------------------------
// Legacy manager-level protocol shims (KokoroWorkerManager in index.ts).
// TODO: Remove in Phase 4 when KokoroWorkerManager is replaced by kokoro adapter.
// ---------------------------------------------------------------------------

export interface LoadedMessage {
  type: 'loaded'
  voices: Voices
}

export interface WorkerRequest {
  type: 'load' | 'generate'
  data: Record<string, unknown>
}

export interface ProgressMessage {
  type: 'progress'
  progress: number
}

export interface SuccessMessage {
  type: 'result'
  status: 'success'
  buffer: ArrayBuffer
}

export interface ErrorMessage {
  type: 'result'
  status: 'error'
  message: string
}

export type WorkerResponse = LoadedMessage | ProgressMessage | SuccessMessage | ErrorMessage

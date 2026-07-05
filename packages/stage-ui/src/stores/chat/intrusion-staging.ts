import { useBroadcastChannel } from '@vueuse/core'

// Module-level staging for cross-window intrusion injection.
// When the secondary window creates a journal moment, it broadcasts the staging data
// via BroadcastChannel. The main window stores it here so performSend can read it.
//
// This file is intentionally separated from chat.ts and memory-text-journal.ts
// to avoid circular imports between those two modules.

export const pendingIntrusionStaging: {
  journal?: { entryText: string, timestamp: number }
  artistry?: { prompt: string, timestamp: number }
} = {}

const { post: postIntrusionStaging } = useBroadcastChannel<
  { type: 'journal' | 'artistry', data: any },
  { type: 'journal' | 'artistry', data: any }
>({ name: 'airi-intrusion-staging' })

/** Stage a pending journal entry for injection into the next user turn. */
export function stageJournalIntrusion(data: { entryText: string, timestamp: number }, skipBroadcast = false) {
  pendingIntrusionStaging.journal = data
  console.warn('[Intrusion Staging] Journal intrusion staged locally:', data.entryText.substring(0, 50))
  if (!skipBroadcast) {
    postIntrusionStaging({ type: 'journal', data })
  }
}

/** Stage a pending artistry reflection for injection into the next user turn. */
export function stageArtistryIntrusion(data: { prompt: string, timestamp: number }, skipBroadcast = false) {
  pendingIntrusionStaging.artistry = data
  console.warn('[Intrusion Staging] Artistry intrusion staged locally:', data.prompt.substring(0, 50))
  if (!skipBroadcast) {
    postIntrusionStaging({ type: 'artistry', data })
  }
}

/** Clear the journal staging after it has been consumed by performSend. */
export function clearJournalStaging() {
  delete pendingIntrusionStaging.journal
  console.warn('[Intrusion Staging] Cleared journal staging after injection')
}

/** Clear the artistry staging after it has been consumed by performSend. */
export function clearArtistryStaging() {
  delete pendingIntrusionStaging.artistry
  console.warn('[Intrusion Staging] Cleared artistry staging after injection')
}

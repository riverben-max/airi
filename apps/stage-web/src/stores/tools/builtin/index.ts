import type { Tool } from '@xsai/shared-chat'

import { useDatingSimStore } from '@proj-airi/stage-ui/stores/dating-sim'
import { useArtistryStore } from '@proj-airi/stage-ui/stores/modules/artistry'
import { useStickersStore } from '@proj-airi/stage-ui/stores/stickers'

import { datingSimTools } from './dating-sim'
import { imageJournalTools } from './image-journal'
import { stickersTools } from './stickers'
import { textJournalTools } from './text-journal'

export async function builtinTools(): Promise<Tool[]> {
  const artistry = useArtistryStore()
  const stickers = useStickersStore()
  const datingSim = useDatingSimStore()

  const toolPromises: Promise<Tool[]>[] = []

  // Always enabled
  toolPromises.push(textJournalTools())

  // Artistry suite
  if (artistry.configured) {
    if (datingSim.enabled) {
      console.log('[builtinTools] 🎨 Artistry configured, but Dating Sim is enabled. Keeping image journal.')
    }
    toolPromises.push(imageJournalTools())
  }

  // Stickers library
  if (stickers.currentLibrary.length > 0) {
    console.log(`[builtinTools] ✨ Stickers library found (${stickers.currentLibrary.length}), enabling stickers tool.`)
    toolPromises.push(Promise.resolve(stickersTools()))
  }

  if (datingSim.enabled) {
    console.log('[builtinTools] 💖 Dating Sim enabled, enabling tools.')
    toolPromises.push(datingSimTools())
  }

  const groups = await Promise.all(toolPromises)
  const flattened = groups.flat()

  console.log(`[builtinTools] 🛠️ Total tools registered: ${flattened.length}`)
  return flattened
}

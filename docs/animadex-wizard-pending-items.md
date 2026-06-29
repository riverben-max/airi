# AnimaDex Wizard — Pending Items Summary

All items below are documented in [proposal-animadex-wizard.md](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/docs/proposal-animadex-wizard.md). None are currently implemented unless marked ✅.

---

## ✅ Implemented (This Session)

| Item | Detail |
|------|--------|
| Multi-actor ACTOR token routing in system prompt | Cast Roster index + per-character invocation hint |
| `confirmCreateCard` sets active card | Fixed `addCard` returning new nanoid — now captured correctly |
| Synthesis perspective rule | LLM instructed not to write "You are [UserNickname]" |
| ACTOR tokens in personality + description fields | All three assembly blocks updated |

---

## ⏳ Pending — Speech Related (§8)

All three gaps below are **speech/TTS related** and form one cohesive feature:

| # | Gap | Where | Effort |
|---|-----|--------|--------|
| 8.1 | `voiceConfig.ust` not included in LLM synthesis payload | `handleGenerate()` cast builder | Small — read `boundVoices[c.id]` → look up `speechStore.savedVoiceProfiles` |
| 8.2 | `modelPromptSpeech` field missing from LLM output schema | `systemMsg` schema definition | Small — add field + CRITICAL RULE |
| 8.3 | `speechExpressionPrompt` always written as `""` | `confirmCreateCard()` | Small — read `synthesisProposal.actors[key].modelPromptSpeech` |

**These are all one pipeline:** UST config → LLM payload → LLM translates to natural language → written to `speechExpressionPrompt` on card assembly.

---

## ⏳ Pending — Per-Character Idle Animations (§7)

Blocked on a **schema gap** — must fix card schema before wiring wizard UI.

| # | Item | Effort |
|---|------|--------|
| 7.1 | Add `idleAnimations?: string[]` to `visual_assets.[actor_key]` schema | Small |
| 7.2 | Runtime: model switcher reads per-actor `idleAnimations` on actor switch | Medium |
| 7.3 | Synthesis prompt: instruct LLM to populate `idleAnimations[]` from `motions[]` | Small |
| 7.4 | Wizard Step 2 UI: add per-actor idle picker to Manifestation panel | Medium |
| 7.5 | Card Edit UI: expose per-actor idle pickers in Acting tab for multi-actor cards | Medium |

---

## ⏳ Pending — Persistent Character → Model/Voice Binding Store (§6)

**New store required.** This is an independent feature that accelerates future wizard sessions.

| # | Item | Effort |
|---|------|--------|
| 6.1 | Create `CharacterBinding` store (IndexedDB key: `local:character-bindings`) keyed by AnimaDex trigger string | Medium |
| 6.2 | Auto-prefill model/voice slots in Step 2 from binding store on character load | Small |
| 6.3 | Write-back binding when user binds model or voice in Step 2 | Small |
| 6.4 | Add `🎭 Has Model` toggle filter chip to Step 1 catalog grid | Small |
| 6.5 | (Bonus) Visual badge overlay on catalog grid cards for characters with bindings | Small |
| 6.6 | Add `local:character-bindings` key to BYOS sync data inventory | Small (doc only) |

> **BYOS note**: The binding store is lightweight JSON (`Record<trigger, {displayModelId?, voiceProfileId?}>`). It should be treated as a **mergeable key** (merge by trigger key using LWW) in the sync engine — similar to `airi-cards`. No binary assets involved.

---

## ⏳ Pending — BYOS Sync Doc Updates (project-byos-cloud-sync.md)

The BYOS document predates several model schema changes and new stores. Needs updating:

| Item | Detail |
|------|--------|
| `DisplayModelFile` now has `expressions[]`, `motions[]`, `groups[]`, `tags[]`, `nsfw?` fields | These metadata fields are in `localforage` under `display-model-{id}` and must be included in the manifest sync |
| `DisplayModelURL` shares the same new fields | Same concern for URL-type entries |
| `local:character-bindings` new key | Should be added to the Data Inventory table as a mergeable key |
| Voice profiles (`local:speech/*` or equivalent) | Confirm key path and add to inventory if not present |
| Sync engine manifest.json | Confirm `expressions`, `motions`, `groups`, `tags`, `nsfw` are included when writing the remote `assets/models/manifest.json` |

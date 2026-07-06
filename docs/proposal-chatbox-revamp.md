# Proposal: Chatbox Revamp

## 1. Overview & Phased Roadmap
The goal is to evolve the AIRI Chatbox from a standard chat interface into a **hybrid conversation workspace** — a three-column, panel-driven layout where the composer, memory artifacts, and navigation context all coexist without fighting for space.

We will execute this in phases:
* **Phase 1 (MVP)**: Top header session selector, token metrics, brain button, settings ellipsis, inline send/greet composer endcaps. (COMPLETED)
* **Phase 2**: Context Artifact Band — Memories and Media Gallery collapsible headers, responsive rows, `[+ Add]` imagine modal, `[+ New]` journal entry trigger. (COMPLETED)
* **Phase 3**: Three-Column Layout, Left Side Panel, Right Context Panel, Bottom Toolbar Elimination, Top Toolbar Consolidation. (PLANNED)

---

## 2. Fixed Top Header (Phase 1 — Completed)
The top header transitions from a static title label into a functional **Control Hub**.

### Completed Features
* **Hamburger `☰`**: Far left — toggles the Left Side Panel (see Phase 3). Only visible at `md+`.
* **AIRI Logo + Label**: Brand anchor. Kept in title bar. Session selector lives immediately to its right.
* **Premium Session Selector**: A dropdown to switch chat timelines, placed next to the AIRI label.
* **Stacked Token Metrics**: One icon with two stat lines stacked vertically (Global · Session). Replaces the old side-by-side layout to save horizontal space.
  * _(Deferred)_ A visual context width meter (filled progress bar showing session tokens vs. the configured Context Width compaction threshold) should eventually replace the raw numbers. The "Context Width (Compaction Threshold)" is already a configurable setting. See §9 for details.
* **Brain Button**: Opens the active LLM selector (opens downward).
* **Memory & Context Popover**: Moved from the bottom toolbar to the top right. Now contains the **Trash** action (formerly a standalone bottom toolbar button) nested as a destructive action within this popover.
* **Vertical Ellipsis `⋮`**: Expanded to contain both Send Mode options AND the Grounding Options (previously a separate popover in the bottom toolbar). These are grouped as labelled sections within the same popover.

---

## 3. Context Artifact Band (Phase 2 — Completed)
Collapsible strip at the bottom of the chat area, above the composer. Visible in portrait mode and in landscape mode when the Right Panel is toggled off.

### Layout & Responsiveness
* **Renamed**: "Memory Tokens" → **Memories** (comprises STMM blocks, LTMM blocks, Journal Moments, Echo Chips).
* **Collapsible Panels**: Each panel (Memories / Media Gallery) has a header row. An eye icon collapses the carousel below. State persists in `localStorage` (`airi:chat:memories-collapsed`, `airi:chat:media-collapsed`).
* **Breakpoints**: Below `768px` → single stacked column. At `md+` → two columns side-by-side.

### Action Hooks
* **Memories Header**: `[+ New]` → opens `JournalMomentModal` to generate a journal entry from history. `[👁]` → collapse toggle.
* **Media Gallery Header**: `[+ Add]` → opens imagine prompt dialog, routes to `runArtistTask`. `[View All]` → triggers `StageBackgroundDialogPicker`. `[👁]` → collapse toggle.

---

## 4. Input Composer (Phases 1 & 2 — Completed)
The composer integrates inline quick-actions directly inside the textarea border.

### Completed Features
* **`[✨]` Magic Wand (Suggest Response)**: Inline transparent button, left of the send button. Neutral color, blends with input.
* **`[✈]` Send / Greet Button**: Solid primary pill. Greet mode (waving hand) when history is empty; Send mode (paper plane) when typing.

### Planned (Phase 3)
* **`[+]` Attach Button**: Replaces the Images & Screenshots popover trigger. Lives to the left of the magic wand. Opens a reduced 2-item popover: Take Screenshot + Attach Image.

---

## 5. Phase 3: Three-Column Workspace Layout

### Architecture Overview
```
Portrait  (<768px):
┌──────────────────────────────────────────────────────────────────┐
│ [ ☰ ] [ AIRI ] [ Session Selector ] ... [ Metrics ] [Brain] [⋯] │
├──────────────────────────────────────────────────────────────────┤
│              Chat History                                        │
│              Context Band (Memories + Media Gallery)             │
│              Composer                                            │
└──────────────────────────────────────────────────────────────────┘

Landscape (>=768px, right panel off):
┌────────────────────────────────────────────────────────────────────────┐
│ [ ☰ ] [ AIRI ] [ Session ] ... [ Metrics ] [ Mem&Ctx ] [Brain] [⋯]   │
├──────────────────┬─────────────────────────────────────────────────────┤
│  Left Panel      │  Chat History                                       │
│  (if open)       │  Context Band                                       │
│                  │  Composer                                           │
└──────────────────┴─────────────────────────────────────────────────────┘

Landscape (>=768px, right panel on):
┌────────────────────────────────────────────────────────────────────────┐
│ [ ☰ ] [ AIRI ] [ Session ] ... [ Metrics ] [ Mem&Ctx ] [Brain] [⋯]   │
├──────────────────┬──────────────────────────────┬──────────────────────┤
│  Left Panel      │  Chat History                │  Right Panel         │
│  (if open)       │  (no Context Band)           │  (Memories +         │
│                  │  Composer                    │   Media Gallery)     │
└──────────────────┴──────────────────────────────┴──────────────────────┘
```

### Key Layout Rules
* **Right Panel is mutually exclusive with the Context Band.** When the right panel is visible, the context band is hidden (they show the same data in different layouts). When the right panel is hidden, the context band returns.
* **Right Panel toggle button** is only shown at `md+`. Portrait mode always uses the Context Band.
* **If the user has right panel toggled on and switches to portrait mode**, the right panel is suppressed and the context band is shown automatically. The toggle state is preserved so switching back to landscape restores the right panel.
* **Left Panel toggle (hamburger `☰`)** is sticky — persists in `localStorage` (`airi:chat:left-panel-open`). Only shown at `md+`.
* The left panel, when open, acts as a parent wrapper and controls the full width of the center + right columns.

---

## 6. Phase 3: Bottom Toolbar Elimination

### Old Bottom Toolbar Items → New Destinations

| Old Button | New Home | Notes |
|---|---|---|
| **Take Screenshot** | `[+]` composer popover | 2-item mini popover |
| **Attach Image** | `[+]` composer popover | 2-item mini popover |
| **Imagine Mode toggle** | Removed | Covered by Media Gallery `[+ Add]` |
| **Visit Image Studio** | Removed | Redundant with Left Panel |
| **Stage Style** | Removed | Redundant with `View All` + Left Panel |
| **Memory & Context popover** | Top toolbar | Moved as-is; gains Trash action inside |
| **Grounding Options popover** | `⋯` ellipsis | Merged as a new labelled section |
| **Trash 🗑** | Memory & Context popover | Destructive action nested within |

**Result**: The bottom toolbar row disappears entirely. The composer becomes:
`[+]` · `[✨]` · `[textarea]` · `[✈ Send/Greet]`

---

## 7. Phase 3: Left Side Panel

The left panel is a navigation sidebar that persists open/closed independently. It houses views that used to be buried in modals or inaccessible.

### Left Panel Items (priority order)
1. **Chat** _(active indicator, current view)_
2. **Director's Monitor** — Running historical thread of director notes, generated images, and narrative beats. First-class scrollable artifact view, not a bubble context menu item.
3. **World Bible** — Replaces the "View System Prompt" modal. Full concatenated character card system prompt rendered as a scrollable first-class view.
4. **Characters** — Quick-glance Studio view of the active character card. Potential character switching.
5. **Media** — Full inline gallery view, replacing the need for the Media sheet/page.
6. **Archives** — Surfaces the Lifetime Artifact view (formerly buried under Context & Memory → Memory Management → Lifetime Artifact). First-class one-click destination.
7. **Notes** — Scratch notes or journal entries surface.
8. _(Settings link at bottom)_

---

## 8. Phase 3: Right Context Panel

The right panel is a **vertical stacked** version of the Context Artifact Band, shown only at `md+` when toggled on. It offers richer card layouts since it has more vertical room.

### Right Panel Differences vs. Context Band
* Memory cards are taller and show more preview text.
* Media Gallery renders in a 3-column image grid.
* **No `View All` button** in the Media Gallery header (the Left Panel's Media view replaces it).
* **No `+ Add` card in the gallery grid** — the `[+ Add]` header button remains.
* The `[+ New]` Memories button remains.

---

## 9. Token Metrics Redesign (Deferred)

> [!NOTE]
> The old bottom toolbar had a 2-slot loading-bar widget showing current context tokens vs. the model's configured Context Width (Compaction Threshold). This was lost during the port. It should be reimagined and restored.

**Goal**: Give the user a visual at-a-glance sense of how full the context window is relative to the configured `Context Width (Compaction Threshold)` setting (stored per card, e.g. `1,000,000` tokens).

**Proposed New Design**: The stacked metrics element in the top toolbar (one icon + two stat lines) could gain a thin progress bar underline or background fill indicating `sessionTokens / contextWidth`. Color shifts neutral → amber → red as it approaches capacity.

---

## 10. Relevant Component & Data Store File Paths

### Component UI Files
* **Chat Page**: [chat.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/pages/chat.vue)
* **Interactive Area**: [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue)
* **Journal Moment Modal**: [JournalMomentModal.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/JournalMomentModal.vue)

### Data Stores
* **Session Store**: [session-store.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts)
* **Character Card Store**: [airi-card.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/airi-card.ts)
* **Text Journal Store**: [memory-text-journal.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/memory-text-journal.ts)

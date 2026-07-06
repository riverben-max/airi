# Proposal: Chatbox Revamp

## 1. Overview & Phased Roadmap
The goal is to evolve the AIRI Chatbox from a standard chat interface into a **hybrid conversation workspace** by introducing a fixed top header for session controls and streamlining the bottom input area.

We will execute this in two phases:
* **Phase 1 (MVP)**: Focuses on the top header's session selector, token metrics, brain button, and simple inline inputs (Magic Wand/Attachment inside composer).
* **Phase 2 (Long-term)**: Focuses on the hamburger button (side-menu), top-right ellipsis settings panel, and context band optimizations.

---

## 2. Fixed Top Header
The top header transitions from a static title label into a functional **Control Hub**.

### Phase 1 (MVP)
* **Word "AIRI"**: Placed on the left as a clean brand identifier.
* **Premium Session Selector**: A stylized, premium dropdown (not a native HTML `<select>`) to switch chat sessions instantly. This resolves the current multi-step workflow of going to `Memory & Context > Session Management`.
* **Token Metrics Pair**: Displays both global usage metrics and per-session metrics side-by-side in the top-right corner.
* **Brain Button**: Promoted to the top right to easily change the active LLM.

#### Session Selector Format & Naming Logic
The main label of the dropdown will resolve using active character details and session metadata:
* **Base Actor Name**: Resolves to `nickname` first, falling back to `name` from the active card.
* **Universe & Title Suffix**: Appends parenthetical details in the format `(universeId>title)` using the following rules:
  1. **Universe ID**: If `universeId` is `"global"`, it is omitted.
  2. **Session Title**: If `title` is `"Untitled Timeline"` or empty/falsy, it is omitted.
  3. **Parentheses block**: If both universe and title are omitted, the entire `(universeId>title)` suffix block is stripped.
  4. **Single-element fallback**:
     * If only `universeId` is valid: `({nickname || name} ({universeId}))`
     * If only `title` is valid: `({nickname || name} ({title}))`
     * If both are valid: `({nickname || name} ({universeId}>{title}))`

*Examples:*
* `Mori` (where universe is `global` and title is `Untitled Timeline`)
* `Mori (cyberpunk)` (where universe is `cyberpunk` and title is `Untitled Timeline`)
* `Mori (Special Episode)` (where universe is `global` and title is `Special Episode`)
* `Mori (cyberpunk>Neon Streets)` (where universe is `cyberpunk` and title is `Neon Streets`)

### Phase 2
* **Hamburger Button**: Left-aligned, reserved for a hidden side menu to house desktop-specific options.
* **Vertical Ellipsis Button (`⋮`)**: Far right-aligned, acting as an overflow menu for miscellaneous controls and advanced settings.
* **Send Style Configuration**: The send-style selection caret/notch from the original send button will be integrated here (controlling the global send behavior/mode).

---

## 3. Context Artifact Band (Memory & Media)
Instead of wasting vertical space with standard layout headers, the band will be kept thin and optimized.

### Layout Breakpoints
* **Desktop / Wide Layout**: Rendered as a single horizontal band split down the middle (Left = Memory, Right = Media) to maximize vertical content space.
* **Mobile / Portrait Layout**: Splits into two distinct, thin stacked rows.

### Memory Tokens
* **"New" Button**: Positioned in the corner to trigger the existing **Journal Moment** feature.
* **Capsules**: Styled as compact, color-coded state/relationship summary cards.

### Media Gallery
* **"View All" Trigger**: Bound to the existing media/gallery modal, reusing the codebase's existing preview hooks.
* **Endcap "Add" Button**: Rejected to keep the strip clean.

---

## 4. Action Toolbar
The toolbar is simplified and acts as a minor utility tray for what remains:
* Retains leftover icons that cannot be cleanly placed in the header or inline text area (e.g., config filter, refresh, camera, and clear/trash).

---

## 5. Input Composer (Textarea)
The input composer integrates inline quick-actions directly inside the text box border to keep the layout tight.

* **Inline Magic Wand (Producer Lite)**: Placed inline within the textarea (replacing the mockup's `@` button) to generate magical suggestions on the fly.
* **Inline Attachment Button (`+`)**: Placed inline within the textarea to quickly attach media, bypassing the need to click through the camera menu first.
* **Inline Send Button**: A simple paper-plane icon positioned inline on the far right. Custom dispatch styles (send modes) are delegated to the top-right ellipsis menu.

---

## 6. Relevant Component & Data Store File Paths
Below are the key code locations to target during implementation:

### Component UI Files
* **Header/Main Host**: [InteractiveArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/apps/stage-tamagotchi/src/renderer/components/InteractiveArea.vue)
* **Chat Layout Widget**: [ChatArea.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-layouts/src/components/Widgets/ChatArea.vue)
* **Parallel Timelines Modal**: [ChatSessionModal.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/ChatSessionModal.vue)
* **Input Composer**: [WhisperDock.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/components/scenarios/chat/WhisperDock.vue) and [basic-text-area.vue](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/ui/src/components/form/textarea/basic-text-area.vue)

### Data Stores
* **Session Store**: [session-store.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/chat/session-store.ts)
  * Accessible via `useChatSessionStore()`
  * Exposes `activeSessionId` and `sessionMetas` (containing metadata like `universeId` and `title` per session).
* **Character Card Store**: [airi-card.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/modules/airi-card.ts)
  * Accessible via `useAiriCardStore()`
  * Exposes `activeCard` (which contains `name` and `nickname` properties).

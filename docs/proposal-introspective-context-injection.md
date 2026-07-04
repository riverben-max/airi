# Proposal: Introspective Context Injection (Dream & Journal Intrusion)

## 1. Overview
This proposal introduces a unified class of runtime prompt injections called **Introspective Context Injection**. Unlike standard RAG or user-message concatenation (which directly alters user inputs or pollutes the chat history), this class utilizes the runtime system context block assembled during the sending pipeline (`performSend` in `chat.ts`).

By injecting ephemeral system instructions on the very next turn when a conversation resumes, we allow the character to introspect and react to out-of-band or background events (like dreaming, text journaling, or generating artwork) that do not natively register in the flat user/assistant chat history.

---

## 2. Introspection Channels

This pattern supports three primary introspective vectors:

### A. Dream Intrusion
* **Context**: Triggered by idle-time dream consolidation (Echo Chips).
* **The Injection**:
  > `[DREAM INTRUSION]`
  > `You just spoke with the user {timeToDream} minutes ago, and in the time since, you had a dream about: {insertEchoChips}.`
  > `For this turn only, continue to address the user and find a natural way to work in that you had a dream and what it was about as part of your response.`

### B. Journal Intrusion
* **Context**: Triggered by background "Journal Moments" or in-band `text_journal` tool executions.
* **The Injection**:
  > `[JOURNAL INTROSPECTION]`
  > `You just wrote the following entry in your journal {timeSinceJournal} minutes ago:`
  > `"{journalEntryText}"`
  > `For this turn only, continue the conversation and find a natural way to reflect on this action, the feelings you recorded, or your state of mind in your response.`

### C. Artistry Intrusion (Image Journal)
* **Context**: Triggered by background autonomous artistry runs or in-band `image_journal` creations.
* **The Injection**:
  > `[ARTISTRY INTROSPECTION]`
  > `You just finished creating a new artwork of: "{imagePrompt}".`
  > `For this turn only, continue the conversation and find a natural way to reference or react to having just made this creation.`

---

## 3. Structural Schema Extensions

To support configuring and tracking these pending introspective states, we will expand both the character card extensions and the session metadata.

### Character Card Settings (`packages/stage-ui/src/types/card.schema.ts`)
Settings are centralized under the card's `extensions.airi`:
```typescript
const AiriDreamStateSchema = object({
  enabled: boolean(),
  strictAfkGating: boolean(),
  journalingThreshold: union([literal('minimal'), literal('balanced'), literal('lush')]),
  maxSessionsPerDay: number(),
  sessionTimeoutMinutes: number(),
  afkThresholdMinutes: number(),
  minConversationTurns: number(),
  lastProcessedAt: optional(number()),
  dailyRunDate: optional(string()),
  dailyRunCount: optional(number()),

  // Settings toggling intrusion behaviors
  injectDreamContext: optional(boolean()), // Managed in Tools Tab
  injectJournalContext: optional(boolean()), // Managed in Tools Tab
  injectArtistryContext: optional(boolean()), // Managed in Tools Tab

  // Dream transient staging
  pendingDreamChips: optional(array(string())),
  pendingDreamTimestamp: optional(number()),
})
```

### Session Metadata (`packages/stage-ui/src/types/chat.ts`)
Session-specific actions (like journaling and artistry) hold their transient pending state on the active session record to prevent cross-session leaks:
```typescript
interface ChatSessionMeta {
  // Existing fields ...
  pendingJournalMoment?: {
    entryText: string
    timestamp: number
  }
  pendingArtistryMoment?: {
    prompt: string
    timestamp: number
  }
}
```

---

## 4. Execution Pipeline (`performSend` in `chat.ts`)

During the sending pipeline:
1. **Collate Pending Introspections**: Check the active card and the active session metadata for pending dream, journal, or artistry state.
2. **Build Prompt Segments**: For each pending item, compute elapsed time (`Math.max(1, Math.round((Date.now() - timestamp) / 60000))`) and construct its corresponding instruction block.
3. **Inject to System Context**: Append the compiled prompts into the runtime system/metadata payload (`contextContent`) which is injected immediately following the main System Prompt.
4. **Flush Pending State**: Right after generating `newMessages` for streaming, clear the transient state:
   * Delete `pendingDreamChips`/`pendingDreamTimestamp` from the card.
   * Delete `pendingJournalMoment`/`pendingArtistryMoment` from the active session metadata.
   This guarantees that the character only reacts to these events on the immediate next turn, preventing repeated output loops.

---

## 5. UI Integration & Configuration

All toggle preferences (`injectDreamContext`, `injectJournalContext`, `injectArtistryContext`) will reside in the new **Tools Tab** of the card creator, while session-specific actions (like background Journal Moments) will inherit these defaults but remain overrideable at trigger time.

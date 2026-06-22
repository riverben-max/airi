# Architectural Specification: prefix Cache Alignment & DRY prompt Compilation

This document outlines the standard for **prefix Cache Alignment** across the AIRI subsystems to minimize API cost and latency, and proposes a DRY context-builder utility.

---

## 1. The Core Caching Problem
For LLM providers supporting prefix caching (e.g. DeepSeek, OpenRouter, Gemini), the engine caches the input prompt sequence from the beginning.
* Any modification in the initial tokens (such as appending a timestamp, system load, or changing sensor logs *above* the history) completely **invalidates the entire cache**.
* Slicing a different count of history messages (e.g., using 6 messages for proactivity, but 15 for chat, and all for journaling) creates mismatching history indices, preventing cache hits.

```
[System Prompt] -> [Sensor Data (Deltas)] -> [Conversation History] ❌ INVALIDS CACHE
[System Prompt] -> [Conversation History] -> [Tail/Instruction (Deltas)]  ✅ CACHE HITS
```

---

## 2. Subsystem Audit & Common Patterns

We have identified 4 distinct prompt-compilation flows that build overlapping context arrays.

### A. Producer Lite
* **Path:** [use-producer.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/composables/use-producer.ts#L151-L222)
* **Status:** Supports a `cacheAligned` toggle. When active, it reconstructs the exact system prompt, sensor payloads, and full history of the active chat. When off, it slices a custom `contextDepth` history and constructs a plain text transcript.

### B. Proactivity Heartbeat
* **Path:** [proactivity.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/proactivity.ts#L540-L602)
* **Status:** Injects volatile environmental sensors (e.g. CPU load, active window titles, idle seconds) directly into the system block. Slices a hardcoded `recentMessages.slice(-6)` context window.

### C. Journal Moments
* **Path:** [memory-text-journal.ts](file:///Users/richardpinedo/Projects.nosync/airi/airi_dasilva333/packages/stage-ui/src/stores/memory-text-journal.ts#L431-L501)
* **Status:** Resolves the active card system prompt, constructs context snapshots, and maps message arrays. Slices whatever history length the user targets from the chat bubble context menu.

### D. Destiny 2 Event-Driven VLM Loop
* **Path:** (Proposed plugin)
* **Status:** Leverages local WebGPU VLM crops to evaluate states. When generating a proactive speech check, it targets the same system prompt structure but inserts the active game state at the tail.

---

## 3. The Unified Prefix Builder API (DRY)

To resolve duplicate context-assembly code and guarantee consistent cache alignment, we define a core helper utility: `useContextBuilder`.

```typescript
interface ContextBuilderOptions {
  activeCard: AiriCard
  messages: ChatHistoryItem[]

  // Custom Controls to allow users/subsystems to choose caching profiles:
  historyMode: 'full' | 'slice'
  sliceCount?: number

  injectSensors: boolean
  instructionSuffix?: string
}

export function compileCacheAlignedPrompt(options: ContextBuilderOptions) {
  const systemMessages: Array<{ role: 'system', content: string }> = []

  // 1. Core System Prompt (The absolute static prefix)
  const baseSystemPrompt = buildSystemPrompt(options.activeCard)
  if (baseSystemPrompt) {
    systemMessages.push({ role: 'system', content: baseSystemPrompt })
  }

  // 2. Conversation History (Formatted identically across chat, producer, journal)
  const historyLimit = options.historyMode === 'slice' ? (options.sliceCount || 6) : options.messages.length
  const conversationMsgs = options.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-historyLimit)

  const formattedHistory = conversationMsgs.map(m => ({
    role: m.role,
    content: extractRawText(m.rawContent || m.content)
  }))

  // 3. Volatile Sensor Payloads & Context Overlays
  // CRITICAL: Appended AFTER the static prefix or as system directives before instructions
  const systemContext: string[] = []
  if (options.injectSensors) {
    systemContext.push(proactivityStore.sensorPayload)
  }

  if (systemContext.length > 0) {
    systemMessages.push({ role: 'system', content: systemContext.join('\n---\n') })
  }

  // 4. Instructions / Actions (The tail of the prompt)
  const userMessages = [...formattedHistory]
  if (options.instructionSuffix) {
    userMessages.push({ role: 'user', content: options.instructionSuffix })
  }

  return {
    messages: [
      ...systemMessages,
      ...userMessages
    ]
  }
}
```

---

## 4. User Configuration & Controls

To respect user settings when prefix caching is not supported by their provider, we add new configurations under **Proactivity** and **Memory** settings:

```
Settings > Behavior > LLM Performance
┌────────────────────────────────────────────────────────┐
│  [X] Enable Prefix Cache Alignment                     │
│      Aligns system prompt and history templates to     │
│      maximize OpenRouter/Gemini cache hits.            │
│                                                        │
│  Conversation History Scope:                           │
│  ( ) Slice last [ 6  ] messages (Saves output tokens)  │
│  (X) Full History (Maximizes character context memory) │
└────────────────────────────────────────────────────────┘
```

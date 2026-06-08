# Proposal: Dynamic Memory RAG Injection via Grounding Options Popover

## Background & Problem

The model only knows what's explicitly in its context window. Cross-session memories — past conversations, emotional beats, recurring topics — are effectively invisible unless manually surfaced. Even modern long-context models (500K+ tokens) suffer significant needle-in-haystack recall degradation as history grows. The character may repeat mistakes, forget established facts about the user, or respond as if each session is their first meeting.

Today, the grounding chip button (`i-solar:cpu-bold-duotone`) already solves one slice of this: it injects real-time environmental telemetry (idle time, active window, system load, local time) ephemerally into each inference call. That plumbing — inject at send time, never pollute session history, rebuild fresh each turn — is exactly the right pattern. This proposal extends that same mechanism into a full **context assembly control panel** covering sensor data, in-session semantic recall, and cross-session memory retrieval.

---

## UX Pivot: Chip Button → "Grounding Options" Popover

Rather than a simple toggle, the `i-solar:cpu-bold-duotone` button becomes a **popover trigger**, following the established `ChatBrainPopover` / `ChatMemoryPopover` / `ChatImagesPopover` pattern in `InteractiveArea.vue` using `reka-ui`'s `PopoverRoot` / `PopoverContent`.

### New Component: `ChatGroundingPopover.vue`

Panel header: **Grounding Options**
Subheader: *Control what contextual data is bundled into each message.*

The panel exposes four independent toggle rows, each persisted in the active card's `extensions.airi` config:

---

### Toggle 1 — Include System Context
> *Attach sensor data to the conversation*

The existing grounding feature, now surfaced as a named, independently toggle-able option. When enabled, the current environmental telemetry payload (`[ENVIRONMENTAL AWARENESS]` block) is injected into inference — exactly as it works today.

On hover, a live preview panel expands showing the actual current sensor payload — mirroring the pattern already used in the Proactivity tab's sensor preview popover.

---

### Toggle 2 — In-Context Semantic History
> *Attach relevant snippets from this session*

Runs a semantic search against the **current session's** messages using the user's outgoing message as the query vector. The top-N scored snippets above a confidence threshold are formatted and injected as a `[IN-SESSION CONTEXT]` block.

**Rationale for this being an option at all:** Even within a single session, some models at high token counts struggle with recall of things said hundreds of messages ago. This surfaces those moments deliberately without relying on raw positional attention.

On hover, shows a sample of what a retrieved snippet block looks like when populated.

---

### Toggle 3 — All Semantic History
> *Attach relevant snippets from other sessions*

Runs the same semantic search but across **all past sessions** for the active character, excluding the current session (which Toggle 2 already covers). Surfaces the most relevant cross-session memories — recurring themes, things the user mentioned in the past, established facts about their life.

This is where tone & persona dilution risk is highest. A bad retrieval drags in irrelevant or contradictory memories, causes the character to surface topics the user didn't bring up, or derails their voice entirely. **This toggle is gated behind semantic search quality** — see the Quality Gate section below.

On hover, shows a sample of what a cross-session snippet block looks like.

---

### Toggle 4 — Recent Topics
> *Attach a weighted list of recently discussed topics*

A lightweight, **embedding-free** context signal. The system maintains a per-card topic frequency map across sessions, with a time-decay weight — topics discussed recently score higher, topics not mentioned in a while fade. Think simple TF-IDF over conversation history with an exponential decay curve on the timestamp.

The injected block is compact and human-readable:

```
[RECENT TOPICS]
Topics this user has been talking about lately (by recency & frequency):
- work stress (high — last 2 days)
- the park picnic (medium — last session)
- Charlie the dog (medium — ongoing)
- productivity & deadlines (fading — last week)
```

This is different from Toggles 2 and 3 in a critical way: **it doesn't retrieve specific memory snippets**, it surfaces *what the user has been thinking about* as a lightweight orientation signal. The character doesn't need the full journal entry about the park — just knowing the park has been on the user's mind recently is enough context to make her response feel tuned in.

**Key advantage: ships without a semantic search index.** The quality gate that blocks Toggles 2 and 3 does not apply here. Topic tracking is derivable from conversation history that already exists. No embedding pipeline, no vector store, no recall precision problem.

On hover, shows the actual current topic weight table for this card.


A link row at the bottom of the popover — styled like the "Visit Image Studio" shortcut in the same component family — that navigates directly to:

**Settings → AIRI Cards → (pencil icon) → Proactivity Tab**

This is where the user controls which sensor dimensions are active (e.g. disable active window tracking but keep local time). Without this shortcut, that config is buried 3 levels deep. The link surfaces it exactly where the user's attention already is when they're thinking about context.

---

## Architecture: How the Sources Bundle Together

All four enabled sources feed into the **same `contextContent` string** that the existing orchestrator already composes in `chat.ts` (lines 863–896). Each active source appends a tagged section in order:

```
[ENVIRONMENTAL AWARENESS]
Local time: 10:11 PM
Active window: VS Code — chat.ts
Idle time: 2 minutes
...

---

[RECENT TOPICS]
Topics this user has been talking about lately:
- work stress (high — last 2 days)
- the park picnic (medium — last session)
- Charlie the dog (medium — ongoing)

---

[IN-SESSION CONTEXT]
Relevant moments from this conversation:
- User mentioned they've been stressed about the deadline (4 messages ago)
- User asked about the park earlier

---

[MEMORY RECALL]
Relevant memories from past sessions:
- User has a dog named Charlie (session: June 3)
- User dislikes when the character brings up productivity unprompted (session: May 28)
```

All blocks are **injected ephemerally** into the `newMessages` array at inference time. They are never written into the persisted session history. The block is rebuilt fresh on every turn. No residue, no growing trail of system messages.

This is a pure extension of the existing pattern — no new lifecycle management is needed.

---

## The Semantic Search Quality Gate

Toggles 2 and 3 are **visually disabled with an explanatory label** when no semantic search index is available for the active character. The label reads:

> *Requires semantic search index — not yet available for this character*

This is the honest gate. Shipping these toggles without a first-class, near-zero false-positive retrieval engine would actively harm character quality:

- **Persona dilution**: retrieved snippets written in a different emotional register bleed into the character's voice
- **Irrelevant surfacing**: the character brings up things the user didn't ask about, breaking immersion
- **Contradiction injection**: past context that conflicts with the current session's established facts

The feature is designed to gracefully degrade — Toggle 1 (sensor data) works independently and is unaffected. Toggle 4 (Recent Topics) also works independently — see the next section. Toggles 2 and 3 light up when the search backend is ready.

---

## Topic Interest Tracking (TF-IDF Decay) — Ships Before Semantic Search

Toggle 4 is deliberately architecturally isolated from the semantic search quality gate. It's the one piece of the context assembly system that can ship in a useful, non-harmful state without a vector store.

### How the Decay Model Works

For each card, maintain a topic frequency map: `Map<topic: string, { count: number, lastSeen: timestamp }>`.

Weight is computed as:
```
weight(topic) = count × decay(now - lastSeen)
decay(Δt) = e^(-λ × Δt)   // exponential decay, λ tunable
```

A topic discussed heavily last week but not mentioned since will have faded to a low weight. A topic that came up three times today is high. The top-N topics by weight get injected.

The topic extraction itself can be as simple or as sophisticated as the implementation allows:
- **Simple**: noun phrase extraction from the conversation history using a lightweight NLP pass (e.g. compromise.js, already potentially in the dependency tree)
- **Better**: LLM-assisted topic tagging as a post-turn background step (cheap, ~1 call per session end)
- **Obsidian-style**: if the user connects an Obsidian vault, the topic list is enriched with note titles and tags from their vault as additional topic seeds

### Why This Is Safer Than Semantic Snippets

The character receives *topic names*, not *memory content*. She knows the user has been thinking about work stress — she doesn't get injected with a specific quote or snippet that might be tonally jarring, out of context, or contradictory. She naturally weaves it in at her own discretion. The dilution and false-positive risks that gate Toggles 2 and 3 are substantially reduced.

### The Obsidian Angle

Shinobu's Obsidian integration is interesting specifically because Obsidian's graph is already a manually-curated topic interest map — the user's note structure *is* their topic weight table, maintained by hand. An optional Obsidian vault connection could seed or supplement the auto-derived topic map with the user's own knowledge graph. This is a natural integration point, not a core dependency.

---

## Gemini & Single-System-Prompt Providers

Gemini enforces a single system prompt at position 0; subsequent `role: system` messages are rejected. The proposal documents a transparent merge strategy: when the active provider is detected as Gemini (or any other single-system-prompt provider), all enabled context blocks are **silently folded** into the base system prompt behind an internal delimiter rather than injected as a second system message.

This behavior is entirely hidden from the user. The popover UI and toggles work identically regardless of provider. The merge is handled internally in the orchestrator's message composition step.

---

## UI Token Tags (Follow-on Idea)

For users who want to see exactly what's being injected without reading a popover, a follow-on feature would surface injected context as **badge tags** in the message composer — appearing between the input area and the send button, similar to how image attachments are previewed:

```
<|MEMORY: User mentioned they have a dog named Charlie|>
<|SENSOR: Local time is 10:11 PM|>
Hey, how are you?
```

The user's typed message stays clean. The badges are rendered separately and are dismissible. They hook into the existing `llm-marker-parser` in `chat.ts` for detection and stripping before display.

This is a follow-on — not part of the popover scope.

---

## Open Questions

### Which memory pillars are queried?

The system has four distinct memory surfaces:

| Pillar | Description |
|---|---|
| **Long-Term** | Journal entries — narrative records of what happened |
| **Short-Term** | Daily summaries — distilled recaps of recent sessions |
| **Lifetime** | Lifetime distills — the highest-level character memory |
| **Echo Chips** | Semantic mood/flavor chips synthesized from conversations |

Rather than querying all four blindly, the user should be able to configure **which pillars are active** per card — e.g. "I want my character to draw only from her journal and lifetime memories, not daily summaries." Echo chips in particular may have limited value as a retrieval source given their terse, evocative format. This configuration logically belongs in the **Manage Context Data** surface alongside toggle 1's sensor config.

### Where does "Manage Context Data" live — Proactivity tab or its own tab?

Currently the sensor data configuration (which dimensions to include — active window, idle time, system load, local time) lives in **Settings → AIRI Cards → Proactivity tab**. As the context data system grows to include memory pillar selection, token budgets, and score thresholds, that tab may become an odd fit. **Open question: should this graduate to its own dedicated tab?** The Proactivity tab's primary job is proactive message scheduling — context assembly is a related but distinct concern.

### Token budget

How many total tokens can the injected context block consume before it starts crowding out the actual conversation? A sensible default (e.g. 800 tokens) with a user-configurable override per card makes sense here. The budget should be split across active pillars proportionally, or configurable per-pillar.

### Score threshold

What minimum relevance score qualifies a snippet for injection? This is highly character- and use-case-dependent. A user testing retrieval quality should be able to visit **Manage Context Data**, dial the threshold up or down, and see the ranked results for a given query — with scores visible — to tune their setup. This suggests the Manage Context Data surface needs a **live retrieval debugger**: enter a sample query, see the ranked snippets and their scores, adjust threshold, observe the change.

### Cross-session deduplication across turns — **Resolved: don't do it**

Consider this exchange:

```
Richard: that was a nice time we had last night, wasn't it?
AI: yeah that was real nice, thank you

[grounding injects: "park picnic — crackers and smoked salmon"]

Richard: so anyways you wanna go to the park again and do that same thing?
AI: I'd love to bring the crackers again!

Richard: what about the salmon, should I get that or something else?
```

The question was: should we track that snippet `[memory-123]` was already injected last turn and skip re-injecting it this turn to avoid "spamming" the model?

**No.** The grounding block is composed ephemerally and fresh on every turn — it leaves no breadcrumb in the session history. If the salmon memory is still the highest-scoring retrieval result for the current user message, it *should* come back. It is the model's lifeline. Blacklisting recently-used snippets mid-conversation would strip the model of its recall precisely when the conversation is actively revolving around that topic. There is no deduplication logic needed.

# Proposal: Unified Tools Configuration Tab

## 1. Overview
As AIRI's capability library has grown, settings related to tool invocation (toggles, proper vs. token call presentation modes, prompt overrides, and post-execution introspective injections) have become scattered across multiple card editor panels:
* **Generation Tab**: Handles generic parameters but also gets mixed up with tool activation lists.
* **Artistry Tab**: Handles image generation parameters but also carries the "Autonomous Artistry" configuration and token/proper toggle rules.
* **Proactivity Tab**: Handles heartbeats and scheduling, but has also inherited memory consolidation (Dream State) settings.

This proposal introduces a unified **Tools Tab** (`CardCreationTabTools.vue`) in the character card editor. This tab centralizes configurations related to:
1. Available tools (toggles to include in the inference context).
2. Presentation modes (Zod proper API tool call vs. custom XML/text token markers).
3. Introspective next-turn injection options.

---

## 2. Interface Layout & Groupings

The new **Tools Tab** will be organized into three logical panels:

### Group A: Tool Capability Registry (In-Context Array)
Enables or disables exposing specific capabilities to the model's standard OpenAI/Gemini tools array.
* **`image_journal`** (formerly known as Artistry tool): Captures and displays image assets.
* **`text_journal`**: Memory retrieval and logging tool.
* **`widgets` (Staging/ComfyUI)**: Spawns interactive stage components.
* **`stickers`** *(DORMANT / PHASED)*: Triggers tactical pseudo-sticker overlays on the stage/chat.
* **`dating_sim`** *(DORMANT / PHASED)*: Control choice tree selection, relationship score edits, and variable tracking.

### Group B: Tool Presentation Formats
Defines how tools are formatted during inference. Choosing **Token Mode** instructs the model to use inline text markers (which are dynamically bridged to execution), preserving context history and bypassing provider structural limitations.
* **`image_journal` Presentation Mode**:
  * `[o] Proper Tool Call (API)`
  * `[ ] Token Call (Marker)` (e.g. `<|image_journal:mode="chat",prompt="..."|>`)
* **`text_journal` Presentation Mode**:
  * `[o] Proper Tool Call (API)`
  * `[ ] Token Call (Marker)` (e.g. `<|text_journal:action="create",content="..."|>`)
* **Custom Format Instructions**: Textarea allowing custom prompts to guide token rendering behavior for selected tools.

### Group C: Introspective Context Injections
Allows configuring next-turn behavior for out-of-band actions:
* **Journal Intrusion (`injectJournalContext`)**:
  * Checkbox to govern next-turn reflection on text entries written in-band (by the model) or out-of-band (via manual Journal Moments).
* **Artistry Intrusion (`injectArtistryContext`)**:
  * Checkbox to govern whether background autonomous artistry runs (or manual `image_journal` creations) trigger a next-turn system-level awareness message:
    > `[ARTISTRY INTROSPECTION] You just finished creating a new artwork of: "{prompt}".`

*Note: Core scheduling, timers, and AFK gating for the Dream State remain strictly within the **Proactivity Tab**, as they govern offline scheduler operations.*

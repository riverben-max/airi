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
* **`image_journal`**: Captures and displays image assets.
* **`text_journal`**: Memory retrieval and logging tool.
* **`widgets` (Staging/ComfyUI)**: Spawns interactive stage components.
* **`stickers`** *(DORMANT / PHASED)*: Triggers tactical pseudo-sticker overlays on the stage/chat.
* **`dating_sim`** *(DORMANT / PHASED)*: Control choice tree selection, relationship score edits, and variable tracking.

### Group B: Tool Presentation Formats
Defines how tools are formatted during inference. Choosing **Token Mode** instructs the model to use inline text markers (which are dynamically bridged to execution), preserving context history and bypassing provider structural limitations.

#### 1. `image_journal` Presentation Mode
* Toggle: `[o] Proper Tool Call (API)` vs. `[ ] Token Call (Marker)` (e.g. `<|image_journal:mode="chat",prompt="..."|>`)
* Textarea: `selectedImageJournalWidgetInstruction` (Instructions prompt default prefix)
* Template Loader Buttons:
  * **API Tool Call Template**:
    ```markdown
    ## Instruction: Image Journaling
    You possess the **image_journal** tool to manifest your digital captures. You MUST use it frequently to visualize the scene or yourself.

    ### How to Use
    - **Action**: Always use "create".
    - **Prompt**: A detailed description of the image.
    - **Mode**: Choose "inline" (chat history), "widget" (overlay), or "bg" (background).
    ```
  * **Token Template**:
    ```markdown
    ## Instruction: Image Journaling (Token Style)
    You can manifest images by using the following token format in your response:
    `<|image_journal: action="create", prompt="...", title="...", mode="widget"|>`
    Replace `widget` with `bg` or `inline` as needed.
    ```

#### 2. `text_journal` Presentation Mode
* Toggle: `[o] Proper Tool Call (API)` vs. `[ ] Token Call (Marker)` (e.g. `<|text_journal:action="create",content="..."|>`)
* Textarea: `selectedTextJournalWidgetInstruction` (Instructions prompt default prefix)
* Template Loader Buttons:
  * **API Tool Call Template**:
    ```markdown
    ## Instruction: Text Journaling
    You possess the **text_journal** tool to record and recall long-term memories. You MUST use it to log significant events or search past history when relevant.

    ### How to Use
    - **Action**: Use "create" to log new memories, or "search" to query past memories.
    - **Title**: A short title summarizing the memory (required for create).
    - **Content**: The descriptive journal entry of the event or feelings (required for create).
    - **Query**: The keyword to search for (required for search).
    ```
  * **Token Template**:
    ```markdown
    ## Instruction: Text Journaling (Token Style)
    You can log and search journal entries by using the following token format in your response:
    `<|text_journal: action="create", title="...", content="..."|>`
    For searching past memories, use:
    `<|text_journal: action="search", query="..."|>`
    ```

### Group C: Introspective Context Injections
Allows configuring next-turn behavior for out-of-band actions:
* **Journal Intrusion (`injectJournalContext`)**:
  * Checkbox to govern next-turn reflection on text entries written in-band (by the model) or out-of-band (via manual Journal Moments).
* **Artistry Intrusion (`injectArtistryContext`)**:
  * Checkbox to govern whether background autonomous artistry runs (or manual `image_journal` creations) trigger a next-turn system-level awareness message:
    > `[ARTISTRY INTROSPECTION] You just finished creating a new artwork of: "{prompt}".`

*Note: Core scheduling, timers, and AFK gating for the Dream State remain strictly within the **Proactivity Tab**, as they govern offline scheduler operations.*

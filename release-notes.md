# 🚀 AIRI v0.9.11-stable.20260627 — Release Notes

This release features a major **Discord Integration Revamp**, introduces **WD14 Model Auto-Tagging & Advanced Card/Avatar Tag Search**, integrates the browser-local **MOSS-TTS-Nano Voice Provider**, implements **Visual Scene State (5th Grounding Toggle)**, and addresses key fixes in authentication redirects and tokenizers.

---

## ✨ Key Highlights

### 💬 Discord Integration Revamp
* **New Slash Commands**: Implemented `/journalmoment` for background journal generation and `/timelines` to inspect active session histories.
* **Status Updates**: Display active timeline name, universeId, Chat Mode, and VLM configuration details inside the `/status` command output.
* **Director's Note Switch**: Added a per-character `autonomousMonitorDiscordEnabled` setting to gate Director's Note reasoning in Discord captions.
* **Tool Formatting & Voice Notes**: Formatted current-turn tool calls elegantly and resolved voice note stream sequencing issues.

### 🏷️ WD14 Auto-Tagging & Dynamic Model Selectors
* **WD14 Vision Auto-Tagging**: Implemented WD14 model auto-tagging, search integration, and tag filtering popovers to make categorizing avatars seamless.
* **Tag Search Everywhere**: Supported tag searching across the `CardImportWizard`, Concept Builder manifestation tab, and the Control Strip avatar popover.
* **Model Selector Dialog**: Replaced the legacy avatar select dropdown with the modern `ModelSelectorDialog` card trigger.
* **UI Warnings Bypass**: Resolved Vue webview custom element warnings using dynamic component binding in the settings panel.

### 🎙️ MOSS-TTS-Nano & Audio Studio Revamp
* **MOSS-TTS-Nano local Provider**: Integrated a local browser voice provider using MOSS-TTS-Nano, complete with a voice cloning playground and OPFS (Origin Private File System) model caching.
* **WASM Core Stability**: Defaulted execution to WebAssembly (WASM) to prevent storage buffer limit errors (which occurred under WebGPU on GPUs with less than 17 buffer limits).
* **Audio Studio Syntax Refactoring**: Revamped bracket-to-token formatter syntax, Option A bracket action mappers, and custom voice replacement mappings.
* **Permissive TTS Discovery**: Made OpenAI-compatible TTS voice discovery permissive to support a wider array of custom APIs.

### 👁️ Vision & Visual Scene Grounding (5th Grounding Toggle)
* **Director's Scratchpad**: Formalized Visual Scene State as the 5th Grounding Toggle, enabling real-time visual scene grounding.
* **Forward-to-LLM Strategy**: Supported forward-to-llm routing strategies and custom prompt shims for vision tasks.
* **Layout & Startup Race Fixes**: Resolved startup window visibility race conditions and cleaned image analysis inject logic.

### 🔌 Redirect, UI, & Tokenizer Fixes
* **Notice & About Page Layouts**: Corrected invalid viewport CSS classes (`h-100dvh`/`w-100dvw`) on the About and Notice pages for proper rendering layout boundaries.
* **OAuth & Redirect Fixes**: Solved Google OAuth link toggles and Electron redirection bugs during onboarding.
* **Tokenizer Embind Fixes**: Replaced dummy arrow functions in tokenizer builders with named functions to prevent Embind constructor runtime errors.
* **Proactivity Safeguards**: Introduced mid-card-switch proactivity guards, session ownership validation, and speech pipeline synchronization.

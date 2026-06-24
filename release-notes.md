# 🚀 AIRI v0.9.10-stable.20260624 — Release Notes

This release introduces comprehensive **RAG Semantic Grounding & Timeline Memory Popovers**, optimizes the desktop **Control Strip** interaction workflow, enhances macOS system tracking stability with an AppleScript fallback, adds safety guards like **Single Instance Lock**, and fixes multiple rendering and sync race conditions.

---

## ✨ Key Highlights

### 🧠 Semantic Grounding & RAG Memory Popovers
* **Recent Topics (Grounding Toggle 4)**: Added turn-based decay, Echo Chips priority weighting, pre-flight panel rendering, and lifecycle store context fixes.
* **Ephemeral Grounding Preview**: Grounded memories in the pre-flight section are now clickable to open a preview modal, backed by dynamic RAG semantic search previews (`ChatGroundingPopover`).
* **Timeline Indexing & Search**: Indexed top 10 sessions by message count, added raw/unique turn counters in the timeline modal, and pruned deleted raw chat turns from search indexes.
* **Pre-Flight UI Restructuring**: Re-designed the pre-flight grounding panel to collapse into exactly one row and display status badges in the header, solving `v-if`/`v-show` expansion conflicts.

### 🎛️ Refined Desktop Interaction & Safety
* **Inverted Control Strip Interaction**: You can now single-click to collapse/expand the control strip, and double-click to toggle the layout, complete with dynamic hover label helper text.
* **Single Instance Lock**: Added a desktop process lock to prevent duplicate parallel running instances of AIRI.
* **Scoped Settings Cloud Restore**: Allowed restoring only custom settings and improved control strip legibility.

### 🍏 macOS & System Sensors Optimization
* **AppleScript Active Window Fallback**: Bypassed native `active-win` bindings on macOS in favor of AppleScript tracking with performance logs to prevent system diagnostics crashes.
* **macOS SMB & File Sync Guards**: Resolved close `EINVAL` errors on macOS SMB mounts and introduced IndexedDB Quota Guards with outbox cleanups.

### 🎭 Live2D & Model Sync Stabilization
* **Actor-Swapping Race Condition Fix**: Prevented crashes by awaiting `nextTick` before verifying the mounted state of newly loaded models.
* **Display Model LRU Cache**: Added a Least Recently Used (LRU) cache for display models to speed up repeat loads.
* **Lip-Sync & Motion Loop Protection**: Fixed an infinite loop issue on undefined motion playback and ensured lip-sync is correctly applied in the post-update ticker loop.
* **Speech Playback Lock**: Prevented automatic card model syncing while active speech intent playback is in progress.

### 🧙 Sparkle AI & Producer Wizards
* **Visual Description Step**: Added Step 5 to the `CardImportWizard` for generating visual descriptions and managing artistry prefix definitions.
* **Producer Prompting Upgrades**: Integrated cache-aligned full-context suggestions and editable prompt templates in the Producer panel to assist with custom prompting.

### 🔌 Connection & System Leak Fixes
* **Auth Loop Leak Fix**: Resolved a WebSocket connection authentication loop leak and patched the local inactivity checker.

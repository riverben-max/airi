# Release Preparation Report: AIRI Stable Candidate

This report identifies the full scope of feature updates and build blockers since the last major activity gap (Mar 22nd -> Mar 28th).

---

## 🚀 Recent Feature Log (Since Mar 22, 2026)

### **Major Features & Workflows**
- **Native ComfyUI Engine**: Implemented a standalone HTTP integration for ComfyUI with a custom callback-driven architecture, workflow manager, and polling services. Removed the legacy WSL bridge (`97606e98f`).
- **Synchronized Session STT**: Enabled cross-window session synchronization for speech-to-text (STT) and proactivity modules, ensuring state consistency between the main UI and auxiliary windows (`78d1fa916`).
- **Unified Artistry Flow**: Consolidated Replicate, NanoBanana, and ComfyUI under a single unified provider management system with bidirectional `{{IMAGE}}` and `{{PROMPT}}` placeholder support (`3aa4c5b05`, `289b8af`).
- **Journal & Memory Evolution**:
  - Implemented coalesced journal previews with full markdown rendering for better legibility (`9172dfd`).
  - Added a dedicated "Memory Rebuild" button with real-time cache status popovers and trash-safety hooks (`b8f62e3`).
  - **Neural Memory Sandbox (Verified)**: Successfully validated Orama + Transformers.js hybrid-search-in-browser. Roadmap updated for production transition.

### **UX & Interface Improvements**
- **ACT/Bracket Styling**: Implemented reactive bubble styling using ACT/Bracket syntax with inline effects for dynamic chat visuals (`37f4f29`).
- **Context Governance**: Added a context-width parameter and a hybrid "Context Meter" UI to visualize and control LLM context usage (`8aebc6f`).
- **Direct Asset Interaction**: Enabled clipboard image paste (CTRL+V) support directly into the chat interface for Electron users (`6c30f32`).
- **Phase 1 UX Enhancements**: Integrated mood-based styling, journal chips, and deep links for more immersive interactions (`694936c`).

### **System & Hardware Stability**
- **Provider Onboarding**: Created a beginner-friendly discovery flow with automated metadata refinement for speech and generation providers (`d9e16a1`).
- **Stage UI Reactivity**: Optimized performance via property-based `File` equality and segmented card reactivity (`654177a`).
- **Linux Troubleshooting**: (Status: Updated) Documented and professionalized the "Daily OOBE" and LCPP signal-loss reports for Linux environments.

---

## ✅ Build Status: **READY**

### **Blocker Resolution Summary**
The `stage-tamagotchi` build blocker has been resolved.

- **Status**: [FIXED] Type mismatch in `channel-server/index.ts` is resolved by destructuring `storedConfig` and properly nesting `auth: { token }` per the new `@proj-airi/server-runtime` API contract.
- **Verification**: `pnpm -F @proj-airi/stage-tamagotchi typecheck` successfully completed (Exit 0).

---

## 📎 Metadata Citations

- **Previous Release Tag**: `v0.9.0-stable.20260326`
- **Pre-Release Reference Hash**: `289b8af9f8eda552f621d5cc40fb995a04044a27` (Commit prior to 03/26 version bump).
- **Target Release Date**: 2026-03-28.
- **Current Version**: `v0.9.0-stable.20260328`.

---

## 🛠️ Next Steps (In Progress)

1. [x] **Fix type mismatch** in `apps/stage-tamagotchi/src/main/services/airi/channel-server/index.ts`.
2. [ ] **Execution**: Trigger production build (`pnpm -F @proj-airi/stage-tamagotchi run build:win`).
3. [ ] **Finalize**: Generate tag and trigger GitHub Release.

# Release Notes - AIRI v0.9.7-stable (June 7, 2026)

AIRI v0.9.7-stable introduces major new features and stability upgrades, including a revamped dynamic Mode Selector for Dating Sim sessions, native S3 configuration and syncing, and improved onboarding, navigation, and AI context robustness.

## 🚀 New Features & Enhancements
- **Dynamic Encounter Mode Selector**: Added a new mode-selection modal when starting a Dating Sim session. Users can now pick between Sandbox Mode (Open-Ended) and Date Session (Goal-Driven) on the fly, rather than being bound to a static choice in Preferences.
- **S3 (Cloudflare R2) Sync Engine**: Implemented full support for backing up, restoring, and syncing your character assets and models to Cloudflare R2 / S3 stores, including an intuitive settings UI for credentials management and provider swapping.
- **Sparkle AI Studio Navigation**: Added reciprocal navigation buttons, introductory blurb cards, and clean guide indicators to navigate seamlessly back and forth between Studio settings and standard modes.
- **Prompt Engineering Upgrades**: Sparkle AI's context injection is now smarter, preserving core system prompt elements and details when merging Multi-Role prompts or customizing premises.

## 🛡️ Stability & Bug Fixes
- **Robust S3 Sync Bootstrap**: Patched model reconciliation logic to prevent accidental local deletion of assets when syncing to a fresh/empty S3 bucket for the first time.
- **Graceful LocalStorage Handling**: Excluded heavy assets (like scene backgrounds) from localStorage/IndexedDB cross-sync to prevent quota limits from being exceeded.
- **Sync Index Merge & Safety Guards**: Implemented index merge logic (`mergeChatIndices`) and safety guards (`isCritical`) for chat session indices to prevent fresh clients from silently overwriting remote backups on sync.
- **Index Auto-Recovery Bridge**: Added an automated scanner that runs on startup to reconstruct missing index records from raw local session files.
- **Captions & Interface Refinements**: Fixed real-time caption synchronization in the Dating Sim Overlay and added a smooth interactive height expansion toggle to the dialogue box.
- **Card Settings Prioritization**: Prioritized active character card sorting and added quick edit buttons directly to the card list.
- **TypeScript & WebWorker Safety**: Fixed `@moeru/eventa` webworker crashes when loading large textures/compressed models, and type-checked all shared package settings.


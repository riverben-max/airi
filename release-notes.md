### **AIRI v0.9.1-stable.20260514**
**What's New**
*   **Core Stability**:
    *   **Cross-Window Sync**: Resolved a critical "Lost Update" race condition in `IndexedDB`. Chat sessions and long-term memory entries are now synchronized across all Electron windows, preventing data loss during restarts.
    *   **Automated Backups**: Implemented a background service that automatically backs up your local data every 24 hours, ensuring character memories and sessions are always recoverable.
*   **MMD Support (Stage 2)**: Significant progress on MMD integration. Added thumbnail generation, idle animation cycling, and precise camera positioning. MMD morphs and motions are now fully integrated into the Acting tab of the AIRI Card Editor.
*   **Spine Enhancements**: Refined hitbox math for bone-based tactile interaction, fixed canvas-resize scaling issues, and added dynamic tactile mode toggles.
*   **Enhanced Chat Management**:
    *   Added toast notifications and progress tracking for Chat History imports.
    *   Implemented "Clear Chat" archival: Director notes are now archived instead of simply cleared, keeping the history tidy while preserving context.
*   **Lifetime Memory**: Introduced dynamic token budget controls to the Lifetime Provisioning modal, allowing users to tune the density of the character's canonical Soul Blueprint.
*   **Localization**: Improved i18n bundling for better reliability and faster resolution in production builds.

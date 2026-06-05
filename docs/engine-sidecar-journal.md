# 🚀 Engine Sidecar Research Journal (Godot vs. Mate-Engine)

This document tracks research, architecture plans, and logs of thoughts regarding offloading VRM rendering from the main Electron/WebGL thread into a compiled, native sidecar process.

## 🧭 Upstream Godot Attempts

Upstream `main` has been working on an experimental **Godot 4 Sidecar Window** (tracked via PRs #1697, #1724, #1830).

### Current Upstream Godot Architecture:
* **G0 Bootstrap (#1697)**: Initialized Godot 4 + C# project with a minimal scene (just a box and camera). No avatar loading.
* **Glue (#1724)**: Handles Electron ↔ Godot lifecycle, settings toggle, and a local WebSocket handshake interface.
* **VRM Path (#1830)**: VRM-only loader that writes model bytes to disk and imports them dynamically into Godot using a vendored VRM importer addon.

### The Fork's Critique:
The current upstream path is a "slow grind." The Godot VRM 1.0 runtime integration is incomplete, complex, and requires a full Godot toolchain and packaging wrappers just to duplicate basic VRM rendering capabilities.

---

## ⚡ The Mate-Engine Sidecar Alternative

Instead of building a Godot-based rendering pipeline from scratch, we are evaluating the adoption of [Mate-Engine](https://github.com/shinyflvre/Mate-Engine) as a sidecar alternative for VRM rendering.

### Why Mate-Engine?
* **Out-of-the-Box Stability**: Written primarily in C# and ShaderLab (Unity), Mate-Engine is already a stable, mature, and highly performant VRM desktop rendering engine. It handles custom shaders, desktop transparency, and window overlays natively.
* **Overhead Bypass**: Rather than spending months hand-rolling a Godot scene importer, we can treat the compiled Mate-Engine binary as a Sidecar runtime that connects via WebSockets/IPC to the Electron app (the "brain").
* **Cross-OS Support**: Unity natively compile-targets Windows, macOS, and Linux with excellent performance and driver compatibility.
* **Adding the "Goodies"**: Because we don't have to code the render loop from scratch, we can jump straight to building creative interactions:
  * **ComfyUI Integration**: The model can dynamically imagine objects/environments, send requests to a ComfyUI generation queue, and spawn the generated assets in its local viewport.
  * **Interactive Physical Collisions**: Built-in Unity physics to handle interactive collision triggers (like boundary checks, window border bonking, or cursor grab reactions).

---

## 📅 Roadmap & Next Steps
1. **Upstream Godot Spike**: Before implementing any native sidecar, test the latest upstream Godot implementation to verify if the performance gains justify the packaging complexity.
2. **Mate-Engine Sidecar Prototype**: Package a compiled release of Mate-Engine and attempt a basic WebSocket/IPC link to hook it into AIRI's orchestration layer.
3. **Compare Resource Usage**: Measure CPU/GPU frame times of the Three.js WebGL canvas vs. the Mate-Engine sidecar to quantify actual rendering efficiency.

# 🍏 AIRI for macOS — v0.9.9-stable.20260615

Welcome to the **first official macOS release** of AIRI! 🚀

This milestone build brings the full power of AIRI's LLM-powered companion stage, Live2D/VRM/Spine/MMD rendering engine, and desktop integration natively to Apple Silicon and Intel Macs. We've spent significant effort optimizing performance, packaging, and platform compliance to deliver a seamless, premium macOS desktop experience.

---

## ✨ macOS Launch Highlights

### 🚀 Native Apple Silicon & Intel support
* **Universal Architecture**: Natively compiled for Apple Silicon (`arm64` - M1/M2/M3/M4) and Intel (`x64`) architectures.
* **Apple Codesigned & Packaged**: Signed using Apple Developer certificates to prevent Gatekeeper security blockades. Distributed as a clean, self-contained DMG installer.
* **Xcode 26+ Optimization**: Compiled utilizing modern Apple Asset Catalogs (`.icon` app icons) for crisp display in the Dock and Launchpad.

### 🎛️ Desktop Magnetism & window Controls
* **Mac Menu Bar Integration**: A native macOS tray interface, fully customized to resolve double-toggle hide glitches and integrate smoothly with the Menu Bar.
* **Control Strip Edge Magnetism**: Optimized edge snapping and magnetism when dragging the companion UI across macOS virtual desktops.
* **Space Contention Guards**: Disabled native window maximization for the Actor Stage to prevent macOS spaces from hijacking the layout or causing window-hiding side effects.

### 🔒 Permission Hygiene & Screen capture
* **macOS Dynamic Permissions**: Implemented native permission prompt requests for camera (`NSCameraUsageDescription`) and microphone (`NSMicrophoneUsageDescription`) access.
* **Sensors & System Tracking**: Upgraded and patched the native `active-win` wrapper to prevent macOS system diagnostics crashes and keep resource utilization extremely low.

---

## 🛠️ Monorepo & Platform Stabilization
* **Zero Telemetry**: Fully removed legacy PostHog tracking and analytics scripts for a private, zero-footprint environment.
* **Clean TypeScript and Vue compiler**: Resolved strict type errors (TS6133) in the settings panel and fixed Vue named-template tag parsing crashes on build.
* **Node 25.6.0 Compat**: Upgraded package engine requirements to fully support modern development runtimes.

---

## 📥 How to Install on macOS
1. Download the **`AIRI-0.9.9-stable.20260615-darwin-arm64.dmg`** (or `x64` for Intel).
2. Open the `.dmg` file.
3. Drag **AIRI** into your **Applications** folder.
4. Launch AIRI from your Applications folder or Spotlight search.

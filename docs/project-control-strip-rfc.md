# RFC: Customizable Control Strip Revamp

A comprehensive design specification for transitioning the AIRI layout from the grid-heavy **Control Island** to a minimal, customizable **Control Strip** (Ribbon).

---

## 👁️ Visual & Concept Mockup

The **Control Strip** is a floating glassmorphic pill located at the right edge of the stage overlay, designed to minimize visual clutter while exposing critical root-level actions with rich responsiveness.

```mermaid
graph TD
    subgraph Control Strip Layout (Vertical Ribbon)
        A1["⠿ Drag Handle / Orientation Toggle (Required Endcap)"]
        A2["🐾 Stage Visibility Toggle"]
        A3["💬 Chat Overlay Toggle"]
        A4["🎯 Interaction Mode (3-Way: Tactile / Position / Look)"]
        A5["🎙️ Voice Mic Trigger & Indicator"]
        A6["⚙️ Settings Launcher"]
        A7["🔴 Power/Quit Toggle (Required Endcap)"]
    end
```

---

## 🎯 Core Objectives & Engineering Enhancements

### 1. Architectural Decoupling: Pure Stage vs. Control Strip
Historically, `Stage.vue` has served a dual purpose: acting as both the visual model renderer and the designated background communications hub (handling audio analysis, speech runtime registration, broadcast channels, and logistics).

To effectuate a clean, modular design, we will **decouple the control/comms layer from the pure rendering layer**:
- **`ControlStrip.vue` (The Host / Comms Hub):** This component becomes the top-level orchestrator. It manages Pinia stores, Electron IPC bridges, broadcast channels, and overlays the modular Control Strip floating pill.
- **`Stage.vue` (The Pure Renderer):** Stripped of background communication bloat. It becomes a lightweight, pure rendering container that simply receives reactive props (model, coordinate offsets, scale, lip sync triggers) and draws the avatar.

```mermaid
graph LR
    subgraph ControlStrip.vue (Host & Comms Hub)
        B1[Broadcast Channels]
        B2[Audio Analyser & LipSync]
        B3[Floating Control Strip Pill]
    end

    subgraph Stage.vue (Pure Renderer)
        C1[Live2D Scene]
        C2[VRM / ThreeJS Scene]
        C3[Spine / MMD Scene]
    end

    ControlStrip.vue -->|Passes offset, scale, state props| Stage.vue
```

### 2. Sleek Drag & Orientation Toggle
- **Perpendicular Toggle:** The top of the strip features a grab-to-drag icon. Clicking this icon alternates the strip between **Vertical Column** and **Horizontal Row** orientations.
- **Magnetic Docking:** Snaps neatly to the screen edges (Left, Right, Top, Bottom) when dragged close to them.

### 3. Clear Pointer Interaction Paradigm (3-Way Mode Toggle)
Currently, dragging the model, looking at the cursor, and clicking/poking the avatar collide in event handling. We introduce a clean **3-way Interaction Mode** at the root level of the strip:

| Mode | Icon | Cursor Interaction | Physics/Tracking Behavior |
| :--- | :--- | :--- | :--- |
| **Tactile Mode** | `i-solar:magic-stick-linear` | Pointer clicks tickle/poke the model. | Active pokes, full look-at-cursor eyes tracking. |
| **Positioning Mode** | `i-solar:tuning-outline` | Drag moves avatar (`xOffset` & `yOffset`), Scroll zooms. | **Look-at-cursor completely disabled** to avoid visual jerking during repositioning. |
| **Orbit / Look Mode** | `i-solar:eye-linear` | Cursor dragging orbits camera (3D VRM) or rotates look-angle. | Free camera orbit / standard head following. |

> [!TIP]
> **Minimalist Positioning Mode:**
> By default, entering **Positioning Mode** keeps the screen completely clutter-free, allowing the user to simply click and drag the avatar directly.
> To support precision adjustments without cluttering the screen, a small **"Advanced Settings" (Sliders icon)** will dynamically hover nearby or expand on-demand, keeping slider controls hidden until explicitly needed.

---

## 🛠️ The Modular Control Strip Builder (Customization)

To avoid overloading the strip while making everyone happy, the control strip is **modular and fully customizable**.

> [!IMPORTANT]
> **Opinioned Endcaps:**
> The **Drag Handle (top/left)** and the **Power Button (bottom/right)** are locked system endcaps. They are structurally required and cannot be removed or reordered by the user, guaranteeing that window dragability and shutdown functions are always instantly accessible.

### Schema Definition
```typescript
interface ControlStripItem {
  id: string // Unique action identifier
  icon: string // Icon class (e.g. 'i-solar:chat-line-line-duotone')
  tooltipKey: string // Translation key for tooltips
  enabled: boolean // Actively toggled on/off
  isSystem?: boolean // System locked buttons (like Drag Handle & Power)
  customAction?: () => void // Optional callback for user-defined macros (e.g. trigger Outfit ID)
}
```

### Drag-and-Drop Editor
A modular customizer panel inside **Settings > UI & Layout** lets the user:
- Toggle switches to show/hide specific options (e.g., Hide Closed Captions button if they don't use it).
- Drag-and-drop items to re-arrange their order in the Control Strip.
- Click "Add Custom Action" to create a shortcut button for their favorite character card, emotion, or wardrobe set!

---

## 📂 Naming & Structure Refactoring

To implement this revamp, the following architectural segments will be refactored:

1. **State & Store Layer:**
   - [NEW] `packages/stage-ui/src/stores/settings/control-strip.ts` — Houses Pinia state for strip items, custom user order, horizontal/vertical orientation, and active 3-way pointer mode.
2. **Component Rename & Separation:**
   - [RENAME] `packages/stage-ui/src/components/scenes/Stage.vue` ➔ `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (Handles background communications, coordinates drag-to-position state, and wraps both the pure renderer and the floating Control Strip).
   - [NEW] `packages/stage-ui/src/components/scenes/Stage.vue` (Pure renderer subset of the original Stage component; only handles loading/displaying Live2D, Spine, MMD, and VRM canvases under strict prop controls).
3. **Control Strip Component:**
   - [NEW] `packages/stage-ui/src/components/scenarios/layout/ControlStrip.vue` — The core interactive glassmorphic pill widget with support for hover expansion, orientation switching, drag/drop sorting, and custom action rendering.
4. **Settings Page integration:**
   - [NEW] `packages/stage-pages/src/pages/settings/layout/ControlStripEditor.vue` — The layout configuration editor.

---

## ❓ Open Questions & Design Decisions

> [!IMPORTANT]
> **1. Sub-menu Navigation Experience**
> When the user clicks "Wardrobe" or "Emotions" from a compact strip, how should the sub-menu expand?
> **Decision:** We will use **Option A (Flyout Pods)**. When clicked, a flying pod matching the shape/style of the older sub-menus appears adjacent to the strip (shifting left/right or top/bottom dynamically depending on the current vertical/horizontal layout of the Strip).

> [!WARNING]
> **2. Electron Window Click-Through Constraints**
> Dragging the model and moving the Control Strip requires the Electron window to be **mouse-interactive** rather than transparent click-through. We must ensure the `pointerenter`/`pointerleave` bounds cleanly toggle click-through to avoid blocking the user's OS workspaces behind the model.

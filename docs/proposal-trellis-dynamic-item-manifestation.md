# Proposal: Dynamic Item Manifestation via ComfyUI TRELLIS Pipeline

This document outlines the architectural design for allowing AI characters to dynamically generate, query, and equip physical 3D items in their environment using ComfyUI-driven 3D generation engines (such as TRELLIS).

---

## 🧭 1. Vision & Goals

Currently, characters can change their baseline model settings, workflows, and textures. This proposal extends their agency, allowing them to **dynamically manifest physical objects** into the 3D/2D scene.

*   **Generative Assets**: Items are generated in real-time based on natural language prompts (e.g., a "pink wizard hat" or a "glowing gold bracelet").
*   **Dynamic Bone Mounting**: The generated items are compiled as GLB meshes and attached to specific bones of the active stage character (VRM, MMD, or Spine anchors).
*   **Decoupled State Persistence**: Items are saved in IndexedDB and can be listed, equipped, or unequipped dynamically by both the user and the character.

---

## 🛠️ 2. The LLM Interface (Tool Calling)

The character's consciousness orchestrator will be equipped with a set of tools to interact with their physical environment:

### A. `create_stage_item`
Instructs the backend to generate a new item and attach it to a specific socket.
*   **Arguments**:
    ```json
    {
      "attachTo": "wrist" | "head" | "waist" | "ankle",
      "prompt": "description of the 3D item to generate"
    }
    ```

### B. `list_stage_items`
Queries all historically generated items in the character's inventory.
*   **Returns**:
    ```json
    ["bracelet", "anklet", "pink_hat", "hoola hoop"]
    ```

### C. `equip_stage_item`
Equips a previously generated item from the inventory.
*   **Arguments**:
    ```json
    {
      "name": "pink_hat"
    }
    ```

---

## ⚙️ 3. Backend Pipeline & ComfyUI Integration

The rendering engine offloads 3D generation to the ComfyUI backend:

1.  **Workflow Triggers**: When `create_stage_item` is called, AIRI sends a generation payload to the ComfyUI API.
2.  **TRELLIS Node Capture**: The backend executes a specialized ComfyUI workflow utilizing the **TRELLIS** nodes (or similar Image-to-3D / Text-to-3D models).
3.  **GLB Compilation**: The output of the generation pipeline is a standard `.glb` file.
4.  **Ingestion Bridge**: The `.glb` file is fetched by the AIRI server, stored in the local IndexedDB asset repository, and registered under a unique catalog entry (e.g., `trellis_pink_hat`).

---

## 🎨 4. Stage Mounting & Skeletal Binding

Once the GLB file is available, the renderer (Three.js/Three-VRM) dynamically injects the mesh into the scene:

```
[ ComfyUI TRELLIS ] ──> .glb File ──> [ IndexedDB Store ]
                                             │
                                             ▼
                                     [ Stage Renderer ]
                                             │
                                             ▼
                                   [ Bone Socket Map ]
                                    ├── "head"  ──> VRM: HeadBone
                                    ├── "wrist" ──> VRM: WristBone
                                    └── "waist" ──> VRM: Hips/Waist
```

### Bone Mapping Across Formats
To support multiple model formats, sockets must map to their respective skeletal anchors:

| Socket ID | VRM (3D) | MMD (PMX) | Spine (2D) |
|---|---|---|---|
| **head** | `vrm.humanoid.getNormalizedBoneNode('head')` | Head Bone | Head Slot / Attachment |
| **wrist** | `vrm.humanoid.getNormalizedBoneNode('leftWrist')` | Wrist/Hand Bone | Hand Slot |
| **waist** | `vrm.humanoid.getNormalizedBoneNode('hips')` | Hips/Waist Bone | Hip Slot |
| **ankle** | `vrm.humanoid.getNormalizedBoneNode('leftAnkle')` | Ankle Bone | Foot Slot |

### Mesh Scaling & Offsets
Since generated GLB files have arbitrary scale bounding boxes and origin centers:
*   A basic **Normalizer** step runs upon load to center the mesh geometry bounding box at `(0, 0, 0)` and scale the object to a standard unit size (e.g. `0.2m` bounding sphere).
*   Add socket-specific coordinate adjustments (scale, rotation offset, translation offset) in the UI to allow fine-tuning how the hat sits on the head or the bracelet fits the wrist.

---

## 📅 5. Roadmap & Challenges

- [ ] **ComfyUI Integration**: Define the reference TRELLIS workflow template for GLB exports.
- [ ] **IndexedDB Storage**: Extend `data-catalog.md` schemes to persist `.glb` binary blobs.
- [ ] **Stage Mounting Implementation**: Develop the skeletal socket attachment module in `stage-ui-three`.
- [ ] **Scale Calibration**: Research automatic bounding-box scaling helpers to prevent generated hats from spawning the size of houses.

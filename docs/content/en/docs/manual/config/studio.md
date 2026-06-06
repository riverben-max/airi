---
title: Studio
---

# Studio

The Studio is a powerful multi-actor and scene orchestration engine. Instead of binding a character to a single static model, voice, or prompt, the Studio allows you to register multiple **Concepts** (which can represent different outfits, secondary characters, or atmospheric states) and switch between them dynamically during a session.

---

## The Three Pillars of a Concept

Every concept you create defines how your character manifests physically, narratively, and technically:

1. **Identity (Prompt Snippet)**: Keywords or narrative phrases injected into the image generation prompt (e.g. `, (burgundy velvet dress:1.4)` or `, nighttime lighting`).
2. **Manifestation (Physical Assets)**: Swaps out the active 2D/3D model (Live2D/VRM) or sets a baseline mood/expression override.
3. **Artistry & Speech**: Overrides for the ComfyUI workflow settings, LLM provider configurations, or TTS vocal profile and persona voice.

---

## Base vs. Layer Concepts

To maintain visual and narrative consistency, concepts are split into two categories:

* **Base (Exclusionary)**: Represents a complete state change (e.g., swapping outfits or switching to a new character). Activating a Base concept clears the active stack so outfits don't overlap.
* **Layer (Additive)**: Represents minor adjustments or "filters" (e.g., adding rain, wearing sunglasses, or showing an angry expression). These stack on top of the current Base.

---

## How to Orchestrate Scenes

You can run your studio sessions in two ways depending on your playstyle:

### 1. Manual / Scripted Control (Director-less)
You can manually direct the studio without using the Autonomous Director. The AI scriptwriter (or yourself) can trigger concepts directly in dialogue turns using the actor token:

```text
<|ACTOR:pajamas|> "Good night, master!" (Swaps model to pajamas, updates voice & setting)
<|ACTOR:casual_outfit|> "Good morning!" (Swaps model back to daytime casual clothes)
```

The orchestration engine will intercept these tags on the fly to hot-swap the physical models, vocals, and prompt environments for that speaking turn.

### 2. Autonomous Director Automation
If you have **Autonomous Artistry** enabled, you don't need to write manual tags. The Director will review the conversation context, decide which outfits or states are appropriate for the current scene, and manage the Concept Stack automatically.

# 🗂️ Project Journal: The Live2D DSL & Dating Sim Journey

> *"We don't need a junior dev on this. We need a grand architect."*
> — Richard, June 7 2026

This document is a living record of the architectural decisions, hard lessons, dead ends, and breakthroughs
encountered while building the Live2D DSL interpreter and dating sim integration for AIRI.
It is written for future contributors (and future us) so we don't repeat the same pain.

---

## 📜 Chapter 1 — Origin & Lineage

### The Vision (Why We Started)

The goal was never just to display a Live2D model.
The goal was to make her **alive** — to make clicking on her head produce a real reaction,
to make hovering over her feel like she notices you, and to eventually make that
responsiveness feed into a full dating-sim narrative layer backed by generative AI.

The original insight came from reading the stripped special-sauce metadata inside the `.model3.json`
files of advanced Steam Workshop models. These files contain a hidden DSL — a full scripting
language that the original creators wrote to define interactive behavior.
AIRI's WebGL renderer was crashing on these entries (because they lack a `File` property),
so they were being pruned. But the intent was there. The framework was there. We just needed
to build the interpreter.

### The Spec Documents

The architectural vision was captured across several living spec documents:

| Document | Purpose |
| :--- | :--- |
| [live2d_dsl_interpreter_spec.md](./live2d_dsl_interpreter_spec.md) | The core DSL VM: VarFloats engine, Command pipeline, Intimacy gating, Delta Ticking |
| [live2d_dsl_test_cases_handoff.md](./live2d_dsl_test_cases_handoff.md) | Test case handoff — the 23 Steam models to validate against |
| [live2d_special_sauce_insights.md](./live2d_special_sauce_insights.md) | Per-model audit of all stripped DSL entries — the ground truth for what each model expects |
| [dating_sim_intimacy_spec.md](./dating_sim_intimacy_spec.md) | The refined 2-request game loop, the Actor/Director/IC taxonomy, design anti-patterns |
| [dating_sim_gamestate_mechanics.md](./dating_sim_gamestate_mechanics.md) | Mode A (open-ended) vs Mode B (goal-driven), scoring schema, session state |

---

## 🧬 Chapter 2 — Branch Lineage & Generation Map

There have been multiple contributors and branches. Here is the honest lineage as of June 7 2026:

```
upstream/main  (moeru-ai/airi)
└── feature/dating-sim-demo         (gen1 — Kazi's initial DSL demo via aki-dev-code/airi-DSL)
    │   Commit: e01633fe8  "first commit"
    │   Commit: 17c9c59f1  "live2d DSL integration demo"
    │
    ├── kazzy-feature-dating-sim-demo   ←── GEN2 (Richard's working branch)
    │   = temp-test-flandre (local mirror)
    │   Commit: 575080a6c  "fix(live2d): bridge dating-sim dsl triggers and animations"
    │   Author: Richard Pinedo, June 5 2026
    │   Status: CONFIRMED WORKING with model 2262182171 (Flandre) at time of commit
    │   Remote: origin/kazzy-feature-dating-sim-demo
    │
    └── feature/dating-sim-gen3         ←── GEN3 (Kazi's "robust fixes" layered on gen1)
        Commits:
          fe769cff5  "live2d integration DSL fixes"           ← Kazi
          df6d30930  "Added a two-tier fallback chain"         ← Kazi
          bd89bd847  "Added a three-tier fallback chain"       ← Kazi
          553b450a1  "safe local backup restoration"           ← Richard + AI
          a6eb0806a  "auto manifest sanitization"              ← Richard + AI
          2eb9555d3  "Cubism 2.0 block"                        ← Richard + AI
        Status: REGRESSED — broke Flandre (2262182171), unknown what Kazi tested
```

### Key Insight
Gen3 was NOT built on top of gen2. It was built on top of gen1 (`feature/dating-sim-demo`),
meaning all of Richard's gen2 fixes to `Model.vue` were absent when Kazi added his fallback chain.
Gen3 represents a **parallel evolution**, not a direct upgrade.

---

## 👥 Chapter 3 — Contributor Roles & Accountability

### Richard Pinedo (dasilva333)
- Wrote the DSL spec documents
- Identified the 23 test-case Steam models
- Built the `steam-lpk-packager` tooling for batch downloading/packaging
- Wrote the manifest sanitization pipeline (`clean_live2d_manifests.py`)
- Personally tested and confirmed model `2262182171` (Flandre) working in gen2
- Primary architect of the dating sim game loop spec

### JudgementKazzy (aki-dev-code)
- Built the initial DSL proof-of-concept in `aki-dev-code/airi-DSL` (gen1)
- Added the two-tier and three-tier fallback chains in gen3
- **Claimed to test all 23 models — this was not accurate**
- Admitted to deleting local model files before testing was complete (24GB issue)
- Confirmed testing via expression command (not tactile click) only
- Deleted models from his local AIRI before verifying results

### The AI (Gemini / this session)
- Analyzed `Model.vue` at each generation and confirmed/misread branch states
- Made the error of analyzing gen3 (`feature/dating-sim-gen3`) while telling Richard he was on gen2
- Missed `origin/kazzy-feature-dating-sim-demo` in multiple branch audits
- Added Cubism 2.0 detection (good), accidentally attempted Cubism 2.0 support (bad, reverted)
- Added a stray `return` statement in `Model.vue` that broke the two working models (reverted)

---

## 🧪 Chapter 4 — The Two Classes of Models Problem

This is the core unsolved architectural challenge as of June 7 2026.

### Class A: Expression-Array Models
Models where tactile click interaction works by cycling through a predefined `Expressions[]` array.
- When you click, it picks the next expression by index
- These are simpler, stateless models
- Kazi's gen3 fallback chain was tuned for this class
- **Chain Girl** (wrist cuffs → anger expression) is a confirmed Class A model

### Class B: DSL Command Models
Models where interactions are driven by the full special-sauce DSL embedded in the manifest:
- `Taphead`, `Tapbody` → `Command: "start_mtn B40; start_mtn Sound#1:xxx; start_mtn Face#2:02"`
- These require the VarFloats engine, motion group routing, and sound channel mapping
- They have intimacy gating, conditional state, and chained motion sequences
- **Flandre (2262182171)** is a confirmed Class B model — 178 custom DSL entries

### The Conflict
Gen3's three-tier fallback chain works like this:
1. Try DSL expression triggers
2. Fall back to model.expressions array
3. Fall back to idle motions

The problem: for Class B models, the DSL trigger lookup was broken or incomplete,
so the fallback kicked in and played a random expression from the array — which for Flandre
produces a neck-twitch glitch instead of the intended face animation.

### What Actually Worked in Gen2
Richard's gen2 commit (`575080a6c`) modified `Model.vue` to properly bridge the
dating-sim DSL store's triggers into the Stage/Actor model loader.
The exact mechanism needs to be re-examined against current Flandre behavior,
because even on gen2 she is currently producing the neck-twitch behavior.

> **Open Question**: Did gen2 ever work for Flandre natively, or was it only working
> in a specific test context (specific click zone, specific model state, specific session)?
> The chat logs from June 5 reference it working "after 5 or 6 clicks" — this suggests
> it may have required a warm-up state or specific hit-zone.

---

## 🛠️ Chapter 5 — The Architecture We Need to Build

Based on the spec documents and all lessons learned, here is what a proper implementation requires:

### 1. Model Class Detection
Before any interaction logic runs, classify the model:
```typescript
type ModelClass = 'dsl-command' | 'expression-array' | 'hybrid' | 'unknown'
```
- If the manifest has stripped DSL metadata in the special-sauce store → `dsl-command`
- If the model only has `Expressions[]` → `expression-array`
- Both → `hybrid`
- Neither → `unknown`

The class detection should happen at model-load time and be stored in the model's runtime context.

### 2. Mode Toggle in Settings
A user-facing toggle for tactile behavior mode:
- **DSL Mode**: Routes clicks through the VarFloats + Command pipeline (for Class B models)
- **Expression Mode**: Routes clicks through the Expressions[] array (for Class A models)
- **Auto**: Detects class and routes accordingly

This prevents the two classes from fighting each other.

### 3. The DSL VM (Not Yet Built)
The actual VarFloats engine and Command pipeline described in `live2d_dsl_interpreter_spec.md`
has not been fully implemented. What exists is a bridge that routes DSL store triggers into
motion/expression calls — but the stateful VM (conditions, assignments, intimacy gating,
delta ticking) does not exist in the codebase yet.

### 4. The Dating Sim Layer
Per `dating_sim_intimacy_spec.md`, the full architecture requires:
- **Producer**: One-time session initializer
- **Actor**: Streaming roleplay response (no tool calls, no state management)
- **Director/IC Sweep**: Background sweep post-Actor — updates state, generates next choices
- **Stage Overlay**: Glassmorphic choice buttons composited on top of the Live2D canvas

The current gen3 has partial plumbing for this but the Live2D tactile layer is not
properly feeding into the game state variables.

---

## 📊 Chapter 6 — The 23 Test Models

Per Kazi's handoff list, the target models for DSL validation are:

| Steam ID | Class (estimated) | Notes |
| :--- | :--- | :--- |
| `2883004043` | DSL (Choices menu) | 8-choice toggle menu in special sauce |
| `3165421164` | Sound-loop DSL | Sound channel looping with `NextMtn` |
| **`2262182171`** | **DSL Command (Class B)** | **Flandre — 178 entries, primary test case** |
| `3626567931` | DSL (VarFloats + Choices) | DoubleClickTimer variable, complex branching |
| `3348681028` | Tactile sensory | Intimate touch triggers |
| `3548538714` | Unknown | Not yet analyzed |
| `1990155125` | Unknown | Not yet analyzed |
| `2608633238` | Unknown | Not yet analyzed |
| `3357623873` | Unknown | Not yet analyzed |
| `3156427156` | Animation state sequencing | Confirmed in special sauce analysis |
| `3599090981` | Had invalid entry | Sanitized — pruned `提衣服脸红.motion3` |
| `3443582462` | Unknown | Not yet analyzed |
| `3443588788` | Unknown | Not yet analyzed |
| `3443578669` | Unknown | Not yet analyzed |
| `3607861780` | Unknown | Not yet analyzed |
| `3690055082` | Unknown | Not yet analyzed |
| `3110750977` | Interactive state branching | Confirmed in special sauce analysis |
| `2042115087` | Unknown | Not yet analyzed |
| `2000010442` | Unknown | Not yet analyzed |
| `2108430225` | Unknown | Not yet analyzed |
| `1985484220` | Unknown | Not yet analyzed |
| `2588209550` | Unknown | Not yet analyzed |
| `3490176232` | Unknown | Not yet analyzed |

**Only Flandre (2262182171) has been confirmed tested end-to-end (tactile click → expression change).**
All other models are unverified as of June 7 2026.

---

## 🚧 Chapter 7 — Current State (June 7 2026 EOD)

### Where We Are
- **Active branch**: `temp-test-flandre` = `origin/kazzy-feature-dating-sim-demo` (gen2)
- **Current behavior**: Flandre produces a neck-twitch on click (not the full expression change)
- **Gen3 status**: Shelved — broke Flandre, unclear what it fixed
- **Gen2 status**: Needs fresh investigation — may have regressed even on its own branch

### What We Know Doesn't Work
- Kazi's three-tier fallback chain (gen3) — regresses Class B models
- The stray `return` statement that was temporarily added — reverted
- Attempting Cubism 2.0 support — explicitly blocked, returns version error now

### What We Confirmed Works (At Some Point)
- Model `2262182171` (Flandre) responding to head clicks with expression changes (gen2, June 5)
- Chain Girl's wrist cuff click → anger expression (gen3, confirmed by Richard)
- Model `3599090981` successfully sanitized (invalid entry pruned, loads cleanly now)

### What Needs To Happen Next
1. **Root cause Flandre's current neck-twitch** — diff gen2 Model.vue carefully, find the exact
   code path that routes `Taphead` commands into facial expressions
2. **Build the model class detector** — determine at load time whether a model is DSL or Expression class
3. **Add the mode toggle** — give users control over which class behavior is active
4. **Properly implement the DSL Command pipeline** — `start_mtn`, `start_mtn Face#2:XX`,
   `start_mtn Sound#1:xxx`, `clear_exp` all need real routing to the pixi-live2d-display API
5. **Validate systematically** — go through each of the 23 models with defined expectations before
   calling anything "done"

---

## 💭 Closing Thoughts

This has been a frustrating journey — not because the problem is unsolvable,
but because the scope keeps expanding and the testing rigor keeps lagging behind the coding ambition.

The right approach going forward is:
1. **One model at a time.** Fix Flandre. Confirm it. Document it. Then move to the next.
2. **No "I tested all of them" without a list.** Every verified model gets logged in this doc.
3. **No committing broken states as progress.** If Flandre breaks, nothing ships.
4. **The grand architect mindset**: Step back before touching code.
   Read the special sauce. Understand what the creator intended. Then build the interpreter that honors it.

The models are trying to tell us something. We just need to learn to listen.

---

*Last updated: June 7 2026 by Richard Pinedo + Gemini*
*Branch at time of writing: `temp-test-flandre` (575080a6c)*

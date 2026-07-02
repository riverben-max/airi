# Proposal: Attention Ecology Proof-of-Concept (RWKV-7 Vibe Island)

This proposal outlines the design and implementation roadmap for a lightweight **Proof-of-Concept (PoC)** to validate the use of local WebGPU RWKV-7 recurrent states for continuous environmental grounding, visual telemetry feedback, and ambient vibe drift.

---

## 1. Objectives

1.  **Validate RNN State Accumulation**: Prove that streaming constant, binary sensor inputs into the RWKV-7 hidden recurrent state (RNN state) shifts the model's internal weights predictably over time.
2.  **Zero-Token Telemetry**: Verify that we can retrieve a coherent "ambient mood" from the state vector *without* keeping or parsing a chronological list of event logs in the LLM prompt.
3.  **Real-Time Visual Feedback**: Render the dynamically shifting vibe as a visual indicator on the desktop **Control Island** to observe state decay and accumulation during daily usage.

---

## 2. Technical Design: The "Focus/Boredom" Loop

To keep the experiment clean and calibratable, we isolate the loop to a single binary input variable and a single classifier output.

```
[User Action Ticks (5s)]
  ├── Typing / Clicking  ──►  Feed Token: "ACT"   ──┐
  │                                                 ├──► [ RWKV-7 RNN State Update ]
  └── Inactive (5s+)     ──►  Feed Token: "IDLE"  ──┘
                                                            │ (Recurrent weights accumulate)
                                                            ▼
                                                [ Trigger Vibe Generation ]
                                                            │
                                                            ▼
                                                 Output: "FOCUSED", "RESTLESS",
                                                         "DRIFTING", or "COMPANIONABLE"
```

### A. The Input Ticker (Every 5 Seconds)
*   **Sensor Source**: `active-win` focus status and mouse/keyboard activity tracking from `proactivityStore`.
*   **Ticker Value**:
    *   **`ACT`**: User is actively typing, clicking, or changing tabs in an active application (e.g., VS Code, terminal).
    *   **`IDLE`**: User has not touched the mouse/keyboard or changed focus for 5 seconds.
*   **WebGPU State Update**:
    *   Every 5s, the system runs a forward-only pass on the local WebGPU model, feeding the single token (`ACT` or `IDLE`).
    *   The model's hidden states (key, value, and conv states) are updated in-place and persisted in volatile memory. No text is generated.

### B. The Vibe Classification (Every 60 Seconds)
*   To read the accumulated state weights, the system triggers a lightweight generation pass using the updated recurrent state:
    *   *Prompt*: `[STATE] Active Vibe:`
    *   *Decoding Constraint*: Force the model to output exactly one of the target vibe tokens:
        *   `FOCUSED` (high concentration of `ACT` ticks).
        *   `RESTLESS` (switch back and forth between `ACT` and `IDLE`).
        *   `DRIFTING` (continuous `IDLE` ticks).
        *   `COMPANIONABLE` (long idle, resting state ready for conversation).
*   The resulting single word is captured, and the state-generation token overhead is cleared.

---

## 3. UI Touchpoint: The Control Island Indicator

To enable real-time observation and calibration, we integrate the vibe indicator directly into the **Control Island** component.

```
┌──────────────────────────────────────────────┐
│  [ ● VIBE ]  AIRI: Active (Focus Mode)  [ _ ]│
└──────────────────────────────────────────────┘
     ▲
     │  Indicator Color:
     ├── Green  (FOCUSED)
     ├── Yellow (RESTLESS / DRIFTING)
     └── Purple (COMPANIONABLE / Idle)
```

1.  **Vibe Indicator Dot**:
    *   A small, glowing indicator dot is added next to the card name or control status on the Control Island.
    *   The color of the dot dynamically updates based on the 60s vibe classification:
        *   **Green**: `FOCUSED`
        *   **Yellow**: `DRIFTING` / `RESTLESS`
        *   **Purple**: `COMPANIONABLE`
2.  **Hover Tooltip / Telemetry Popover**:
    *   Hovering over the indicator dot reveals a miniature event log detailing the state weight ratios:
        ```text
        RNN State Saturation:
        - Active ticks (last 10m): 72%
        - Idle ticks (last 10m): 28%
        Current Vibe: FOCUSED
        ```

---

## 4. Fine-Tuning & Calibration Strategy

A major benefit of this PoC is that it provides a concrete sandbox to calibrate the model's subjective behavior:

*   **State Decay Calibration**: We can adjust the math inside the RNN state copy/decay parameters to control how fast the model "forgets" activity (e.g. does 1 minute of idle wipe out 30 minutes of focus state?).
*   **Dismissal Logs**: If the character comments on a vibe and the user dismisses the bubble or manually changes it, we can write the mismatch log to a local tuning folder (`personal_airi/vibe_mismatches.jsonl`) to build a training dataset for fine-tuning the local RWKV-7 model weights.

---

## 5. Key Files for the Prototype

*   **[NEW]** `packages/stage-ui/src/stores/modules/attention-poc.ts` (The input tick loop and WebGPU state management)
*   **[MODIFY]** `packages/stage-ui/src/components/scenes/ControlIsland.vue` (Adding the status dot and telemetry hover state)
*   **[NEW]** `packages/stage-ui/src/scratch/test-attention-gate.ts` (CLI script to mock ticks and print state vector drifts)

# Feat: Audio Studio & Virtual Voice Bundling

## Vision & Goals
Transitioning the current Speech/TTS system into a modular, professional-grade **Audio Studio** (located under `Settings > Providers > Speech > Audio Studio`).

Instead of configuring voice settings globally or per-provider with rigid constraints, the Audio Studio acts as a **Virtual Voice Provider** (`virtual-audio-studio`). It wraps, bundles, and customizes base speech engines into premium, named voice profiles that can be referenced globally across the entire AIRI ecosystem (e.g. inside a character's Speech customization tab).

### Core Principles
- **Virtual Provider Abstraction**: A virtual voice bundle presents itself to the rest of the application as a standard provider/voice entity. Downstream systems (character card speech tabs, onboarding, image studio dependencies) remain 100% compatible.
- **Xvan's Audio Effects**: Embed high-fidelity post-processing audio transformations (like Pitch Shifting, Rate/Speed adjustments, and Voice Equalization) directly into the voice bundle profile.
- **Custom Extensible UST**: Move the **Universal Speech Transformer (UST)** from a rigid global setting into a granular, per-profile option. Instead of trying to guess the right combination for everyone, we make it open-ended and completely flexible.

---

## 1. The Virtual Provider Architecture

To maintain compatibility with existing systems that expect a simple provider-to-voice mapping, the Audio Studio registers its bundles under a custom virtual provider namespace: `virtual-audio-studio`.

Under this setup:
1. **Base Provider & VoiceId**: Points to the underlying real TTS engine (e.g. Kokoro, OpenAI, Azure, ElevenLabs).
2. **User Label**: Serves as the custom, human-readable name of the profile (e.g. "Neuro Ashley"). In the virtual provider mapping, this label essentially acts as the new **Virtual VoiceId**.
3. **Pipelined Transformation**: When text is vocalized, it passes through the profile's specific UST sanitization options, compiles through the base engine, and finally routes through Xvan's audio effects.

```mermaid
flowchart TD
    subgraph Character Card / Speech Tab
        CC[Character Speech Tab] -->|Selects Virtual Voice Profile| VP[Voice Profile: 'Neuro Ashley']
    end

    subgraph Audio Studio (Virtual Provider)
        VP -->|User Label / Virtual VoiceId| UL[User Label: 'Neuro Ashley']
        VP -->|Base Provider Reference| BP[Base TTS: Kokoro/OpenAI/Azure]
        VP -->|Base Voice Reference| BV[Base Voice: ashley]
        VP -->|Xvan's Audio Effects| FX[Pitch: 1.20, Speed: 1.05, EQ]
        VP -->|Per-Profile UST Options| UST[Customizable Narrative Stripping]
    end

    subgraph Speech Engine (Audio Pipeline)
        BP & BV --> SpeechGen[Generate Raw Audio]
        SpeechGen --> FXPipe[Apply Audio Effects]
        FXPipe --> Output[High-Fidelity Output]
    end
```

---

## 2. Technical Pathing

### Schema Definition: Voice Profile Bundle
Each virtual voice profile is persisted within a clean, serializable JSON schema:

```json
{
  "id": "voice_profile_neuro_ashley",
  "name": "Neuro Ashley",
  "baseProvider": "kokoro",
  "baseVoice": "ashley",
  "effects": {
    "pitch": 1.20,
    "rate": 1.05,
    "volume": 1.00,
    "equalizer": {
      "bass": 2,
      "mid": -1,
      "treble": 4
    }
  },
  "ust": {
    "enabled": true,
    "mode": "mute",
    "customStripChars": "*_[]()<>\"'",
    "stripEmojis": true,
    "tildeReplacement": "nyan",
    "autoLowercaseCapsThreshold": 2
  }
}
```

### Granular & Extensible UST Options
Instead of rigid checkboxes, the Universal Speech Transformer (UST) is defined per-profile with six highly flexible options:

1. **Mute Narrative Mode** (`mode: "mute"`):
   * Completely strips out narrative formatting symbols and the text enclosed inside them (e.g., `*smiles* Hello` $\rightarrow$ `"Hello"`). Best for a pure dialogue, "voice-only" experience.
2. **Flatten Narrative Mode** (`mode: "flatten"`):
   * Vocalizes the narrative/action text but strips the boundary symbols surrounding it (e.g., `*laughs* oh stop!` $\rightarrow$ `"laughs oh stop!"`). Best for users who want actions spoken as plain text.
3. **Customize Narrative Mode** (`mode: "custom"`):
   * Enables open-ended, non-regex user control. Users get an input box where they can enter any target characters they want to strip directly (without spaces, e.g. `*_[]()<>"'`). The UST will automatically wipe out any occurrence of these exact characters, allowing users to customize their stripping rules perfectly.
4. **Strip Emojis** (`stripEmojis: true`):
   * Strips out standard Unicode pictographs and emoticons so the TTS engine doesn't attempt to speak or make weird vocal pauses for them.
5. **Tilde (~) Replacement** (`tildeReplacement: "nyan"`):
   * Substitutes tildes with custom vocal phrases (like `"nyan"` or `"humm"`) or strips them completely if left blank.
6. **Auto-Lowercase Short Caps** (`autoLowercaseCapsThreshold: 2`):
   * Some TTS engines spell out fully-capitalized words letter by letter (e.g. `AIRI` → "A-I-R-I", `IT` → "EYE-TEE") instead of pronouncing them as words. This option automatically lowercases any fully-capitalized word **at or below** the configured character length threshold before the text reaches the TTS engine.
   * Default threshold: `2` — so `IT` becomes `it` (spoken as a word), but `AIRI` (4 chars, above threshold) is left as-is.
   * The user can raise the threshold: set to `3` and `TTS` stays uppercase / spelled out; set to `4` and `AIRI` gets lowercased too.
   * Effectively a tunable regex: `/\b[A-Z]{1,N}\b/g → toLowerCase()` where `N` is the threshold.
   * This only fires on **all-caps** tokens — mixed-case words like `McGregor` or `iPhone` are untouched.
   * Example at threshold `2`: `"AIRI said IT was fine"` → `"AIRI said it was fine"`
   * Example at threshold `4`: `"AIRI said IT was fine"` → `"airi said it was fine"`


---

## 3. UI Design Spec: `audio-studio.vue`

The `audio-studio.vue` page serves as a creative console for voice design. It features a curated list of saved profiles, high-fidelity control sliders, an open-ended custom character-stripping entry box, a playground to instantly test voice modifications, and clean integration switches.

### UI Layout Structure

| Section | Component | Description |
| :--- | :--- | :--- |
| **Profile Library** | Card Grid / Sidebar | Saved virtual voice profiles displaying the **User Label** as the active identity. Features quick duplicate, delete, and active toggle actions. |
| **Base Configuration** | Select Dropdowns | Bind the profile to a base provider (OpenAI, Azure, Kokoro, ElevenLabs) and selected voice ID. |
| **Xvan's Audio Effects** | Slider Group | Responsive sliders for **Pitch** (e.g. 0.5x to 2.0x), **Rate/Speed** (e.g. 0.5x to 3.0x), **Volume**, and basic Equalizer knobs (Bass/Mid/Treble). |
| **UST Configuration** | Mode Radio + Input + Threshold | Toggles for **Mute**, **Flatten**, or **Customize** modes. In Customize mode, displays an input field: *"Target characters to strip (e.g. `*_[]()<>"'`):"*. Separate numeric input for **Auto-Lowercase Caps Threshold** (default: 2, range: 1–10, label: *"Lowercase all-caps words of N characters or fewer"*). |
| **Voice Playground** | Textbox + Test Button | A sandbox area to type dummy text and instantly play the processed TTS output with applied FX to verify. |

---

## 4. Key Files for Adjustment

### [Renderer Process (Stage UI)]
- **[NEW]** `packages/stage-ui/src/components/scenarios/settings/model-settings/audio-studio.vue` (The Voice Builder Console UI)
- **[MODIFY]** `packages/stage-ui/src/stores/modules/speech.ts` (Virtual Voice states, storage, and provider registration logic)
- **[MODIFY]** `packages/stage-ui/src/stores/providers/types.ts` (Add Voice Profile type schemas)
- **[MODIFY]** `packages/stage-pages/src/pages/settings/modules/speech.vue` (Integrate Audio Studio settings tab)

### [Base Audio Pipeline]
- **[MODIFY]** `packages/stage-ui/src/components/scenes/ControlStripHost.vue` (Apply real-time Web Audio API Pitch/Rate/EQ and effects transformation chains inside playback manager)

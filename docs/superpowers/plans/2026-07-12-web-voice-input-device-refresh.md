# Web Voice Input Device Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the desktop Web microphone list after permission is granted so the selector no longer remains empty and the existing transcription path can start with a real MediaStream.

**Architecture:** Keep permission prompts user initiated through the existing settings audio store. Harden `useAudioDevice().askPermission()` so a granted permission always leads to a fresh `enumerateDevices()` result, then restore the desktop ChatArea open watcher that invokes that path. Preserve the existing microphone preference, stream, VAD, and transcription code.

**Tech Stack:** Vue 3 Composition API, Pinia, VueUse `useDevicesList`/`useUserMedia`, Vitest 4, TypeScript, pnpm 10.32.1, Node.js 24.13.0.

---

### Task 1: Refresh granted microphone devices

**Files:**
- Create: `packages/stage-ui/src/stores/audio.test.ts`
- Modify: `packages/stage-ui/src/stores/audio.ts:91-166`

- [ ] **Step 1: Write the failing granted-permission refresh test**

Create `packages/stage-ui/src/stores/audio.test.ts` with a complete VueUse test double. The test starts with an empty reactive device list, resolves permission as granted, returns one microphone from the browser enumeration API, and asserts on the composable's observable device and selection state:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const audioDeviceMock = vi.hoisted(() => ({
  devices: undefined as unknown as { value: MediaDeviceInfo[] },
  ensurePermissions: vi.fn(),
  enumerateDevices: vi.fn(),
  startStream: vi.fn(),
  stopStream: vi.fn(),
}))

vi.mock('@vueuse/core', async () => {
  const { computed, ref, shallowRef } = await import('vue')
  audioDeviceMock.devices = ref([])

  return {
    useDevicesList: () => ({
      devices: audioDeviceMock.devices,
      audioInputs: computed(() => audioDeviceMock.devices.value.filter(device => device.kind === 'audioinput')),
      ensurePermissions: audioDeviceMock.ensurePermissions,
    }),
    useUserMedia: () => ({
      stream: shallowRef<MediaStream>(),
      start: audioDeviceMock.startStream,
      stop: audioDeviceMock.stopStream,
    }),
  }
})

function createAudioInput(deviceId: string, label: string): MediaDeviceInfo {
  return {
    deviceId,
    groupId: 'group-1',
    kind: 'audioinput',
    label,
    toJSON: () => ({}),
  }
}

describe('useAudioDevice', () => {
  beforeEach(() => {
    if (audioDeviceMock.devices)
      audioDeviceMock.devices.value = []
    audioDeviceMock.ensurePermissions.mockReset()
    audioDeviceMock.enumerateDevices.mockReset()
    audioDeviceMock.startStream.mockReset()
    audioDeviceMock.stopStream.mockReset()
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: audioDeviceMock.enumerateDevices,
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refreshes and selects audio inputs when permission was already granted', async () => {
    const microphone = createAudioInput('microphone-array', 'Microphone Array')
    audioDeviceMock.ensurePermissions.mockResolvedValue(true)
    audioDeviceMock.enumerateDevices.mockResolvedValue([microphone])

    const { useAudioDevice } = await import('./audio')
    const { askPermission, audioInputs, selectedAudioInput } = useAudioDevice()

    expect(audioInputs.value).toEqual([])

    await askPermission()

    expect(audioDeviceMock.enumerateDevices).toHaveBeenCalledOnce()
    expect(audioInputs.value).toEqual([microphone])
    expect(selectedAudioInput.value).toBe('microphone-array')
  })
})
```

- [ ] **Step 2: Run the test to verify RED**

Run from `D:\Tools\airi`:

```powershell
$nodeHome = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:Path = "$nodeHome;$env:Path"
& "$nodeHome\corepack.cmd" pnpm exec vitest run --config packages/stage-ui/vitest.config.ts packages/stage-ui/src/stores/audio.test.ts
```

Expected: FAIL because `askPermission()` does not call the browser's `enumerateDevices()` and `audioInputs` stays empty.

- [ ] **Step 3: Implement the minimal refresh**

In `useAudioDevice()`, retain the full `useDevicesList()` return so its `devices` ref can be updated. Replace `askPermission()` with an async implementation that only refreshes after a granted result:

```ts
async function askPermission() {
  try {
    const granted = await devices.ensurePermissions()
    if (!granted)
      return false

    devices.devices.value = await navigator.mediaDevices.enumerateDevices()
    await nextTick()

    if (audioInputs.value.length > 0 && !selectedAudioInput.value)
      selectedAudioInput.value = findBestDevice(audioInputs.value)

    return true
  }
  catch (error) {
    console.error('Error ensuring permissions:', error)
    throw error
  }
}
```

Do not change `findBestDevice()`, `deviceConstraints`, `startStream()`, or iOS playback behavior.

- [ ] **Step 4: Run the test to verify GREEN**

Run the Task 1 Vitest command again.

Expected: `1 passed`; `enumerateDevices()` is called once and the selected input is `microphone-array`.

- [ ] **Step 5: Commit the focused change**

```powershell
git add -- 'packages/stage-ui/src/stores/audio.ts' 'packages/stage-ui/src/stores/audio.test.ts'
git commit -m "fix(stage-ui): refresh granted microphone devices"
```

### Task 2: Restore desktop popover permission refresh

**Files:**
- Modify: `packages/stage-layouts/src/components/Widgets/ChatArea.test.ts`
- Modify: `packages/stage-layouts/src/components/Widgets/ChatArea.vue:49-50,169-171`

- [ ] **Step 1: Write the failing desktop popover test**

Extend the existing source contract test with:

```ts
it('requests microphone permission when the hearing popover opens', () => {
  const source = readFileSync(fileURLToPath(new URL('./ChatArea.vue', import.meta.url)), 'utf8')

  expect(source).toContain('const settingsAudioDevice = useSettingsAudioDevice()')
  expect(source).toContain('storeToRefs(settingsAudioDevice)')
  expect(source).toMatch(/watch\(hearingPopoverOpen, async \(value\) => \{[\s\S]*?await settingsAudioDevice\.askPermission\(\)[\s\S]*?\}\)/)
})
```

- [ ] **Step 2: Run the test to verify RED**

```powershell
$nodeHome = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:Path = "$nodeHome;$env:Path"
& "$nodeHome\corepack.cmd" pnpm exec vitest run --config packages/stage-layouts/vitest.config.ts packages/stage-layouts/src/components/Widgets/ChatArea.test.ts
```

Expected: the existing portal test passes and the new test fails because `ChatArea.vue` has no settings store variable or popover-open permission watcher.

- [ ] **Step 3: Implement the desktop watcher**

Use one Pinia store instance for both refs and actions:

```ts
const settingsAudioDevice = useSettingsAudioDevice()
const { enabled, selectedAudioInput, stream, audioInputs } = storeToRefs(settingsAudioDevice)
```

Add the watcher before the analyzer watcher:

```ts
watch(hearingPopoverOpen, async (value) => {
  if (!value)
    return

  try {
    await settingsAudioDevice.askPermission()
  }
  catch (error) {
    console.error('[ChatArea] Failed to refresh microphone devices:', error)
  }
})
```

This catch is required so a failed enumeration does not become an unhandled watcher rejection. Do not add new visible text or change the mobile dialog.

- [ ] **Step 4: Run the test to verify GREEN**

Run the Task 2 Vitest command again.

Expected: `2 passed`.

- [ ] **Step 5: Commit the focused change**

```powershell
git add -- 'packages/stage-layouts/src/components/Widgets/ChatArea.vue' 'packages/stage-layouts/src/components/Widgets/ChatArea.test.ts'
git commit -m "fix(web): refresh microphone devices from chat"
```

### Task 3: Verify the integrated Web flow and close the plan

**Files:**
- Modify: `docs/superpowers/README.md`
- Modify: `docs/superpowers/plans/2026-07-12-web-voice-input-device-refresh.md`

- [ ] **Step 1: Run both regression tests together**

```powershell
$nodeHome = 'D:\Tools\airi\.node24.local\node-v24.13.0-win-x64'
$env:Path = "$nodeHome;$env:Path"
& "$nodeHome\corepack.cmd" pnpm exec vitest run --config packages/stage-ui/vitest.config.ts packages/stage-ui/src/stores/audio.test.ts
& "$nodeHome\corepack.cmd" pnpm exec vitest run --config packages/stage-layouts/vitest.config.ts packages/stage-layouts/src/components/Widgets/ChatArea.test.ts
```

Expected: both commands exit 0 with three total passing tests.

- [ ] **Step 2: Run scoped type checks**

```powershell
& "$nodeHome\corepack.cmd" pnpm --filter '@proj-airi/stage-ui' typecheck
& "$nodeHome\corepack.cmd" pnpm --filter '@proj-airi/stage-layouts' typecheck
```

Expected: both commands exit 0 with no TypeScript errors.

- [ ] **Step 3: Build the production Web app**

```powershell
& "$nodeHome\corepack.cmd" pnpm --filter '@proj-airi/stage-web' build
```

Expected: Vite production build exits 0 and emits `apps/stage-web/dist`.

- [ ] **Step 4: Verify in a desktop browser**

Start the existing Web dev server with Node 24 on an unused port, open it at a desktop viewport, and grant microphone permission. Verify:

1. Opening the hearing popover refreshes the selector.
2. The selector no longer shows `No options` when a microphone exists.
3. Enabling the microphone produces a MediaStream and responsive volume state.
4. No unhandled permission or enumeration error appears in the browser console.

If the browser environment cannot expose a real microphone, use a Playwright Chromium session with microphone permission and a fake media device; report any limitation explicitly.

- [ ] **Step 5: Mark documentation complete**

Change the `Web 语音输入设备刷新` row in `docs/superpowers/README.md` from `planned` to `done`, add this plan link, and use `git rev-parse --short=9 HEAD` to record the latest implementation commit as evidence. Mark all completed checkboxes in this plan.

- [ ] **Step 6: Commit documentation closure**

```powershell
git add -- 'docs/superpowers/README.md' 'docs/superpowers/plans/2026-07-12-web-voice-input-device-refresh.md'
git commit -m "docs: close web voice input device refresh plan"
```

- [ ] **Step 7: Integrate and publish the branch**

Push the verified short-lived branch to `fork`, merge it into local `main` without rewriting history, push `main` to `fork`, and delete the merged local and remote short-lived branch. Do not deploy production because deployment was not requested.

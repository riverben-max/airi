import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useAiriCardStore } from './modules/airi-card'

export type GamePhase = 'idle' | 'conversation' | 'map' | 'action'
export type MoodState = 'low' | 'normal' | 'high' | 'max'

export interface Choice {
  id: string
  text: string
  title?: string
  icon?: string
  action: string
  condition?: string
  cost?: number // Time or tension cost
  positiveScore?: number
  negativeScore?: number
}

export const useDatingSimStore = defineStore('dating-sim', () => {
  const enabled = ref(false)
  const currentPhase = ref<GamePhase>('idle')

  // Amagami-inspired metrics
  const variables = ref<Record<string, number>>({
    Intimacy: 0,
    Tension: 50, // 0-100, affects how character reacts
    ActionPoints: 5, // For conversation topics
    TimeOfDay: 12, // 24h format
    Timer: 0, // Choice countdown
    positiveScore: 0,
    negativeScore: 0,
    turnsElapsed: 0,
  })

  const mood = computed<MoodState>(() => {
    const t = variables.value.Tension
    const i = variables.value.Intimacy
    if (i > 80 && t > 80)
      return 'max'
    if (t > 60)
      return 'high'
    if (t < 30)
      return 'low'
    return 'normal'
  })

  const settings = ref({
    intimacyGating: true,
    autoTicks: true,
    branchingChoices: true,
    lightningRounds: false,
    inlineCaption: true,
    contextDepth: useLocalStorage('airi:producer:context-depth', 6),
    gameMode: useLocalStorage<'open_ended' | 'goal_driven'>('airi:dating-sim:game-mode', 'open_ended'),
    showChoiceWeights: useLocalStorage<boolean>('airi:dating-sim:show-choice-weights', false),
    maxScore: useLocalStorage<number>('airi:dating-sim:max-score', 15),
    maxTurns: useLocalStorage<number>('airi:dating-sim:max-turns', 8),
    sceneryRoute: useLocalStorage<'background' | 'widget' | 'inherit'>('airi:dating-sim:scenery-route', 'inherit'),
    enableSpecialSauce: useLocalStorage<boolean>('airi:dating-sim:enable-special-sauce', true),
    tensionDecayRate: useLocalStorage<number>('airi:dating-sim:tension-decay-rate', 1),
    intimacyGainMultiplier: useLocalStorage<number>('airi:dating-sim:intimacy-gain-multiplier', 1)
  })

  const choices = ref<Choice[]>([])
  const currentSubtitle = ref<string>('')
  const activeStoryline = ref<any | null>(null)

  const resolvedSceneryRoute = computed(() => {
    const route = settings.value.sceneryRoute
    if (route === 'inherit') {
      const cardStore = useAiriCardStore()
      const cardRoute = cardStore.activeCard?.extensions?.airi?.artistry?.spawnMode || 'bg_widget'
      return cardRoute === 'bg' ? 'background' : cardRoute
    }
    return route
  })

  let addWidget: any = null
  if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
    const win = window as any
    const { context } = createContext(win.electron.ipcRenderer as any)
    const widgetsAdd = defineInvokeEventa<string | undefined, any>('eventa:invoke:electron:windows:widgets:add')
    addWidget = defineInvoke(context, widgetsAdd)
  }

  async function spawnSceneryWidget(imageUrl: string, title: string) {
    if (!addWidget)
      return

    try {
      await addWidget({
        componentName: 'artistry',
        componentProps: {
          status: 'done',
          imageUrl,
          title,
          _skipIngestion: true,
        },
        size: 'm',
        ttlMs: 0,
      })
    }
    catch (widgetErr) {
      console.warn('Failed to spawn Dating Sim scenery widget', widgetErr)
    }
  }

  // Delta Ticking Engine
  let lastTick = 0
  let loopId: number | null = null

  function startGameLoop() {
    if (loopId)
      return
    lastTick = performance.now()
    const tick = (now: number) => {
      if (!enabled.value) {
        loopId = null
        return
      }
      const dt = (now - lastTick) / 1000
      lastTick = now

      // Process Timers (e.g. countdown for choices)
      if (settings.value.lightningRounds && settings.value.autoTicks && variables.value.Timer > 0) {
        variables.value.Timer = Math.max(0, variables.value.Timer - dt)
        if (variables.value.Timer === 0) {
          handleTimeout()
        }
      }

      loopId = requestAnimationFrame(tick)
    }
    loopId = requestAnimationFrame(tick)
  }

  function handleTimeout() {
    choices.value = []
    currentSubtitle.value = '...'
    // Fallback logic when user doesn't answer in time
  }

  const isGenerating = ref(false)

  async function directorICSweep() {
    if (isGenerating.value)
      return
    isGenerating.value = true
    try {
      const { useLLM } = await import('@proj-airi/stage-ui/stores/llm')
      const { useProvidersStore } = await import('@proj-airi/stage-ui/stores/providers')
      const { useConsciousnessStore } = await import('@proj-airi/stage-ui/stores/modules/consciousness')
      const { useChatSessionStore } = await import('@proj-airi/stage-ui/stores/chat/session-store')
      const { useAiriCardStore } = await import('@proj-airi/stage-ui/stores/modules/airi-card')

      const llm = useLLM()
      const providers = useProvidersStore()
      const consciousness = useConsciousnessStore()
      const chatSession = useChatSessionStore()
      const cardStore = useAiriCardStore()

      const provider = await providers.getProviderInstance(consciousness.activeProvider)
      if (!provider || !consciousness.activeModel) {
        console.error('[DatingSim] No active model or provider')
        return
      }

      const characterName = cardStore.activeCard?.name || 'Companion'
      const rawMessages = chatSession.messages || []
      const relevantMessages = rawMessages
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .slice(-settings.value.contextDepth)

      const chatHistoryText = relevantMessages
        .map((m: any) => {
          const speaker = m.role === 'user' ? 'User' : characterName
          const content = typeof m.content === 'string' ? m.content : ''
          return `${speaker}: ${content}`
        })
        .join('\n')

      const isGameMode = settings.value.gameMode === 'goal_driven'
      const scenarioPromptContext = activeStoryline.value?.description || 'A cozy romantic interaction'

      const systemPrompt = `[HARDCODED SCHEMA WRAPPER]
The current intimacy scenario context is: "${scenarioPromptContext}"
Current state - Intimacy: ${variables.value.Intimacy}/100, Tension: ${variables.value.Tension}/100
Scratchpad: ${variables.value.Scratchpad || 'None'}

You are the Director and Intimacy Coordinator (IC) for a Dating Sim.
Read the Chat History and evaluate how the most recent interactions affect the scene, then output ONE structured JSON payload.

[HARDCODED OUTPUT REQUIREMENT]
Output raw JSON only matching this exact schema:
{
  "visuals": {
    "threshold": 80,
    "prompt": "Description of the scene to generate",
    "concepts": ["tag1", "tag2"]
  },
  "state_updates": {
    "intimacy_delta": <number, e.g. 3 or -2>,
    "tension_delta": <number, e.g. -5 or 2>,
    "mood": "<low | normal | high | max>"
  },
  "scratchpad": {
    "spatial_continuity": "Short description of where characters are physically positioned right now."
  },
  "player_options": [
    {
      "title": "Short action title, e.g. Challenge Her",
      "message": "Full spoken sentence in the user's voice",
      "positiveScore": ${isGameMode ? '<number>' : 0},
      "negativeScore": ${isGameMode ? '<number>' : 0},
      "apCost": <number>
    }
  ]
}

Rules for player_options:
- Provide exactly 4 options.
- The "title" is what is shown on the button. The "message" is what the user actually says.
- Message MUST be written in the user's natural voice, no meta-commentary.
${isGameMode ? '- As this is a Goal-Driven mode, assign positiveScore and negativeScore weights to each choice (0-5).' : ''}`

      const userPrompt = `Here is the conversation history so far:
${chatHistoryText}

Perform the background Director/IC Sweep and generate the next state and player options in raw JSON format.`

      const result = await llm.generate(
        consciousness.activeModel,
        provider as any,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      )

      const rawText = result.text || (result as any).reasoning || ''
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found in response')
      const object = JSON.parse(match[0])

      // Apply state updates (only if NOT in goal_driven mode; in goal_driven mode, choices directly adjust scores)
      if (!isGameMode) {
        if (typeof object.state_updates?.intimacy_delta === 'number') {
          let delta = object.state_updates.intimacy_delta
          if (delta > 0) delta *= settings.value.intimacyGainMultiplier
          setVariable('Intimacy', Math.max(0, Math.min(100, getVariable('Intimacy') + delta)))
        }
        if (typeof object.state_updates?.tension_delta === 'number') {
          let delta = object.state_updates.tension_delta
          if (delta < 0) delta *= settings.value.tensionDecayRate
          setVariable('Tension', Math.max(0, Math.min(100, getVariable('Tension') + delta)))
        }
        if (object.state_updates?.mood) {
          broadcastMood(object.state_updates.mood)
        }
      }

      if (object.scratchpad?.spatial_continuity) {
        setVariable('Scratchpad', object.scratchpad.spatial_continuity)
      }

      // Generate Background Visuals
      if (object.visuals && object.visuals.prompt) {
        // Trigger Autonomous Artistry with the prompt
        // TODO: Map to actual Artistry bridge call. For now we use scenery widget if applicable.
        const cardRoute = resolvedSceneryRoute.value
        if (cardRoute === 'background' || cardRoute === 'widget' || cardRoute === 'bg_widget') {
          // Send to background artistry here
          console.log('[DatingSim] Director visual prompt:', object.visuals.prompt)
        }
      }

      // Setup choices
      const liveChoices = (object.player_options || []).slice(0, 4).map((o: any, i: number) => ({
        id: `t${i}`,
        title: o.title,
        text: o.message,
        positiveScore: o.positiveScore || 0,
        negativeScore: o.negativeScore || 0,
        cost: o.apCost || 0,
        icon: 'i-solar:chat-round-dots-bold-duotone',
        action: 'llm_topic',
      }))

      // The Director Sweep does not generate a subtitle for the current turn, 
      // as the Assistant just spoke. We wait for the user to make a choice.
      choices.value = liveChoices
    }
    catch (err) {
      console.error('[DatingSim] Director/IC Sweep Failed:', err)
    }
    finally {
      isGenerating.value = false
    }
  }

  async function producerSetup(customPromptVal: string, story?: any) {
    if (isGenerating.value)
      return
    isGenerating.value = true
    try {
      activeStoryline.value = story || { description: customPromptVal }

      const { useLLM } = await import('@proj-airi/stage-ui/stores/llm')
      const { useProvidersStore } = await import('@proj-airi/stage-ui/stores/providers')
      const { useConsciousnessStore } = await import('@proj-airi/stage-ui/stores/modules/consciousness')
      const { useChatSessionStore } = await import('@proj-airi/stage-ui/stores/chat/session-store')
      
      const llm = useLLM()
      const providers = useProvidersStore()
      const consciousness = useConsciousnessStore()
      const chatSession = useChatSessionStore()

      const provider = await providers.getProviderInstance(consciousness.activeProvider)
      if (!provider || !consciousness.activeModel) return

      const rawMessages = chatSession.messages || []
      const relevantMessages = rawMessages
        .filter((m: any) => m.role === 'user' || m.role === 'assistant')
        .slice(-settings.value.contextDepth)
      const chatHistoryText = relevantMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n')

      const isGameMode = settings.value.gameMode === 'goal_driven'

      const systemPrompt = `You are the Producer establishing a Dating Sim scene.
Given the scenario prompt "${customPromptVal}" and the last ${settings.value.contextDepth} turns of dialogue, generate:
1. An initial inner thought/subtitle for the character setting the scene.
2. Four starting dialogue options (Title + Message) written exactly in the user's conversational voice.

Output MUST be raw JSON: 
{
  "subtitle": "...", 
  "options": [
    {
      "title": "Short title", 
      "message": "Full sentence message in user's voice", 
      "positiveScore": ${isGameMode ? '<number 0-5>' : 0}, 
      "negativeScore": ${isGameMode ? '<number 0-5>' : 0}, 
      "apCost": <number 0-3>
    }
  ]
}`
      
      const userPrompt = `Chat History:\n${chatHistoryText}\n\nGenerate the starting scene payload in raw JSON.`

      const result = await llm.generate(consciousness.activeModel, provider as any, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ])

      const rawText = result.text || (result as any).reasoning || ''
      const match = rawText.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('No JSON object found in response')
      const object = JSON.parse(match[0])

      currentSubtitle.value = object.subtitle || ''
      
      const liveChoices = (object.options || []).slice(0, 4).map((o: any, i: number) => ({
        id: `sc${i}`,
        title: o.title,
        text: o.message,
        positiveScore: o.positiveScore || 0,
        negativeScore: o.negativeScore || 0,
        cost: o.apCost || 0,
        icon: 'i-solar:chat-round-dots-bold-duotone',
        action: 'llm_topic',
      }))
      
      choices.value = liveChoices
    }
    catch (err) {
      console.error('[DatingSim] Producer Setup Failed:', err)
    }
    finally {
      isGenerating.value = false
    }
  }

  // Hook into Chat Turn Completion
  let unhookChat: (() => void) | null = null
  watch(() => enabled.value, async (val) => {
    if (val) {
      const { useChatOrchestratorStore } = await import('@proj-airi/stage-ui/stores/chat')
      const orchestrator = useChatOrchestratorStore()
      if (!unhookChat) {
        unhookChat = orchestrator.onChatTurnComplete(async () => {
          if (enabled.value) {
            await directorICSweep()
          }
        })
      }
    } else {
      if (unhookChat) {
        unhookChat()
        unhookChat = null
      }
    }
  }, { immediate: true })

  function setVariable(name: string, value: number) {
    variables.value[name] = value
  }

  function getVariable(name: string): number {
    return variables.value[name] || 0
  }

  function evaluateCondition(condition?: string): boolean {
    if (!condition)
      return true
    const parts = condition.split(' ')
    if (parts.length < 3)
      return false
    const [varName, op, targetStr] = parts
    const currentValue = getVariable(varName)
    const target = Number.parseFloat(targetStr)

    switch (op) {
      case 'equal': return currentValue === target
      case 'greater': return currentValue > target
      case 'less': return currentValue < target
      case 'greater_equal':
      case 'greater_eq': return currentValue >= target
      case 'lower_equal':
      case 'less_equal':
      case 'less_eq': return currentValue <= target
      case 'not_equal': return currentValue !== target
      default: return false
    }
  }

  function executeAssignment(code: string) {
    const parts = code.split(' ')
    if (parts.length < 3)
      return
    const [varName, op, ...exprParts] = parts
    const expr = exprParts.join(' ')
    const currentValue = getVariable(varName)

    if (op === 'assign') {
      if (expr.startsWith('rand(')) {
        const match = expr.match(/rand\((\d+),(\d+)\)/)
        if (match) {
          const min = Number.parseInt(match[1], 10)
          const max = Number.parseInt(match[2], 10)
          setVariable(varName, Math.floor(Math.random() * (max - min + 1)) + min)
        }
      }
      else {
        setVariable(varName, Number.parseFloat(expr))
      }
    }
    else if (op === 'add') {
      setVariable(varName, currentValue + Number.parseFloat(expr))
    }
    else if (op === 'subtract') {
      setVariable(varName, currentValue - Number.parseFloat(expr))
    }
  }

  // 3. The Instruction Sequencer (Command Pipeline)
  function executeScript(script: string) {
    const commands = script.split(';')
    for (const rawCmd of commands) {
      const cmd = rawCmd.trim()
      if (!cmd)
        continue

      if (cmd.startsWith('start_mtn')) {
        const target = cmd.replace('start_mtn', '').trim()
        console.info(`[Dating Sim Pipeline] Triggering motion: ${target}`)
        window.dispatchEvent(new CustomEvent('dating-sim:trigger-motion', { detail: target }))
      }
      else if (cmd.startsWith('clear_exp')) {
        console.info(`[Dating Sim Pipeline] Clearing expressions.`)
        window.dispatchEvent(new CustomEvent('dating-sim:clear-exp'))
      }
      else if (cmd.startsWith('motions enable')) {
        console.info(`[Dating Sim Pipeline] Enabling idle motions.`)
        window.dispatchEvent(new CustomEvent('dating-sim:motions-enable', { detail: true }))
      }
      else if (cmd.startsWith('motions disable')) {
        console.info(`[Dating Sim Pipeline] Disabling idle motions.`)
        window.dispatchEvent(new CustomEvent('dating-sim:motions-enable', { detail: false }))
      }
      else if (cmd.startsWith('change_cos')) {
        const modelJson = cmd.replace('change_cos', '').trim()
        console.info(`[Dating Sim Pipeline] Dynamic Model Hot-Swap: ${modelJson}`)
        window.dispatchEvent(new CustomEvent('dating-sim:change-cos', { detail: modelJson }))
      }
    }
  }

  // 4. The JSON Command Interpreter (For complex Steam DSL objects)
  function executeJSONCommand(payload: any) {
    // 1. Evaluate Intimacy bounds if present
    if (payload.Intimacy) {
      const currentIntimacy = getVariable('Intimacy')
      if (payload.Intimacy.Min !== undefined && currentIntimacy < payload.Intimacy.Min) {
        console.info(`[Dating Sim Pipeline] Command rejected. Intimacy too low (${currentIntimacy} < ${payload.Intimacy.Min})`)
        return false // Block execution
      }
      if (payload.Intimacy.Max !== undefined && currentIntimacy > payload.Intimacy.Max) {
        console.info(`[Dating Sim Pipeline] Command rejected. Intimacy too high (${currentIntimacy} > ${payload.Intimacy.Max})`)
        return false
      }
      if (payload.Intimacy.Bonus) {
        const bonus = payload.Intimacy.Bonus * settings.value.intimacyGainMultiplier
        setVariable('Intimacy', Math.min(100, currentIntimacy + bonus))
        console.info(`[Dating Sim Pipeline] Applied Intimacy Bonus: +${bonus}`)
      }
    }

    // 2. Evaluate VarFloats conditional guards (Type 1)
    if (payload.VarFloats && Array.isArray(payload.VarFloats)) {
      for (const v of payload.VarFloats) {
        if (v.Type === 1) {
          const conditionStr = `${v.Name} ${v.Code}`
          if (!evaluateCondition(conditionStr)) {
            console.info(`[Dating Sim Pipeline] Command rejected by VarFloats condition: ${conditionStr}`)
            return false // Block execution
          }
        }
      }
    }

    // 3. Execute the primary command
    if (payload.Command) {
      executeScript(payload.Command)
    }

    // 4. Handle explicit variable assignments from VarFloats (Type 2)
    if (payload.VarFloats && Array.isArray(payload.VarFloats)) {
      for (const v of payload.VarFloats) {
        if (v.Type === 2) {
          executeAssignment(`${v.Name} ${v.Code}`)
        }
      }
    }

    // 5. Handle Text / Subtitle dynamically parsing variable templates
    if (payload.Text) {
      let text = payload.Text.replace(/\{\$br\}/g, '\n')
      // Map {$vi_IntimacyVI} to the actual variable
      text = text.replace(/\{\$vi_([A-Za-z0-9_]+)\}/g, (_: any, varName: string) => {
        return String(getVariable(varName))
      })
      currentSubtitle.value = text
    }

    // 6. Handle UI Choices branching
    if (payload.Choices && Array.isArray(payload.Choices)) {
      choices.value = payload.Choices.map((c: any, index: number) => {
        let text = c.Text || 'Option'
        text = text.replace(/\{\$vi_([A-Za-z0-9_]+)\}/g, (_: any, varName: string) => {
          return String(getVariable(varName))
        })
        return {
          id: `dsl_choice_${index}`,
          title: text,
          text: text, // The overlay expects this
          action: 'dsl_mtn', // custom action type
          metadata: { NextMtn: c.NextMtn } // we need to store NextMtn
        }
      })
    }

    // 7. Handle Expression (Special Sauce DSL)
    if (payload.Expression) {
      if (payload.Expression === 'clear') {
        window.dispatchEvent(new CustomEvent('dating-sim:clear-exp'))
        import('@proj-airi/stage-ui-three').then(({ useModelStore }) => {
          useModelStore().activeExpressions = {}
        }).catch(() => {})
      } else {
        broadcastMood(payload.Expression)
      }
    }

    // 8. Execute PostCommand if present
    if (payload.PostCommand) {
      executeScript(payload.PostCommand)
    }

    return true
  }

  // Lifecycle
  function enable() {
    enabled.value = true
    if (typeof window !== 'undefined' && (window as any).electron) {
      ;(window as any).electron.ipcRenderer.invoke('stage-window-set-bounds', { width: 1200, height: 800, center: true }).catch(console.error)
    }
    startGameLoop()
  }

  function disable() {
    enabled.value = false
    if (typeof window !== 'undefined' && (window as any).electron) {
      ;(window as any).electron.ipcRenderer.invoke('stage-window-set-bounds', { width: 450, height: 600, center: false }).catch(console.error)
    }
    choices.value = []
    currentSubtitle.value = ''
    activeStoryline.value = null
    variables.value = {
      Intimacy: 0,
      Tension: 50,
      ActionPoints: 5,
      TimeOfDay: 12,
      Timer: 0,
      positiveScore: 0,
      negativeScore: 0,
      turnsElapsed: 0,
    }
    if (loopId !== null) {
      cancelAnimationFrame(loopId)
      loopId = null
    }
  }

  // Cross-Window Sync for testing
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('dating-sim-sync') : null
  if (bc) {
    bc.onmessage = (event) => {
      if (event.data.type === 'test') {
        enable()
        currentPhase.value = 'conversation'
        setVariable('Intimacy', 75)
        setVariable('Tension', 80)
        setVariable('ActionPoints', 3)
        setVariable('Timer', 10)
        choices.value = event.data.choices
        currentSubtitle.value = event.data.subtitle
      }
      if (event.data.type === 'clear') {
        disable()
        choices.value = []
        currentSubtitle.value = ''
      }
      if (event.data.type === 'toggle') {
        if (event.data.enabled)
          enable()
        else disable()
      }
      if (event.data.type === 'mood') {
        applyMood(event.data.mood)
      }
    }
  }

  function syncToggle(isEnabled: boolean) {
    if (isEnabled)
      enable()
    else disable()
    if (bc)
      bc.postMessage({ type: 'toggle', enabled: isEnabled })
  }

  function toggleDatingSim() {
    if (enabled.value) {
      syncToggle(false)
    }
    else {
      syncToggle(true)
      if (settings.value.gameMode !== 'goal_driven') {
        directorICSweep()
      }
    }
  }

  function applyMood(newMood: string) {
    import('@proj-airi/stage-ui-live2d/stores/live2d').then(({ useLive2d }) => {
      const live2dStore = useLive2d()
      if (live2dStore.model) {
        const m = newMood.toLowerCase()
        const specialSauceMap: Record<string, { group: string, index: number } | string> = {
          happy: { group: 'Face#2', index: 1 },
          surprised: { group: 'Face#2', index: 2 },
          sad: { group: 'Face#2', index: 3 },
          angry: { group: 'Face#2', index: 5 },
          cool: { group: 'Face#2', index: 6 },
          shy: { group: 'Face#2', index: 7 },
          think: { group: 'Face#2', index: 8 },
          neutral: { group: 'Face#2', index: 0 },
          love: 'exp12',
          blush: 'exp01',
        }
        let handled = false
        const motionManager = live2dStore.model?.internalModel?.motionManager

        if (settings.value.enableSpecialSauce && m in specialSauceMap) {
          const mapped = specialSauceMap[m]
          if (typeof mapped === 'string') {
            handled = live2dStore.triggerEmotion(mapped)
          }
          else if (motionManager && motionManager.definitions && motionManager.definitions[mapped.group]) {
            motionManager.startMotion(mapped.group, mapped.index)
            handled = true
          }
        }

        if (!handled) {
          handled = live2dStore.triggerEmotion(m)
        }

        // Ultimate Fallback: Try to find a motion group matching the mood
        if (!handled && motionManager && motionManager.definitions) {
          const groups = Object.keys(motionManager.definitions)
          const matchedGroup = groups.find(g => g.toLowerCase() === m) ||
                               groups.find(g => g.toLowerCase().includes(m))
          if (matchedGroup) {
            motionManager.startMotion(matchedGroup, 0)
          }
        }
      }
    }).catch(() => {})

    import('@proj-airi/stage-ui-three').then(({ useModelStore }) => {
      const vrmStore = useModelStore()
      if (vrmStore.activeVrm) {
        const m = newMood.toLowerCase()
        let matched: string | null = null

        if (settings.value.enableSpecialSauce) {
          matched = vrmStore.availableExpressions.find((e: string) => e.toLowerCase() === m) || null
          if (!matched) {
            matched = vrmStore.availableExpressions.find((e: string) => e.toLowerCase().includes(m)) || null
          }
          const vrmSpecialSauce: Record<string, string> = {
            happy: 'joy',
            sad: 'sorrow',
            angry: 'angry',
            surprised: 'surprised',
            neutral: 'neutral',
            cool: 'fun',
            shy: 'blush', // Assuming shy maps to a blush
            love: 'joy'
          }
          if (!matched && m in vrmSpecialSauce) {
            matched = vrmStore.availableExpressions.find((e: string) => e.toLowerCase() === vrmSpecialSauce[m]) || null
          }
        } else {
          matched = vrmStore.availableExpressions.find((e: string) => e.toLowerCase() === m) || null
        }

        if (matched) {
          vrmStore.activeExpressions = { [matched]: 1 }
        }
      }
    }).catch(() => {})
  }

  function broadcastMood(newMood: string) {
    applyMood(newMood)
    if (bc)
      bc.postMessage({ type: 'mood', mood: newMood })
  }

  function triggerTestSync() {
    const testChoices = [
      { id: '1', text: 'Give a Present', icon: 'i-solar:gift-bold-duotone', action: 'give_gift', cost: 1 },
      { id: '2', text: 'Ask about hobbies', icon: 'i-solar:gamepad-bold-duotone', action: 'chat', cost: 1 },
      { id: '3', text: 'Stare quietly', icon: 'i-solar:eye-bold-duotone', action: 'stare', condition: 'Intimacy greater 50', cost: 2 },
      { id: '4', text: 'Hold Hands', icon: 'i-solar:hand-heart-bold-duotone', action: 'hold_hands', condition: 'Intimacy greater 70', cost: 3 },
    ]
    const testSubtitle = 'They seem to be waiting for your response...'

    // Apply locally
    enable()
    currentPhase.value = 'conversation'
    setVariable('Intimacy', 75)
    setVariable('Tension', 80)
    setVariable('ActionPoints', 3)
    setVariable('Timer', 10)
    choices.value = testChoices
    currentSubtitle.value = testSubtitle

    // Broadcast to Stage window
    if (bc)
      bc.postMessage({ type: 'test', choices: testChoices, subtitle: testSubtitle })
  }

  function triggerTestSyncCustom(customChoices: Choice[], subtitle: string) {
    enable()
    currentPhase.value = 'conversation'
    setVariable('Intimacy', 75)
    setVariable('Tension', 80)
    setVariable('ActionPoints', 3)
    setVariable('Timer', 10)
    choices.value = customChoices
    currentSubtitle.value = subtitle

    if (activeStoryline.value) {
      const route = resolvedSceneryRoute.value
      if (route === 'widget' || route === 'bg_widget') {
        spawnSceneryWidget(activeStoryline.value.coverImage, activeStoryline.value.title)
      }
    }

    if (bc)
      bc.postMessage({ type: 'test', choices: customChoices, subtitle })
  }

  function clearTestSync() {
    disable()
    choices.value = []
    currentSubtitle.value = ''
    if (bc)
      bc.postMessage({ type: 'clear' })
  }

  if (typeof window !== 'undefined' && (window as any).electron) {
    const ipcRenderer = (window as any).electron.ipcRenderer
    if (typeof ipcRenderer.removeAllListeners === 'function') {
      try { ipcRenderer.removeAllListeners('dating-sim-toggle') }
      catch (e) {}
    }
    ipcRenderer.on('dating-sim-toggle', () => {
      toggleDatingSim()
    })
  }

  return {
    enabled,
    settings,
    currentPhase,
    variables,
    mood,
    choices,
    currentSubtitle,
    activeStoryline,
    resolvedSceneryRoute,
    spawnSceneryWidget,
    setVariable,
    getVariable,
    evaluateCondition,
    executeAssignment,
    executeScript,
    executeJSONCommand,
    enable,
    disable,
    triggerTestSync,
    triggerTestSyncCustom,
    clearTestSync,
    toggleDatingSim,
    syncToggle,
    directorICSweep,
    producerSetup,
    broadcastMood,
    isGenerating,
  }
})

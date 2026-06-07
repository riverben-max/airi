# Live2D Interaction and Expression Enhancements

This document outlines the modifications made to improve the interactivity and expression handling of Live2D models.

## 1. Enabling Global Tactile Interaction for Live2D Models

**Problem:** By default, the application's global `interactionMode` is set to `orbit` (designed primarily for 3D VRM camera controls). In `orbit` mode, `Model.vue` was instructed to ignore all canvas mouse events, rendering Live2D models unclickable unless the user explicitly toggled into `tactile` mode.

**Solution:** Removed the `interactionMode` restrictions from the canvas listeners in `Model.vue`. Live2D models are 2D and do not rely on 3D orbiting, so they should natively support clicks at all times.

**File:** `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`

```typescript
function onCanvasClick(event: MouseEvent) {
  // Removed: if (interactionMode.value !== 'tactile' || !model.value || !props.app) return
  if (!model.value || !props.app)
    return

  // ...
}

function setupCanvasListeners() {
  cleanupCanvasListeners()

  // Removed: if (interactionMode.value !== 'tactile' || !model.value || !props.app) return
  if (!model.value || !props.app)
    return

  // ...
}
```

## 2. Supporting Clicks Without Defined Hit Areas

**Problem:** The original click logic required the user to hit a specifically defined `hitArea` (e.g., "Head" or "Body" boxes authored in Cubism). Many models do not define these areas, causing valid clicks to be ignored entirely.

**Solution:** Modified the intersection logic to check if the click coordinates intersect the model's global bounding box as a fallback when no `hitArea` is returned.

**File:** `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`

```typescript
const hitAreas = model.value.hitTest(globalX, globalY)
let hitArea = ''
if (hitAreas && hitAreas.length > 0) {
  hitArea = hitAreas[0]
}

// Fallback: check if the global bounds contain the click
const bounds = model.value.getBounds()
const clickedModel = hitArea !== '' || bounds.contains(globalX, globalY)

if (clickedModel) {
  // ... trigger expression logic ...
}
```

## 3. Dynamic Tactile Expression Pooling

**Problem:** If a hit area was clicked, the logic attempted to fuzzy-match the hit area's name (e.g., "Head") directly to an expression file name. If it found a match (like an expression containing the letter "a"), it would trigger that exact same expression over and over.

**Solution:** Replaced the exact match with a categorical pooling system. The hit area string is evaluated against a list of sensitive vs. non-sensitive keywords (supporting both English and Japanese conventions). Based on the body part, the system gathers a pool of contextually appropriate emotion keywords and randomly selects an inactive expression that matches.

**File:** `packages/stage-ui-live2d/src/components/scenes/live2d/Model.vue`

```typescript
const hitAreaLower = hitArea.toLowerCase()

const privateHitAreas = ['bust', 'chest', 'boob', 'breast', 'crotch', 'skirt', 'thigh', 'leg', 'butt', 'hip', 'belly', 'private', '胸', '股', '尻', '脚', '足', 'おっぱい', 'お腹']
const headHitAreas = ['head', 'face', 'hair', '頭', 'アタマ', '顔', '髪']
const handHitAreas = ['hand', 'arm', 'finger', '手', '腕']

let emotionKeywords: string[] = []

if (privateHitAreas.some(k => hitAreaLower.includes(k))) {
  // Dynamic responses for sensitive areas
  emotionKeywords = ['angry', 'anger', 'mad', 'frown', 'disgust', 'upset', 'hate', '怒', 'blush', 'shy', 'embarrass', 'red', '照', '恥', 'surprise', 'shock', 'gasp', '驚', 'cry', 'tear', 'sad', '泣', '悲']
}
else if (headHitAreas.some(k => hitAreaLower.includes(k))) {
  // Dynamic responses for headpats
  emotionKeywords = ['happy', 'smile', 'joy', 'laugh', 'glad', 'fun', '喜', '笑', 'wink', 'proud', 'smug', 'heh', 'ドヤ', 'blush', 'shy', '照', 'sleep', 'close', '眠', '閉']
}
else if (handHitAreas.some(k => hitAreaLower.includes(k))) {
  // Dynamic responses for holding hands
  emotionKeywords = ['happy', 'smile', 'fun', 'glad', '喜', '笑', 'wink', 'surprise', 'shock', '驚', 'confused', 'think', 'what', '困', '思']
}

let selectedExpression = null

if (emotionKeywords.length > 0) {
  // Randomly select an expression that matches any of the context keywords
  const emotionChoices = choices.filter(e => emotionKeywords.some(k => e.name.toLowerCase().includes(k)))
  if (emotionChoices.length > 0) {
    selectedExpression = emotionChoices[Math.floor(Math.random() * emotionChoices.length)]
  }
}

// Fallback to purely random if unclassified or specific expression not found
if (!selectedExpression) {
  selectedExpression = choices[Math.floor(Math.random() * choices.length)]
}
```

## 4. Enhanced LLM Expression Keyword Clustering

**Problem:** The ACT Pipeline triggers expressions based on the LLM's raw output string. If the LLM output "mad" but the model's expression file was named "angry.exp3.json", the basic substring fallback search would fail.

**Solution:** Brought the robust keyword clustering logic into `live2dStore.triggerEmotion`. If the LLM requests an emotion that falls into a known cluster (e.g., the anger cluster), it will broaden its search to include all synonyms and Japanese equivalents, dramatically improving out-of-the-box compatibility with models.

**File:** `packages/stage-ui-live2d/src/stores/live2d.ts`

```typescript
// 3. Smart fuzzy match using emotion keyword clusters
if (!matched) {
  const keyLower = emotionKey.toLowerCase()
  let searchKeywords = [keyLower]

  const emotionClusters = [
    ['happy', 'smile', 'joy', 'laugh', 'glad', 'fun', '喜', '笑'],
    ['angry', 'anger', 'mad', 'frown', 'disgust', 'upset', 'hate', '怒'],
    ['sad', 'cry', 'tear', 'sorrow', 'depressed', '泣', '悲'],
    ['surprise', 'shock', 'gasp', '驚'],
    ['blush', 'shy', 'embarrass', 'red', '照', '恥'],
    ['wink', 'smug', 'proud', 'heh', 'ドヤ'],
    ['think', 'confused', 'what', '困', '思'],
    ['sleep', 'close', '眠', '閉']
  ]

  // Broaden the search keywords if the requested emotion belongs to a cluster
  const matchedCluster = emotionClusters.find(cluster => cluster.some(k => keyLower.includes(k)))
  if (matchedCluster) {
    searchKeywords = matchedCluster
  }

  matched = availableExpressions.value.find(
    e => searchKeywords.some(k => e.name.toLowerCase().includes(k)) || keyLower.includes(e.name.toLowerCase().replace(/\.exp3$/, ''))
  )
}

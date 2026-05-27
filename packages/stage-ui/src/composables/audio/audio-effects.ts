import type { VoiceProfile } from '../../stores/providers/types'

export interface AudioEffectsResult {
  lastNode: AudioNode
  cleanup: () => void
}

/**
 * Connects and chains real-time Web Audio API node transformations
 * based on the provided voice profile effects configuration.
 *
 * @param audioContext The AudioContext session
 * @param source The input AudioBufferSourceNode
 * @param effects The effects configuration payload
 */
export function applyVoiceProfileEffects(
  audioContext: AudioContext,
  source: AudioBufferSourceNode,
  effects: VoiceProfile['effects'],
): AudioEffectsResult {
  const nodesToDisconnect: AudioNode[] = []

  // Apply pitch & rate adjustments via playbackRate
  const pitchFactor = 1 + (effects.pitch / 100) * 0.5
  const speedFactor = effects.rate || 1.0
  source.playbackRate.value = speedFactor * pitchFactor

  let lastNode: AudioNode = source

  // 1. ASMR Warmth / Whisper Effect (Lowpass filter + Compression)
  const asmrVal = effects.asmr || 0
  if (asmrVal > 0) {
    const asmrLowpass = audioContext.createBiquadFilter()
    asmrLowpass.type = 'lowpass'
    asmrLowpass.frequency.value = 20000 - (asmrVal / 100) * 18200 // Sweep down to 1800Hz

    const compressor = audioContext.createDynamicsCompressor()
    compressor.threshold.value = -30
    compressor.knee.value = 40
    compressor.ratio.value = 12
    compressor.attack.value = 0.003
    compressor.release.value = 0.25

    lastNode.connect(asmrLowpass)
    asmrLowpass.connect(compressor)

    nodesToDisconnect.push(asmrLowpass, compressor)
    lastNode = compressor
  }

  // 2. Retro Radio Filter (Highpass + Lowpass filters in series)
  const radioVal = effects.radio || 0
  if (radioVal > 0) {
    const radioHighpass = audioContext.createBiquadFilter()
    radioHighpass.type = 'highpass'
    radioHighpass.frequency.value = 10 + (radioVal / 100) * 490 // Sweep up to 500Hz

    const radioLowpass = audioContext.createBiquadFilter()
    radioLowpass.type = 'lowpass'
    radioLowpass.frequency.value = 20000 - (radioVal / 100) * 17500 // Sweep down to 2500Hz

    lastNode.connect(radioHighpass)
    radioHighpass.connect(radioLowpass)

    nodesToDisconnect.push(radioHighpass, radioLowpass)
    lastNode = radioLowpass
  }

  // 3. Robotic Droid (Comb filter feedback delay loop)
  const robotVal = effects.robot || 0
  if (robotVal > 0) {
    const delayNode = audioContext.createDelay()
    delayNode.delayTime.value = 0.002 // 2ms metallic feedback delay

    const feedbackGain = audioContext.createGain()
    feedbackGain.gain.value = (robotVal / 100) * 0.85

    const wetGain = audioContext.createGain()
    wetGain.gain.value = (robotVal / 100) * 0.7

    const robotOutput = audioContext.createGain()

    // Dry path
    lastNode.connect(robotOutput)

    // Wet path (feedback loop)
    lastNode.connect(delayNode)
    delayNode.connect(feedbackGain)
    feedbackGain.connect(delayNode)
    delayNode.connect(wetGain)
    wetGain.connect(robotOutput)

    nodesToDisconnect.push(delayNode, feedbackGain, wetGain, robotOutput)
    lastNode = robotOutput
  }

  // 4. Cathedral Reverb / Space Echo (350ms delay line with feedback)
  const reverbVal = effects.reverb || 0
  if (reverbVal > 0) {
    const delayNode = audioContext.createDelay()
    delayNode.delayTime.value = 0.35 // 350ms delay

    const feedbackGain = audioContext.createGain()
    feedbackGain.gain.value = 0.1 + (reverbVal / 100) * 0.6 // Feedback echo decay

    const wetGain = audioContext.createGain()
    wetGain.gain.value = (reverbVal / 100) * 0.65

    const reverbOutput = audioContext.createGain()

    // Dry path
    lastNode.connect(reverbOutput)

    // Wet path
    lastNode.connect(delayNode)
    delayNode.connect(feedbackGain)
    feedbackGain.connect(delayNode)
    delayNode.connect(wetGain)
    wetGain.connect(reverbOutput)

    nodesToDisconnect.push(delayNode, feedbackGain, wetGain, reverbOutput)
    lastNode = reverbOutput
  }

  // 5. Stereo Spatial Panning (Always active, maps -100 to +100 into -1.0 to +1.0)
  const spatialVal = effects.spatial || 0
  const panner = audioContext.createStereoPanner()
  panner.pan.value = spatialVal / 100
  lastNode.connect(panner)
  nodesToDisconnect.push(panner)
  lastNode = panner

  const cleanup = () => {
    try {
      source.disconnect()
    }
    catch {}
    for (const node of nodesToDisconnect) {
      try {
        node.disconnect()
      }
      catch {}
    }
  }

  return {
    lastNode,
    cleanup,
  }
}

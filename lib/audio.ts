/**
 * Procedural ambient sound: filtered noise for moving water, a low filter hum,
 * and occasional bubble blips. No audio files needed.
 */
export class AmbientAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  enabled = false

  async start() {
    if (this.enabled) return
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!this.ctx) this.build(new AC())
    await this.ctx!.resume()
    this.master!.gain.setTargetAtTime(0.5, this.ctx!.currentTime, 0.8)
    this.enabled = true
    this.scheduleBlip()
  }

  stop() {
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3)
    this.enabled = false
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
  }

  private build(ctx: AudioContext) {
    this.ctx = ctx
    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
    this.master = master

    // brown noise -> bandpass = water movement
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1
      last = (last + 0.02 * w) / 1.02
      data[i] = last * 3.5
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'lowpass'
    bp.frequency.value = 600
    const ng = ctx.createGain()
    ng.gain.value = 0.35
    // slow swell
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 250
    lfo.connect(lfoGain).connect(bp.frequency)
    noise.connect(bp).connect(ng).connect(master)
    noise.start()
    lfo.start()

    // filter hum
    for (const [f, g] of [
      [55, 0.03],
      [110, 0.015],
      [165, 0.006],
    ] as const) {
      const o = ctx.createOscillator()
      o.frequency.value = f
      const og = ctx.createGain()
      og.gain.value = g
      o.connect(og).connect(master)
      o.start()
    }
  }

  private scheduleBlip() {
    if (!this.enabled) return
    this.timer = setTimeout(() => {
      this.blip()
      this.scheduleBlip()
    }, 300 + Math.random() * 2200)
  }

  private blip() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    const f0 = 300 + Math.random() * 500
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f0 * 2.4, t + 0.07)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.025 + Math.random() * 0.02, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + 0.15)
  }
}

let audio: AmbientAudio | null = null
export function getAudio(): AmbientAudio {
  if (!audio) audio = new AmbientAudio()
  return audio
}

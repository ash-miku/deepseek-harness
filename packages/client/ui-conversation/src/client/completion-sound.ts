/** Durable completion-sound preferences. */
import type { ObservableSnapshot, SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ConfigForm } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  COMPLETION_SOUND_FIELD, COMPLETION_SOUND_TONE_FIELD, COMPLETION_SOUND_VOLUME_FIELD,
  DEFAULT_COMPLETION_SOUND, DEFAULT_COMPLETION_SOUND_TONE, DEFAULT_COMPLETION_SOUND_VOLUME,
  type CompletionSoundTone, type ConversationSettings,
} from '../submission-settings.ts'

/** A tone selection plus the explicit disabled option used by the settings menu. */
export type CompletionSoundSelection = 'off' | CompletionSoundTone

type ToneParam = {
  setValueAtTime(value: number, time: number): void
  exponentialRampToValueAtTime(value: number, time: number): void
}

type ToneOscillator = {
  type: string
  frequency: ToneParam
  connect(destination: unknown): void
  start(time: number): void
  stop(time: number): void
}

type ToneGain = {
  gain: ToneParam
  connect(destination: unknown): void
}

type ToneContext = {
  state: string
  currentTime: number
  destination: unknown
  createOscillator(): ToneOscillator
  createGain(): ToneGain
  resume(): Promise<void>
  close(): Promise<void>
}

type AudioContextConstructor = new () => ToneContext

type BrowserGlobal = typeof globalThis & {
  AudioContext?: AudioContextConstructor
  webkitAudioContext?: AudioContextConstructor
}

type ToneNote = {
  frequency: number
  offset: number
  duration: number
  level: number
  type: string
}

const TONE_PROFILES: Record<CompletionSoundTone, readonly ToneNote[]> = {
  'ding-dong': [
    { frequency: 880, offset: 0, duration: 0.18, level: 1, type: 'sine' },
    { frequency: 1174.66, offset: 0.1, duration: 0.18, level: 0.9, type: 'sine' },
  ],
  bell: [
    { frequency: 660, offset: 0, duration: 0.38, level: 1, type: 'sine' },
    { frequency: 990, offset: 0.015, duration: 0.32, level: 0.38, type: 'sine' },
    { frequency: 1320, offset: 0.03, duration: 0.24, level: 0.22, type: 'triangle' },
  ],
  chime: [
    { frequency: 1046.5, offset: 0, duration: 0.2, level: 0.95, type: 'sine' },
    { frequency: 1318.5, offset: 0.11, duration: 0.25, level: 0.8, type: 'sine' },
    { frequency: 1568, offset: 0.22, duration: 0.32, level: 0.65, type: 'sine' },
  ],
}

function audioContextConstructor(): AudioContextConstructor | undefined {
  const browser = globalThis as BrowserGlobal
  // Retire the WebKit fallback once the supported Safari baseline exposes the standard constructor everywhere.
  return browser.AudioContext ?? browser.webkitAudioContext
}

function playNote(context: ToneContext, note: ToneNote, start: number, volume: number): void {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const noteStart = start + note.offset
  const noteEnd = noteStart + note.duration
  const peak = Math.max(0.0001, 0.35 * note.level * volume)
  oscillator.type = note.type
  oscillator.frequency.setValueAtTime(note.frequency, noteStart)
  gain.gain.setValueAtTime(0.0001, noteStart)
  gain.gain.exponentialRampToValueAtTime(peak, noteStart + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(noteStart)
  oscillator.stop(noteEnd)
}

/** Play one selected synthesized completion tone at the requested volume. */
function playChime(context: ToneContext, tone: CompletionSoundTone, volumePercent: number): void {
  const volume = Math.max(0, Math.min(100, volumePercent)) / 100
  const start = context.currentTime
  for (const note of TONE_PROFILES[tone]) playNote(context, note, start, volume)
}

/** Browser preferences for the completion notification sound. */
export class CompletionSoundPreference {
  /** Reactive enabled state consumed by the settings row and notifier. */
  readonly enabled: SnapshotStore<boolean> = createSnapshotStore(DEFAULT_COMPLETION_SOUND)
  /** Reactive selected tone consumed by the settings row and notifier. */
  readonly tone: SnapshotStore<CompletionSoundTone> = createSnapshotStore(DEFAULT_COMPLETION_SOUND_TONE)
  /** Reactive application-level volume percentage consumed by the settings row and notifier. */
  readonly volume: SnapshotStore<number> = createSnapshotStore(DEFAULT_COMPLETION_SOUND_VOLUME)
  private readonly host: ConfigForm<ConversationSettings> | undefined

  /**
   * @param host - durable conversation settings scope; absent compositions stay process-local.
   */
  constructor(host?: ConfigForm<ConversationSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change whether completed turns should play a notification.
   * @param enabled - whether the completion sound is enabled.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled.getSnapshot() === enabled) return
    this.enabled.set(enabled)
    void this.host?.set(COMPLETION_SOUND_FIELD, enabled)
  }

  /**
   * Change the selected tone and enable sound when a tone is selected.
   * @param selection - selected tone or the explicit off option.
   */
  setSelection(selection: CompletionSoundSelection): void {
    if (selection === 'off') {
      this.setEnabled(false)
      return
    }
    this.setTone(selection)
    this.setEnabled(true)
  }

  /**
   * Change the selected synthesized tone.
   * @param tone - synthesized tone identity.
   */
  setTone(tone: CompletionSoundTone): void {
    if (this.tone.getSnapshot() === tone) return
    this.tone.set(tone)
    void this.host?.set(COMPLETION_SOUND_TONE_FIELD, tone)
  }

  /**
   * Change and clamp the application-level volume percentage.
   * @param value - requested application volume from 0 to 100.
   */
  setVolume(value: number): void {
    const volume = Math.round(Math.max(0, Math.min(100, value)))
    if (this.volume.getSnapshot() === volume) return
    this.volume.set(volume)
    void this.host?.set(COMPLETION_SOUND_VOLUME_FIELD, volume)
  }

  private adopt(host: ConfigForm<ConversationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    if (this.enabled.getSnapshot() !== section.completionSound) {
      this.enabled.set(section.completionSound)
    }
    if (this.tone.getSnapshot() !== section.completionSoundTone) {
      this.tone.set(section.completionSoundTone)
    }
    if (this.volume.getSnapshot() !== section.completionSoundVolume) {
      this.volume.set(section.completionSoundVolume)
    }
  }
}

/**
 * Plays completion notifications from the runtime's structured completed-turn event.
 * Audio is created only from a user gesture or the explicit Preview action.
 */
export class CompletionSoundController {
  private audioContext: ToneContext | undefined
  private audioReady = false
  private pendingCompletion = false
  private stopListening: (() => void) | undefined

  private readonly onGesture = (): void => {
    const context = this.unlock()
    if (context === undefined) return
    void this.resume(context).then(() => { this.flushPending(context) }, (error: unknown) => { this.report(error) })
  }

  /**
   * @param enabled - completion-sound preference source.
   * @param tone - selected synthesized tone source.
   * @param volume - application-level volume percentage source.
   */
  constructor(
    private readonly enabled: ObservableSnapshot<boolean>,
    private readonly tone: ObservableSnapshot<CompletionSoundTone>,
    private readonly volume: ObservableSnapshot<number>,
  ) {}

  /**
   * Start observing the preference and browser gestures.
   * @returns disposer for the preference and gesture listeners.
   */
  start(): () => void {
    if (this.stopListening !== undefined) return this.stopListening
    const disposeEnabled = this.enabled.subscribe(() => {
      if (!this.enabled.getSnapshot()) this.pendingCompletion = false
    })
    const disposeGestures = this.listenForGestures()
    let stopped = false
    const stop = (): void => {
      if (stopped) return
      stopped = true
      disposeEnabled()
      disposeGestures()
      this.pendingCompletion = false
      this.audioReady = false
      const context = this.audioContext
      this.audioContext = undefined
      if (context !== undefined) {
        void context.close().catch((error: unknown) => { this.report(error) })
      }
      this.stopListening = undefined
    }
    this.stopListening = stop
    return stop
  }

  /** Notify the controller that the runtime observed a completed turn. */
  notifyCompleted(): void {
    if (!this.enabled.getSnapshot()) return
    const context = this.audioContext
    if (this.audioReady && context !== undefined && context.state === 'running') {
      this.playReady(context)
      return
    }
    this.pendingCompletion = true
  }

  /** Play a chime from an explicit user action, regardless of the preference. */
  preview(): void {
    const context = this.unlock()
    if (context === undefined) return
    void this.resume(context).then(() => {
      if (this.audioContext !== context || context.state !== 'running') return
      this.playReady(context)
    }, (error: unknown) => { this.report(error) })
  }

  private listenForGestures(): () => void {
    if (typeof document === 'undefined') return () => {}
    document.addEventListener('pointerdown', this.onGesture, { passive: true })
    document.addEventListener('keydown', this.onGesture)
    return () => {
      document.removeEventListener('pointerdown', this.onGesture)
      document.removeEventListener('keydown', this.onGesture)
    }
  }

  private flushPending(context: ToneContext): void {
    const enabled = this.enabled.getSnapshot()
    if (!this.pendingCompletion || !enabled) {
      if (!enabled) this.pendingCompletion = false
      return
    }
    this.pendingCompletion = false
    if (this.audioContext === context && context.state === 'running') this.playReady(context)
  }

  private unlock(): ToneContext | undefined {
    if (this.audioContext?.state === 'closed') this.audioContext = undefined
    if (this.audioContext === undefined) {
      const Constructor = audioContextConstructor()
      if (Constructor === undefined) return undefined
      try {
        this.audioContext = new Constructor()
      } catch (error) {
        this.report(error)
        return undefined
      }
    }
    this.audioReady = true
    return this.audioContext
  }

  private resume(context: ToneContext): Promise<void> {
    return context.state === 'suspended' ? context.resume() : Promise.resolve()
  }

  private playReady(context: ToneContext): void {
    try {
      playChime(context, this.tone.getSnapshot(), this.volume.getSnapshot())
    } catch (error) {
      this.report(error)
    }
  }

  private report(error: unknown): void {
    console.warn('[web-conversation] completion sound unavailable:', error)
  }
}

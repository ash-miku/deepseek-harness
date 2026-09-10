/** Busy-Enter preference stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the conversation plugin. */
export const CONVERSATION_SETTINGS_NAMESPACE = 'ui-conversation'

/** Field carrying the delivery mode for plain Enter while an agent is busy. */
export const BUSY_ENTER_FIELD = 'busyEnter'

/** Busy-Enter behaviors accepted at settings and input boundaries. */
export const BUSY_ENTER_BEHAVIORS = ['queue', 'steer'] as const

/** Configurable meaning of plain Enter while the addressed agent is busy. */
export type BusyEnterBehavior = typeof BUSY_ENTER_BEHAVIORS[number]

/** Default preserves Enter-as-Queue for running conversations. */
export const DEFAULT_BUSY_ENTER_BEHAVIOR: BusyEnterBehavior = 'queue'

/** Field carrying user-authored running-status labels, one per line. */
export const RUNNING_LABELS_FIELD = 'runningLabels'

/** Default preserves the current running label when no user labels are set. */
export const DEFAULT_RUNNING_LABELS = 'Deep diving...'

/** Field carrying whether a completion notification sound is enabled. */
export const COMPLETION_SOUND_FIELD = 'completionSound'

/** Field carrying the selected synthesized completion tone. */
export const COMPLETION_SOUND_TONE_FIELD = 'completionSoundTone'

/** Field carrying the application-level completion tone volume percentage. */
export const COMPLETION_SOUND_VOLUME_FIELD = 'completionSoundVolume'

/** Built-in synthesized completion tones. */
export const COMPLETION_SOUND_TONES = ['ding-dong', 'bell', 'chime'] as const

/** Completion tone identity. */
export type CompletionSoundTone = typeof COMPLETION_SOUND_TONES[number]

/** Completion notification sound is enabled by default. */
export const DEFAULT_COMPLETION_SOUND = true

/** Default completion tone. */
export const DEFAULT_COMPLETION_SOUND_TONE: CompletionSoundTone = 'ding-dong'

/** Default application-level completion tone volume percentage. */
export const DEFAULT_COMPLETION_SOUND_VOLUME = 80

/**
 * Parse newline-separated user labels, dropping blank lines.
 * @param value - newline-separated label input.
 * @returns non-empty trimmed labels.
 */
export function parseRunningLabels(value: string): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '')
}

/**
 * Normalize user labels for storage; blank input restores the default.
 * @param value - newline-separated label input.
 * @returns normalized stored label text.
 */
export function normalizeRunningLabels(value: string): string {
  const labels = parseRunningLabels(value)
  return labels.length === 0 ? DEFAULT_RUNNING_LABELS : labels.join('\n')
}

/** Durable conversation section shared by the Host schema and the browser scope. */
export interface ConversationSettings {
  /** Delivery mode for plain Enter while the addressed agent is busy. */
  busyEnter: BusyEnterBehavior
  /** Newline-separated labels shown while the agent is running. */
  runningLabels: string
  /** Whether a browser sound plays after a completed turn. */
  completionSound: boolean
  /** Synthesized tone selected for completion notifications. */
  completionSoundTone: CompletionSoundTone
  /** Application-level completion tone volume percentage. */
  completionSoundVolume: number
}

/** Durable conversation schema; also the wire envelope the browser scope validates against. */
export const ConversationSettingsSchema: z<ConversationSettings> = z.object({
  [BUSY_ENTER_FIELD]: z.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR),
  [RUNNING_LABELS_FIELD]: z.string().default(DEFAULT_RUNNING_LABELS),
  [COMPLETION_SOUND_FIELD]: z.boolean().default(DEFAULT_COMPLETION_SOUND),
  [COMPLETION_SOUND_TONE_FIELD]: z.union([...COMPLETION_SOUND_TONES]).default(DEFAULT_COMPLETION_SOUND_TONE),
  [COMPLETION_SOUND_VOLUME_FIELD]: z.number().step(1).min(0).max(100).default(DEFAULT_COMPLETION_SOUND_VOLUME),
})

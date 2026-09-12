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

/** Durable conversation section shared by the Host schema and the browser scope. */
export interface ConversationSettings {
  /** Delivery mode for plain Enter while the addressed agent is busy. */
  busyEnter: BusyEnterBehavior
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
  [COMPLETION_SOUND_FIELD]: z.boolean().default(DEFAULT_COMPLETION_SOUND),
  [COMPLETION_SOUND_TONE_FIELD]: z.union([...COMPLETION_SOUND_TONES]).default(DEFAULT_COMPLETION_SOUND_TONE),
  [COMPLETION_SOUND_VOLUME_FIELD]: z.number().step(1).min(0).max(100).default(DEFAULT_COMPLETION_SOUND_VOLUME),
})

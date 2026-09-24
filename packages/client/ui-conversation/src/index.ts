/** Host registration for browser conversation preferences. */
import type {} from '@deepseek-ai/dsh-settings'

import type { Volatile, Context } from '@deepseek-ai/cordis'
import type { BusyEnterBehavior, CompletionSoundTone } from './submission-settings.ts'
import z from '@deepseek-ai/schemastery'
import {
  BUSY_ENTER_FIELD, COMPLETION_SOUND_FIELD, COMPLETION_SOUND_TONE_FIELD, COMPLETION_SOUND_VOLUME_FIELD,
} from './submission-settings.ts'

import { ConversationSettingsFields } from './submission-settings.ts'

export {
  BUSY_ENTER_BEHAVIORS, BUSY_ENTER_FIELD, COMPLETION_SOUND_FIELD, COMPLETION_SOUND_TONE_FIELD,
  COMPLETION_SOUND_TONES, COMPLETION_SOUND_VOLUME_FIELD, CONVERSATION_SETTINGS_NAMESPACE,
  DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_COMPLETION_SOUND, DEFAULT_COMPLETION_SOUND_TONE,
  DEFAULT_COMPLETION_SOUND_VOLUME,
  type BusyEnterBehavior, type CompletionSoundTone,
  type ConversationSettings,
} from './submission-settings.ts'

/** Runtime preferences projected to the browser. */
export interface Config {
  /** Enter key behavior while a turn is running. */
  busyEnter: Volatile<BusyEnterBehavior>
  /** Whether a browser sound plays after a completed turn. */
  completionSound: Volatile<boolean>
  /** Synthesized tone selected for completion notifications. */
  completionSoundTone: Volatile<CompletionSoundTone>
  /** Application-level completion tone volume percentage. */
  completionSoundVolume: Volatile<number>
}

/** Live preferences projected to the browser. */
export const Config = z.object({
  [BUSY_ENTER_FIELD]: ConversationSettingsFields[BUSY_ENTER_FIELD].volatile(),
  [COMPLETION_SOUND_FIELD]: ConversationSettingsFields[COMPLETION_SOUND_FIELD].volatile(),
  [COMPLETION_SOUND_TONE_FIELD]: ConversationSettingsFields[COMPLETION_SOUND_TONE_FIELD].volatile(),
  [COMPLETION_SOUND_VOLUME_FIELD]: ConversationSettingsFields[COMPLETION_SOUND_VOLUME_FIELD].volatile(),
})

/** Host preferences are consumed through the configuration form projection.
 * @param ctx Plugin context used for optional settings presentation.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (child) => { child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)) })
}

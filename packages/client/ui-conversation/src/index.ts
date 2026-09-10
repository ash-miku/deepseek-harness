/** Host registration for browser conversation preferences. */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-settings'
import { CONVERSATION_SETTINGS_NAMESPACE, ConversationSettingsSchema } from './submission-settings.ts'

export {
  BUSY_ENTER_BEHAVIORS, BUSY_ENTER_FIELD, COMPLETION_SOUND_FIELD, COMPLETION_SOUND_TONE_FIELD,
  COMPLETION_SOUND_TONES, COMPLETION_SOUND_VOLUME_FIELD, CONVERSATION_SETTINGS_NAMESPACE,
  DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_COMPLETION_SOUND, DEFAULT_COMPLETION_SOUND_TONE,
  DEFAULT_COMPLETION_SOUND_VOLUME, DEFAULT_RUNNING_LABELS, RUNNING_LABELS_FIELD,
  type BusyEnterBehavior, type CompletionSoundTone,
  type ConversationSettings,
} from './submission-settings.ts'

/**
 * Register the durable conversation section when a settings provider exists.
 * @param ctx - Host context whose optional settings service owns the section.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      CONVERSATION_SETTINGS_NAMESPACE,
      ConversationSettingsSchema,
    )
  })
}

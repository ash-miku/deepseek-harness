/** Host registration for browser conversation preferences. */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { CONVERSATION_SETTINGS_NAMESPACE, ConversationSettingsSchema } from './submission-settings.ts'

export {
  BUSY_ENTER_BEHAVIORS, BUSY_ENTER_FIELD, CONVERSATION_SETTINGS_NAMESPACE,
  DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_PROCESS_DISPLAY_MODE, DEFAULT_RUNNING_LABELS,
  PROCESS_DISPLAY_FIELD, PROCESS_DISPLAY_MODES, RUNNING_LABELS_FIELD,
  type BusyEnterBehavior, type ConversationProcessDisplayMode,
  type ConversationSettings,
} from './submission-settings.ts'

/**
 * Register the durable conversation section when a settings provider exists.
 * @param ctx - Host context whose optional settings service owns the section.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(CONVERSATION_SETTINGS_NAMESPACE),
      ConversationSettingsSchema,
    )
  })
}

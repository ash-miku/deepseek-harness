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

/** Field carrying how much assistant process detail the chat renders. */
export const PROCESS_DISPLAY_FIELD = 'processDisplay'

/** Field carrying user-authored running-status labels, one per line. */
export const RUNNING_LABELS_FIELD = 'runningLabels'

/** Default preserves the current running label when no user labels are set. */
export const DEFAULT_RUNNING_LABELS = 'Deep diving...'

/** Parse newline-separated user labels, dropping blank lines. */
export function parseRunningLabels(value: string): string[] {
  return value.split(/\r?\n/).map(line => line.trim()).filter(line => line !== '')
}

/** Normalize user labels for storage; blank input restores the default. */
export function normalizeRunningLabels(value: string): string {
  const labels = parseRunningLabels(value)
  return labels.length === 0 ? DEFAULT_RUNNING_LABELS : labels.join('\n')
}

/** Process display modes accepted at settings and render boundaries. */
export const PROCESS_DISPLAY_MODES = ['full', 'fold', 'conclusion'] as const

/** Configurable density of thinking summaries and tool-call rows. */
export type ConversationProcessDisplayMode = typeof PROCESS_DISPLAY_MODES[number]

/** Default preserves the current full process rendering. */
export const DEFAULT_PROCESS_DISPLAY_MODE: ConversationProcessDisplayMode = 'full'

/** Durable conversation section shared by the Host schema and the browser scope. */
export interface ConversationSettings {
  /** Delivery mode for plain Enter while the addressed agent is busy. */
  busyEnter: BusyEnterBehavior
  /** Density of thinking summaries and tool-call rows in the chat flow. */
  processDisplay: ConversationProcessDisplayMode
  /** Newline-separated labels shown while the agent is running. */
  runningLabels: string
}

/** Durable conversation schema; also the wire envelope the browser scope validates against. */
export const ConversationSettingsSchema: z<ConversationSettings> = z.object({
  [BUSY_ENTER_FIELD]: z.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR),
  [PROCESS_DISPLAY_FIELD]: z.union([...PROCESS_DISPLAY_MODES]).default(DEFAULT_PROCESS_DISPLAY_MODE),
  [RUNNING_LABELS_FIELD]: z.string().default(DEFAULT_RUNNING_LABELS),
})

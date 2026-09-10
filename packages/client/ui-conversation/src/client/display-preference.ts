/**
 * Conversation display preferences. It owns the live running-status labels
 * shared by the Settings row and the Chat view, and mirrors writes to the
 * durable Host settings scope.
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  DEFAULT_RUNNING_LABELS, normalizeRunningLabels, RUNNING_LABELS_FIELD,
} from '../submission-settings.ts'
import type { ConversationSettings } from '../submission-settings.ts'

/**
 * Reactive running-status labels used by both the Settings row and the Chat
 * view. The completed-Turn transcript density is upstream's own
 * `transcriptView` setting in ui-chat, so nothing here mirrors it.
 */
export class ConversationDisplayPreference {
  /** Reactive newline-separated labels: the Settings row's editing surface. */
  readonly runningLabels: SnapshotStore<string> = createSnapshotStore(DEFAULT_RUNNING_LABELS)
  private readonly host: SettingsScope<ConversationSettings> | undefined

  /**
   * @param host - durable preference scope owned by the providing plugin;
   * absent compositions stay process-local.
   */
  constructor(host?: SettingsScope<ConversationSettings>) {
    this.host = host
    if (host !== undefined) {
      host.subscribe(() => { this.adopt(host) })
      this.adopt(host)
    }
  }

  /**
   * Change the running-status labels; the live value publishes before the
   * durable write starts.
   * @param labels - newline-separated labels; blank restores the default.
   */
  setRunningLabels(labels: string): void {
    const normalized = normalizeRunningLabels(labels)
    if (this.runningLabels.getSnapshot() === normalized) return
    this.runningLabels.set(normalized)
    void this.host?.set(RUNNING_LABELS_FIELD, normalized)
  }

  /** Adopt the latest accepted Host section without writing it back. */
  private adopt(host: SettingsScope<ConversationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    const labels = normalizeRunningLabels(section.runningLabels)
    if (this.runningLabels.getSnapshot() !== labels) this.runningLabels.set(labels)
  }
}

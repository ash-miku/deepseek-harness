/**
 * Conversation display preferences. It owns the live process-density mode and
 * running-status labels, and mirrors writes to the durable Host settings scope.
 */
import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSettings } from '../submission-settings.ts'
import {
  DEFAULT_PROCESS_DISPLAY_MODE, DEFAULT_RUNNING_LABELS, normalizeRunningLabels,
  PROCESS_DISPLAY_FIELD, RUNNING_LABELS_FIELD,
  type ConversationProcessDisplayMode,
} from '../submission-settings.ts'

/**
 * Reactive process-display preference used by both the Settings row and the
 * chat renderers.
 */
export class ConversationDisplayPreference {
  /** Reactive preference source for the Settings row and chat renderers. */
  readonly displayMode: SnapshotStore<ConversationProcessDisplayMode> =
    createSnapshotStore(DEFAULT_PROCESS_DISPLAY_MODE)
  /** Reactive newline-separated running labels shared by the Settings row and chat. */
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
   * Change the chat process density; the live value publishes before the
   * durable write starts.
   * @param mode - Full, folded, or conclusion-only rendering.
   */
  setDisplayMode(mode: ConversationProcessDisplayMode): void {
    if (this.displayMode.getSnapshot() === mode) return
    this.displayMode.set(mode)
    void this.host?.set(PROCESS_DISPLAY_FIELD, mode)
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

  private adopt(host: SettingsScope<ConversationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined) return
    if (this.displayMode.getSnapshot() !== section.processDisplay) {
      this.displayMode.set(section.processDisplay)
    }
    const labels = normalizeRunningLabels(section.runningLabels)
    if (this.runningLabels.getSnapshot() !== labels) {
      this.runningLabels.set(labels)
    }
  }
}

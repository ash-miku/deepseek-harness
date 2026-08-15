/**
 * Conversation process-display preference. It owns the live density mode and
 * mirrors writes to the durable Host settings scope.
 */
import {
  createSnapshotStore, type SettingsScope, type SnapshotStore,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSettings } from '../submission-settings.ts'
import {
  DEFAULT_PROCESS_DISPLAY_MODE, PROCESS_DISPLAY_FIELD,
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

  private adopt(host: SettingsScope<ConversationSettings>): void {
    const section = host.getSnapshot().value
    if (section === undefined || this.displayMode.getSnapshot() === section.processDisplay) return
    this.displayMode.set(section.processDisplay)
  }
}

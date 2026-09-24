/** One accepted preference drives every developer-tool consumer. */
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { DeveloperToolsSettings } from '../developer-tools-settings.ts'
import type { ConfigForm } from './config-form-types.ts'

/** Shared preference; Host-backed features stay disabled until an accepted value arrives. */
export class DeveloperToolsPreference {
  /** Accepted enablement, observable through renderer-bound hooks. */
  readonly enabled: ObservableSnapshot<boolean>
  private readonly local = createSnapshotStore(true)
  private readonly store = createSnapshotStore(false)

  /**
   * A trust-fence refusal downgrades the scope to process-local memory after
   * this preference is built, so the published value follows the current mode
   * instead of binding whichever mode the scope started in.
   * @param scope - settings-owned namespace controller.
   */
  constructor(private readonly scope: ConfigForm<DeveloperToolsSettings>) {
    this.enabled = this.store
    this.store.set(this.read())
    scope.subscribe(() => { this.store.set(this.read()) })
  }

  /**
   * Persist a Host choice with ordered writes, or update the shared browser-local choice.
   * @param enabled - requested developer-tool mode.
   * @returns settlement after local publication or Host acceptance; rejects after a refused write recovers.
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (this.scope.getSnapshot().mode === 'memory') {
      this.local.set(enabled)
      this.store.set(this.read())
      return
    }
    if (!await this.scope.set('enabled', enabled)) throw new Error('Developer tools preference was not saved')
  }

  /** @returns the enablement owned by the scope's current persistence mode. */
  private read(): boolean {
    const snapshot = this.scope.getSnapshot()
    return snapshot.mode === 'memory' ? this.local.getSnapshot() : snapshot.value?.enabled ?? false
  }
}

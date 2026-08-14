/**
 * BalanceController: owns the DeepSeek account-balance reading for the sidebar
 * surface. One instance per plugin fiber; it polls the host on mount and on a
 * fixed interval, and exposes a HostObservable snapshot the slot renderer
 * binds to a selector hook.
 */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { DeepseekBalanceView, IApiClient } from '@deepseek-ai/dsh-api-remotes/client'

/** Poll interval for the balance reading (the host caches for 5 minutes). */
const POLL_INTERVAL_MS = 60_000

/** Snapshot shape the surface reads. */
export interface BalanceState {
  /** Lifecycle: idle before the first read, loading during one, then ready/error. */
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** The last successful reading (present when status is ready). */
  balance?: DeepseekBalanceView
  /** The last failure's message (present when status is error). */
  error?: string
}

/** One balance surface controller. */
export class BalanceController implements HostObservable<BalanceState> {
  private state: BalanceState = { status: 'idle' }
  private readonly listeners = new Set<() => void>()
  private timer: ReturnType<typeof setInterval> | undefined
  private disposed = false

  constructor(private readonly api: IApiClient['deepseek']) {}

  getSnapshot(): BalanceState {
    return this.state
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  /** Start polling: an immediate read, then a fixed-interval refresh. */
  start(): void {
    if (this.disposed) return
    void this.refresh()
    this.timer = setInterval(() => { void this.refresh() }, POLL_INTERVAL_MS)
  }

  /** Read the balance; `force` bypasses the host cache. */
  async refresh(force = false): Promise<void> {
    if (this.disposed) return
    if (this.state.status === 'loading') return
    this.setState({ status: 'loading' })
    try {
      const response = await this.api.balance({ force })
      if (response.result.ok) {
        this.setState({ status: 'ready', balance: response.result.value.balance })
      } else {
        this.setState({ status: 'error', error: response.result.error.message })
      }
    } catch (error: unknown) {
      this.setState({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.timer !== undefined) clearInterval(this.timer)
    this.listeners.clear()
  }

  private setState(next: Partial<BalanceState>): void {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
  }
}

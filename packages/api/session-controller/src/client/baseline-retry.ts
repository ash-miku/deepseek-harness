/** Shared backoff policy for initial Web data baselines. */
const BASELINE_RETRY_INITIAL_DELAY_MS = 250
const BASELINE_RETRY_MAX_DELAY_MS = 5_000

/**
 * Return the delay before the next baseline pull after a transient failure.
 * @param attempt - Number of retries already scheduled for this connection.
 * @returns a bounded exponential delay in milliseconds.
 */
export function baselineRetryDelay(attempt: number): number {
  return Math.min(BASELINE_RETRY_MAX_DELAY_MS, BASELINE_RETRY_INITIAL_DELAY_MS * 2 ** Math.min(attempt, 4))
}

/**
 * Retry driver for one unary Web baseline pull (`session.list`,
 * `workspace.list`-shaped pulls).
 *
 * A baseline pull is an ordinary unary Remote call, so it sits outside the
 * reconnecting stream supervisor that owns retry timing for the push streams:
 * a transient failure while the connection generation is still usable would
 * otherwise leave the domain in a permanent error state with no second attempt.
 * This driver closes that gap with the shared backoff policy while keeping the
 * same ownership split — the connection owns whether a retry may happen at all
 * ({@link setActive}), and the domain owns what a retry pulls.
 *
 * The driver is inert until a connection generation has been observed: a pull
 * that fails before the first `connection/reset` must not schedule work against
 * a connection that was never up.
 */
export class BaselineRetry {
  private active = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0

  /** @param pull - the baseline pull to repeat; its own single-flight guard coalesces overlap. */
  constructor(private readonly pull: () => void) {}

  /**
   * Adopt one connection generation: allow retries and restart the backoff.
   * A fresh generator begins a fresh failure budget, so the first retry of a
   * new connection is immediate-ish rather than inheriting an exhausted delay.
   */
  connect(): void {
    this.active = true
    this.reset()
  }

  /** Lose the connection generation: stop retrying and forget the backoff. */
  disconnect(): void {
    this.active = false
    this.reset()
  }

  /**
   * Schedule the next attempt after a failed pull, if one is both allowed and
   * wanted. Callers decide whether the failure is retryable — a baseline that
   * already arrived is never re-pulled on its own.
   * @returns whether an attempt was scheduled.
   */
  schedule(): boolean {
    if (!this.active || this.timer !== null) return false
    const delay = baselineRetryDelay(this.attempt)
    this.attempt += 1
    this.timer = setTimeout(() => {
      this.timer = null
      this.pull()
    }, delay)
    return true
  }

  /**
   * Cancel a pending attempt without touching the failure budget. A fresh pull
   * supersedes the queued retry but must not restart the backoff, or a
   * repeatedly failing baseline would retry at the base delay forever.
   */
  cancel(): void {
    if (this.timer === null) return
    clearTimeout(this.timer)
    this.timer = null
  }

  /**
   * Cancel a pending attempt and clear the failure budget. Called whenever the
   * connection generation itself changes (adopted or lost), where the next
   * failure deserves a fresh budget.
   */
  reset(): void {
    this.attempt = 0
    this.cancel()
  }
}

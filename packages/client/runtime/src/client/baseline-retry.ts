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

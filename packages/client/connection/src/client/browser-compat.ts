/**
 * Browser platform shims for engines that predate the APIs the client assumes.
 *
 * The plugins call `AbortSignal.any` and `Promise.withResolvers` directly over
 * their shared transport. Engines that predate them (Chrome 116 and 119,
 * Safari 17.4) throw `TypeError: ... is not a function` mid-connection, close
 * the socket, and drive the recovery loop into endless reconnects. Install the
 * small, spec-shaped fallbacks once at the connection entry, before any bundle
 * can use them.
 */

/** Deferred pair returned by {@link promiseWithResolvers}. */
export interface PromiseResolvers<T> {
  readonly promise: Promise<T>
  readonly resolve: (value: T | PromiseLike<T>) => void
  readonly reject: (reason?: unknown) => void
}

/**
 * Combine cancellation signals into one, mirroring the native first-abort
 * behavior: the result aborts with the first aborted input's reason, and every
 * listener is removed as soon as it settles.
 * @param signals - input signals, in priority order.
 * @returns a signal that aborts when any input does.
 */
export function combineAbortSignals(signals: Iterable<AbortSignal>): AbortSignal {
  const controller = new AbortController()
  const listeners: Array<{ signal: AbortSignal; listener: () => void }> = []
  const cleanup = (): void => {
    for (const { signal, listener } of listeners) signal.removeEventListener('abort', listener)
    listeners.length = 0
  }
  const abort = (signal: AbortSignal): void => {
    if (controller.signal.aborted) return
    cleanup()
    controller.abort(signal.reason)
  }
  for (const signal of signals) {
    if (signal.aborted) {
      abort(signal)
      break
    }
    const listener = (): void => { abort(signal) }
    listeners.push({ signal, listener })
    signal.addEventListener('abort', listener, { once: true })
  }
  return controller.signal
}

/**
 * Create a promise with its settle functions extracted, mirroring the native
 * `Promise.withResolvers`.
 * @returns the pending promise and its settle functions.
 */
export function promiseWithResolvers<T>(): PromiseResolvers<T> {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function installAbortSignalAny(): void {
  if (typeof AbortSignal.any === 'function') return
  AbortSignal.any = combineAbortSignals
}

function installPromiseWithResolvers(): void {
  if (typeof Promise.withResolvers === 'function') return
  Promise.withResolvers = promiseWithResolvers
}

/** Define every modern platform method this client assumes that the engine lacks. Idempotent. */
export function installBrowserCompat(): void {
  installAbortSignalAny()
  installPromiseWithResolvers()
}

/** Browser platform shims installed by the connection client entry. */
import { afterEach, describe, expect, it } from 'vitest'
import { combineAbortSignals, installBrowserCompat, promiseWithResolvers } from '../src/client/browser-compat.ts'

const nativeAny = Reflect.get(AbortSignal, 'any') as typeof AbortSignal.any | undefined
const nativeWithResolvers = Reflect.get(Promise, 'withResolvers') as typeof Promise.withResolvers | undefined

afterEach(() => {
  Reflect.set(AbortSignal, 'any', nativeAny)
  Reflect.set(Promise, 'withResolvers', nativeWithResolvers)
})

describe('combineAbortSignals', () => {
  it('aborts with the first input reason and ignores later aborts', () => {
    const first = new AbortController()
    const second = new AbortController()
    const combined = combineAbortSignals([first.signal, second.signal])
    expect(combined.aborted).toBe(false)
    first.abort(new Error('first'))
    expect(combined.aborted).toBe(true)
    expect((combined.reason as Error).message).toBe('first')
    second.abort(new Error('second'))
    expect((combined.reason as Error).message).toBe('first')
  })

  it('adopts an already-aborted input immediately', () => {
    const controller = new AbortController()
    controller.abort(new Error('already'))
    const combined = combineAbortSignals([controller.signal])
    expect(combined.aborted).toBe(true)
    expect((combined.reason as Error).message).toBe('already')
  })
})

describe('promiseWithResolvers', () => {
  it('exposes the pending promise and both settle functions', async () => {
    const resolved = promiseWithResolvers<number>()
    resolved.resolve(7)
    await expect(resolved.promise).resolves.toBe(7)
    const rejected = promiseWithResolvers<number>()
    rejected.reject(new Error('nope'))
    await expect(rejected.promise).rejects.toThrow('nope')
  })
})

describe('installBrowserCompat', () => {
  it('defines missing methods and leaves present implementations alone', () => {
    // Simulate an engine that predates both methods.
    Reflect.set(AbortSignal, 'any', undefined)
    Reflect.set(Promise, 'withResolvers', undefined)
    installBrowserCompat()
    expect(typeof AbortSignal.any).toBe('function')
    expect(typeof Promise.withResolvers).toBe('function')

    let called = false
    const replacement = (): AbortSignal => {
      called = true
      return new AbortController().signal
    }
    Reflect.set(AbortSignal, 'any', replacement)
    installBrowserCompat()
    AbortSignal.any([new AbortController().signal])
    expect(called).toBe(true)
  })
})

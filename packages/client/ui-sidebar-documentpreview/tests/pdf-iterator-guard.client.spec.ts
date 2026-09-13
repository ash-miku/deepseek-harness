/**
 * Regression: PDF.js probes `Iterator.prototype.join` by dereferencing the
 * `Iterator` global, which throws `ReferenceError: Iterator is not defined` on
 * engines without the ES2025 iterator helpers (older mobile Safari and Chrome).
 * That throw aborted the whole client bundle at import time ("failed to import
 * loader entry ..."), so this suite executes the shipped bundle's factory in a
 * realm where `Iterator` does not exist.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const bundlePath = join(resolve(import.meta.dirname, '..'), 'lib/client.js')

/** A module-table stub: any export resolves to a callable, so module init can proceed. */
function moduleStub(): unknown {
  const callable = function stub(): unknown {
    return callable
  }
  return new Proxy(callable, {
    get: (_target: unknown, property: string | symbol) => (property === 'then' ? undefined : callable),
    apply: () => callable,
    construct: () => ({}),
  })
}

/** React's module-init surface, beyond the callable stub. */
function reactStub(): Record<string, unknown> {
  return {
    Children: { map: () => [], toArray: () => [] },
    Fragment: {},
    StrictMode: {},
    cloneElement: (element: unknown) => element,
    createContext: () => ({}),
    createElement: () => ({}),
    forwardRef: (value: unknown) => value,
    isValidElement: () => false,
    memo: (value: unknown) => value,
    useCallback: (value: unknown) => value,
    useContext: () => ({}),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useMemo: (factory: () => unknown) => factory(),
    useReducer: (_reducer: unknown, initial: unknown) => [initial, () => {}],
    useRef: (initial: unknown) => ({ current: initial }),
    useState: (initial: unknown) => [typeof initial === 'function' ? (initial as () => unknown)() : initial, () => {}],
    useSyncExternalStore: () => () => {},
  }
}

/**
 * Run the bundle's registered factory once in a fresh realm whose `Iterator`
 * global is deleted.
 * @param source - the client bundle text.
 * @returns whatever the factory threw, or undefined when it completed.
 */
function loadBundleWithoutIterator(source: string): unknown {
  const requireStub = (id: string): unknown => {
    if (id === 'react') return reactStub()
    if (id === 'react-dom' || id === 'react-dom/client') {
      return { createRoot: () => ({ render: () => {}, unmount: () => {} }), flushSync: (fn: () => void) => { fn() } }
    }
    return moduleStub()
  }

  let thrown: unknown
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    document: {
      body: { appendChild: () => {} },
      createElement: () => ({
        dataset: {},
        setAttribute: () => {},
        style: { setProperty: () => {} },
        appendChild: () => {},
      }),
      documentElement: { style: { setProperty: () => {} } },
      head: { appendChild: () => {} },
      querySelector: () => ({}),
    },
    localStorage: { getItem: () => null, removeItem: () => {}, setItem: () => {} },
    location: { href: 'http://localhost/', origin: 'http://localhost' },
    navigator: { language: 'en', userAgent: 'node' },
    __ModuleLoader__: {
      load: ({ factory }: { factory: (require: (id: string) => unknown) => unknown }) => {
        try {
          factory(requireStub)
        } catch (error) {
          thrown = error
        }
      },
    },
  }
  sandbox.window = sandbox
  sandbox.self = sandbox
  createContext(sandbox)
  runInContext('delete globalThis.Iterator', sandbox)
  runInContext(source, sandbox, { filename: 'client.js' })
  return thrown
}

describe('PDF.js iterator-helper guard', () => {
  it.skipIf(!existsSync(bundlePath))('loads the client bundle without the Iterator global', () => {
    const error = loadBundleWithoutIterator(readFileSync(bundlePath, 'utf8'))
    expect(error).toBeUndefined()
  })
})

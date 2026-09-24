/**
 * Regression: PDF.js probes `Iterator.prototype.join` by dereferencing the
 * `Iterator` global, which throws `ReferenceError: Iterator is not defined` on
 * engines without the ES2025 iterator helpers (older mobile Safari and Chrome).
 * The PDF runtime is lazy-loaded as the `lib/client.pdf.js` chunk, so this
 * suite executes the shipped entry and chunk factories in a realm where
 * `Iterator` does not exist.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it } from 'vitest'

const packageRoot = resolve(import.meta.dirname, '..')
const entryPath = join(packageRoot, 'lib/client.js')
const pdfChunkPath = join(packageRoot, 'lib/client.pdf.js')

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
    lazy: () => ({}),
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
 * Run one registered factory in a fresh realm whose `Iterator` global is
 * deleted.
 * @param source - client artifact text registering through `__ModuleLoader__.load`.
 * @returns whatever the factory threw, or undefined when it completed.
 */
function loadWithoutIterator(source: string): unknown {
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
  it('probe realm genuinely lacks the Iterator global', () => {
    // Negative control: an unguarded probe raises here, so a guarded artifact
    // completing this realm proves the rewrite, not a present global.
    const error = loadWithoutIterator(
      'window.__ModuleLoader__.load({ id: "probe", factory: () => typeof Iterator.prototype.join !== "function" })',
    )
    expect(error).toBeDefined()
    expect((error as Error).name).toBe('ReferenceError')
    expect((error as Error).message).toContain('Iterator')
  })

  it.skipIf(!existsSync(entryPath))('loads the startup bundle without the Iterator global', () => {
    const error = loadWithoutIterator(readFileSync(entryPath, 'utf8'))
    expect(error).toBeUndefined()
  })

  it.skipIf(!existsSync(pdfChunkPath))('loads the lazy PDF chunk without the Iterator global', () => {
    const pdf = readFileSync(pdfChunkPath, 'utf8')
    // The chunk must carry the PDF.js runtime the guard rewrites; otherwise the
    // realm check below would pass without exercising the probe.
    expect(pdf).toContain('Iterator.prototype.join')
    const error = loadWithoutIterator(pdf)
    expect(error).toBeUndefined()
  })
})

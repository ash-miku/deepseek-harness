import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { UserConfig } from 'tsdown'
import { clientBundle } from '../tsdown.client.ts'

const bundle = clientBundle('@deepseek-ai/dsh-client-ui-sidebar-documentpreview', ['lib/types/index.js'])
const require = createRequire(import.meta.url)
const workerSpecifier = 'pdfjs-dist/build/pdf.worker.min.mjs?raw'
const workerModule = '\0dsh-pdf-worker.mjs'

/** License files for PDF.js and the data embedded beside its runtime. */
function pdfLicenseFiles(root: string): string[] {
  return ['LICENSE', ...['cmaps', 'standard_fonts', 'wasm'].flatMap(directory =>
    readdirSync(join(root, directory)).filter(name => name.startsWith('LICENSE')).sort()
      .map(name => `${directory}/${name}`),
  )]
}

/** Keep every bundled PDF.js license visible in the published client artifact. */
function pdfLicenseBanner(): string {
  const root = dirname(require.resolve('pdfjs-dist/package.json'))
  const notice = pdfLicenseFiles(root).map(name =>
    `${name}\n\n${readFileSync(join(root, name), 'utf8').trimEnd()}`,
  ).join('\n\n')
  return ['//! Bundled PDF.js license notices', ...notice.split('\n').map(line => `// ${line}`)].join('\n')
}

/** Keep font mappings and image decoders in the same artifact as their PDF.js runtime. */
function pdfAssets(): string {
  const root = dirname(require.resolve('pdfjs-dist/package.json'))
  return JSON.stringify(Object.fromEntries([
    ['cMapUrl', 'cmaps'], ['standardFontDataUrl', 'standard_fonts'], ['wasmUrl', 'wasm'],
  ].map(([kind, directory]) => [kind, Object.fromEntries(
    readdirSync(join(root, directory!)).filter(name => !name.startsWith('LICENSE')).sort()
      .map(name => [name, readFileSync(join(root, directory!, name)).toString('base64')]),
  )])))
}

/**
 * PDF.js 6.3.289 probes its `Iterator.prototype.join` polyfill with
 * `typeof Iterator.prototype.join`, which dereferences the `Iterator` global.
 * Engines without the ES2025 iterator helpers (older mobile Safari and Chrome)
 * have no such global, so that probe throws `ReferenceError: Iterator is not
 * defined` while the client bundle initializes, surfacing as "failed to import
 * loader entry ...". Guard the dereference on the runtime and the embedded
 * worker, keeping the polyfill on engines that do have `Iterator`.
 */
const PDF_ITERATOR_PROBE = /(?:typeof Iterator\.prototype\.join\s*!==?\s*"function"|"function"\s*!==?\s*typeof Iterator\.prototype\.join)/g

/** Rewrite PDF.js's unsafe iterator-helper probe. @throws when the pinned PDF.js no longer carries it. */
function guardPdfIteratorProbe(source: string, origin: string): string {
  if ((source.match(PDF_ITERATOR_PROBE) ?? []).length === 0) {
    throw new Error(
      `pdf iterator guard: ${origin} does not contain PDF.js's iterator-helper probe; `
      + 're-check the guard against the pinned pdfjs-dist',
    )
  }
  return source.replace(PDF_ITERATOR_PROBE, probe => `typeof Iterator !== "undefined" && (${probe})`)
}

/** PDF.js main runtime module, whose top-level probe runs while the client bundle initializes. */
const pdfRuntimeModule = /[/\\]pdfjs-dist[/\\]build[/\\]pdf\.mjs$/

/** The dynamic client factory has no module URL from which to resolve a Worker file. */
const pdfWorker: NonNullable<UserConfig['plugins']> = [{
  name: 'dsh-pdf-worker-source',
  resolveId(source) {
    return source === workerSpecifier ? workerModule : null
  },
  load(id) {
    if (id !== workerModule) return null
    const path = require.resolve('pdfjs-dist/build/pdf.worker.min.mjs')
    this.addWatchFile(path)
    return `export default ${JSON.stringify(guardPdfIteratorProbe(readFileSync(path, 'utf8'), path))};`
  },
}]

/** Guard the main PDF.js runtime probe, which is inlined as an ordinary module. */
const pdfIteratorGuard: NonNullable<UserConfig['plugins']> = [{
  name: 'dsh-pdf-iterator-guard',
  transform(code, id) {
    if (!pdfRuntimeModule.test(id)) return null
    return { code: guardPdfIteratorProbe(code, id), map: null }
  },
}]

export default (options: Parameters<typeof bundle>[0]): UserConfig[] => bundle(options).map(config =>
  config.name?.endsWith('/client') === true ? {
    ...config,
    banner: pdfLicenseBanner(),
    plugins: [config.plugins, pdfWorker, pdfIteratorGuard],
    define: { ...config.define, __DSH_PDFJS_ASSETS__: pdfAssets() },
  } : config,
)

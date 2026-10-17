/**
 * @deepseek-ai/dsh-web-app — the browser-surface bundle's runtime glue plugin
 * plus the bundle patch (`cordis.patch.yml`, declared by the `dsh.bundle.patch`
 * manifest field). The plugin owns the browser-surface glue: it resolves
 * the built frontend dist (workspace knowledge of this bundle, never user
 * config), mounts the `frontend-static` fallback owner over it, registers the
 * bash-visible web runtime variable, the process-token URL line, and the
 * default-browser handoff, and provides the `webApp` service. An advertised
 * `publicUrl` replaces the published bind-address URL, and a bind on every
 * interface also publishes one tokenized URL per LAN address. The plugin also
 * provides the bind-dependent `webRuntime` trust snapshot the connection row
 * injects. Non-loopback HTTP binds trigger an exposure warning. App
 * command-line values arrive through the `webStartup` service expressions in
 * the bundle patch.
 * @module @deepseek-ai/dsh-web-app
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { auditStartupEntries } from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-client-connection'
import * as FrontendStatic from '@deepseek-ai/dsh-host-frontend-static'
import { bindUrlHost, isLoopbackHost, isWildcardHost } from '@deepseek-ai/dsh-host-webserver'
import { launchedThroughSsh, launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-shell-env'
import { parsePublicUrl } from './public-url.ts'

/** The Web GUI this process serves, provided by the `web-runtime` row. */
export interface WebApp {
  /**
   * The URL this GUI advertises, also used for `DSH_WEB_URL` and the startup URL line.
   * @returns the configured `publicUrl`, otherwise the listener origin.
   */
  getAdvertisedUrl(): string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The Web GUI this process serves; absent when no Web runtime is mounted. */
    webApp: WebApp
  }
}

/** Stable Cordis plugin name. */
export const name = 'web-app'

const ANNOUNCED_ROOTS = new WeakSet<Context>()

/** Runtime service that releases Web rows after bind-dependent values resolve. */
const WEB_RUNTIME_SERVICE = 'webRuntime'

/** Services required before the web runtime can mount. */
export const inject = ['webServer']

/** Plugin config: composed deployment settings plus per-invocation command-line values. */
export interface Config {
  /** Permit default-browser handoff after the Loader tree settles; an SSH launch suppresses it. */
  openBrowser: boolean
  /** Print the URL line on activation; a non-interactive layer can turn it off. */
  printUrl: boolean
  /**
   * Register the `DSH_WEB_URL` bash variable naming this GUI. A one-shot
   * non-interactive layer can turn it off when its user is not in the GUI.
   */
  surfaceContext: boolean
  /**
   * Canonical HTTP(S) root to advertise in the printed and opened URL,
   * `DSH_WEB_URL`, and `webApp.getAdvertisedUrl()`, which supplies the Web GUI
   * URL in agent runtime context, e.g. `https://app.example/ui/`, normalized to end in `/`. Configures no routing
   * or authentication; see [public deployments](../README.md#public-deployments).
   * Absent or YAML `null` advertises the bind-address URL.
   */
  publicUrl?: string
  /** Explicit `--trusted-host` authorities from this invocation, in argument order. */
  trustedHosts: string[]
}

export const Config: z<Config> = z.object({
  openBrowser: z.boolean().default(true),
  printUrl: z.boolean().default(true),
  surfaceContext: z.boolean().default(true),
  publicUrl: z.transform(z.string(), value => parsePublicUrl(value).href),
  trustedHosts: z.array(String).default([]),
})

/** Bind-dependent Web values shared by the trust fence and URL display. */
export interface WebRuntimeValues {
  /** LAN IPv4 literals sampled once when the server binds all interfaces. */
  lanAddresses: string[]
  /** LAN literals followed by explicit invocation authorities. */
  trustedHosts: string[]
}

/** Environment variable naming the advertised URL of this Web GUI. */
const DSH_WEB_URL = 'DSH_WEB_URL' as const

/**
 * Resolve one LAN-trust snapshot from the active server bind.
 *
 * Derived entries are port-less IP literals: DNS rebinding needs an
 * attacker-controlled name, while an IP-literal Host is safe on any port and
 * an OS-assigned port is unknowable before bind.
 * @param bindHost - the active webserver bind host.
 * @param extra - explicit `--trusted-host` values, in argument order.
 * @returns the LAN display addresses and invocation-derived fence authorities.
 */
export function resolveLanTrust(bindHost: string, extra: readonly string[]): WebRuntimeValues {
  const lanAddresses = isWildcardHost(bindHost)
    ? Object.values(networkInterfaces()).flat()
      .filter((iface): iface is NonNullable<typeof iface> => iface !== undefined && iface.family === 'IPv4' && !iface.internal)
      .map(iface => iface.address)
    : []
  return { lanAddresses, trustedHosts: [...lanAddresses, ...extra] }
}

const BROWSER_OPENER_MODULE = import.meta.resolve('open')

const BROWSER_OPENER_PROGRAM = `
try {
  const { default: open } = await import(${JSON.stringify(BROWSER_OPENER_MODULE)})
  const launcher = await open(process.argv[1])
  if (process.platform === 'win32') {
    // open resolves at PowerShell spawn; keep it referenced until that launcher hands the URL to Windows.
    const code = launcher.exitCode ?? await new Promise((resolve, reject) => {
      function onError(error) {
        launcher.off('close', onClose)
        reject(error)
      }
      function onClose(code) {
        launcher.off('error', onError)
        resolve(code)
      }
      launcher.ref()
      launcher.once('error', onError)
      launcher.once('close', onClose)
    })
    if (code !== 0) throw new Error('browser operating-system launcher exited with code ' + String(code))
  }
  process.exitCode = 0
} catch (error) {
  // The parent turns this exit into the manual-URL warning.
  console.error(error)
  process.exitCode = 1
}
`

/**
 * Local root URL of the active Web server. An all-interfaces bind advertises
 * this machine's loopback origin; the per-network addresses are published
 * separately.
 * @throws when the runtime resolves without a bound webServer, or when the bind
 *   address has no URL form.
 */
function localWebUrl(ctx: Context): string {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    throw new Error('web-app: webServer service missing while resolving Web runtime')
  }
  return webServer.getOrigin()
}

/** Resolve the advertised root: this plugin's canonical `publicUrl`, or the bind-address URL (loopback when bound to loopback). */
function appRootUrl(ctx: Context, publicUrl: string | undefined): string {
  if (publicUrl !== undefined) return publicUrl
  return localWebUrl(ctx)
}

/**
 * Dist location is workspace knowledge of this bundle: anchored on the
 * frontend package manifest, not configured. Existence is a request-time
 * concern — the fallback owner reads files per request, so a composition
 * whose page never reaches the fallback seat (the static worker preview
 * ships its own page and carries no dist) boots without one.
 */
function resolveDistIndex(): string {
  const require = createRequire(import.meta.url)
  try {
    return join(dirname(require.resolve('@deepseek-ai/dsh-web-frontend/package.json')), 'dist', 'index.html')
  } catch {
    /* v8 ignore next 2 -- reachable only when the frontend package is absent from the checkout */
    throw new Error('web-app: @deepseek-ai/dsh-web-frontend is not resolvable from this composition')
  }
}

/** Start the maintained platform opener without forwarding Harness credentials. */
function spawnBrowserLauncher(url: string): ChildProcess {
  return spawn(process.execPath, [
    '--input-type=module',
    '--eval', BROWSER_OPENER_PROGRAM,
    '--', url,
  ], {
    env: scrubbedParentEnv(),
    stdio: ['ignore', 'inherit', 'pipe'],
  })
}

/** Hand one URL to the operating system's default browser. */
async function openBrowser(url: string): Promise<void> {
  const launcher = spawnBrowserLauncher(url)
  let launcherStderr = ''
  launcher.stderr?.setEncoding('utf8')
  launcher.stderr?.on('data', (chunk: string) => { launcherStderr += chunk })
  await new Promise<void>((resolve, reject) => {
    function onError(error: Error): void {
      launcher.off('close', onClose)
      reject(error)
    }
    function onClose(code: number | null): void {
      launcher.off('error', onError)
      if (code !== 0) {
        const firstLine = launcherStderr.trim().split(/\r?\n/u)[0]
        const reason = firstLine === undefined || firstLine === ''
          ? `browser launcher exited with code ${String(code)}`
          : firstLine.replace(/^(?:[A-Za-z]*Error):\s*/u, '')
        reject(new Error(reason))
        return
      }
      if (launcherStderr !== '') process.stderr.write(launcherStderr)
      resolve()
    }
    launcher.once('error', onError)
    launcher.once('close', onClose)
  })
}

/** Test hooks for the built dist and native browser handoff; production never mutates them. */
export const internals: {
  resolveDistIndex: () => string
  openBrowser: (url: string) => Promise<void>
} = { resolveDistIndex, openBrowser }

/**
 * Mount the Web runtime: dist serving, the bash runtime variable, the URL
 * line, and the default-browser handoff.
 * @param ctx - plugin context carrying the webServer service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  // The schema validates a present string; an explicit YAML `null` bypasses
  // the string transform and reaches here, meaning unset.
  const publicUrl = config.publicUrl ?? undefined
  const boundHost = ctx.webServer.host
  if (publicUrl === undefined && !isWildcardHost(boundHost) && bindUrlHost(boundHost) === undefined) {
    throw new Error(
      `web-app: bind address ${JSON.stringify(boundHost)} carries an interface zone id, which no URL can express;`
      + ' pass --public-url with the root browsers actually reach it through',
    )
  }
  if (ctx.webServer.protocol === 'http:' && !isLoopbackHost(boundHost)) {
    console.warn(`dsh web: listening on ${boundHost} over plain HTTP; restrict this port to a trusted proxy or network`)
  }
  // Bind-dependent values the trust fence and the URL line share; the
  // connection row injects this service, so it resolves after the bind.
  const runtime = resolveLanTrust(boundHost, config.trustedHosts)
  ctx.provide(WEB_RUNTIME_SERVICE, runtime)
  ctx.provide('webApp', { getAdvertisedUrl: () => appRootUrl(ctx, publicUrl) } satisfies WebApp)
  // The bind URL belongs to this host. Under SSH, the operator reaches it
  // through a local forwarding address that this process cannot derive.
  const handoffBrowser = config.openBrowser && !launchedThroughSsh(launchEnvironmentOf(ctx))
  ctx.plugin(FrontendStatic, { distIndex: internals.resolveDistIndex() })
  if (config.surfaceContext) {
    ctx.inject(['shellEnv'], (runtimeCtx) => {
      runtimeCtx.shellEnv.register({
        name: 'web-runtime',
        variables: {
          [DSH_WEB_URL]: { description: 'Advertised URL of the DeepSeek Harness Web GUI serving this session.' },
        },
        resolve: () => ({ [DSH_WEB_URL]: appRootUrl(runtimeCtx, publicUrl) }),
      })
    })
  }
  if (config.printUrl || handoffBrowser) {
    ctx.inject(['connection'], (connectionCtx) => {
      // The URL line and browser handoff are readiness signals: supervisors RPC
      // as soon as they observe the line, while a browser requests the page as
      // soon as it opens. Neither may run while sibling rows such as the /api
      // route owner are still mounting. Await Loader settlement first; a
      // hand-built tree without a Loader is already the complete tree.
      const announceReady = (): void => {
        if (ANNOUNCED_ROOTS.has(connectionCtx.root)) return
        const webUrl = appRootUrl(connectionCtx, publicUrl)
        const authenticatedUrl = connectionCtx.connection.authenticatedUrl(webUrl)
        // Reuse the exact LAN snapshot provided to the /api trust fence, and
        // carry the launch token on every address a reachable page may use.
        const { protocol, port } = connectionCtx.webServer
        const lanUrls = runtime.lanAddresses
          .map(address => connectionCtx.connection.authenticatedUrl(`${protocol}//${address}:${String(port)}`))
          .join(', ')
        ANNOUNCED_ROOTS.add(connectionCtx.root)
        if (config.printUrl) {
          console.log(`dsh web: ${authenticatedUrl}${lanUrls.length === 0 ? '' : ` (LAN: ${lanUrls})`}`)
        }
        if (handoffBrowser) {
          console.log('dsh web: opening the default browser; pass --no-open to disable')
          void internals.openBrowser(authenticatedUrl).catch((error: unknown) => {
            const reason = error instanceof Error ? error.message : String(error)
            console.error(`web-app: could not open the default browser because ${reason}; use the dsh web URL printed at startup`)
          })
        }
      }
      // This row's own activation can precede a sibling failure. The app owns
      // readiness by waiting for its Loader tree, or announces at once in a
      // hand-built tree without Loader.
      const settled = connectionCtx.get('loader')?.await()
      if (settled === undefined) announceReady()
      else {
        void settled.then(async () => {
          await auditStartupEntries(connectionCtx.root, 'dsh web', () => {})
          // The tree can be disposed while the boot was in flight (early
          // SIGTERM); a URL line or browser tab for a dead server would only
          // mislead, and reading torn-down services would turn a clean shutdown
          // into a crash.
          if (connectionCtx.get('webServer') !== undefined
            && connectionCtx.get('connection') !== undefined) announceReady()
        }).catch(() => {
          // Boot owns the failure diagnostic; readiness remains unpublished.
        })
      }
    })
  }
}

/**
 * Settings domain base plugin, browser half. Provides `ctx.settingsScope`, the
 * settings-namespace scope service every preference row binds its durable
 * section through, and owns the one `settings.describe` reader in the browser:
 * the describe mirror, whose invalidation subscriptions
 * (`settings/document-updated`, `connection/reset`) live here so every derived
 * surface refreshes from a single wire read. It depends on no `ui-*`
 * presentation package, so any feature that owns a preference can reach it:
 * the settings SHELL — the `sidebar.settings` occupant, its navigation, and
 * the chrome — lives in ui-settings-general, because a shell dependency on
 * ui-sidebar would close a reference cycle through ui-layout and ui-theme.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: the ctx.remote merge, the fixed Host facts, and the carrier's
// `connection/reset` lifecycle event, all through the assembly package.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only pair supplying `$on` and its key face without dragging a build
// artifact into the Host graph (rationale beside the same pair in
// settings-scope.ts).
import type {} from '@deepseek-ai/dsh-api-remotes/types'
import type {} from '@deepseek-ai/dsh-settings/types'
// Type-only: the connection handle and its Host generation source, which the
// non-loopback re-probe hangs off. Reached through `ctx.get('connection')`
// rather than the Context merge so this package's dependency list stays as
// upstream declares it (the merge would require a package.json edge it does
// not carry).
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { SettingsSchemaService } from './schema.ts'
import { SettingsScopeBinder } from './settings-scope.ts'
import { SettingsDescribeMirror } from './settings-mirror.ts'

export type {
  SettingsGeneralItemOwnerProps, SettingsHeaderOwnerProps, SettingsOnboardingOwnerProps,
  SettingsPluginsTabOwnerProps, SettingsSectionOwnerProps, SettingsTriggerOwnerProps,
} from './contract/slots.ts'
export type { SettingsScopeController, SettingsScopeBinder } from './settings-scope.ts'
export type { SettingsScope, SettingsScopeSnapshot, SettingsScopeSpec } from './settings-contract.ts'
export type { SettingsSchemaService } from './schema.ts'
export type { SchemaNode } from './schema.ts'
export type {
  SettingsDescribeFace, SettingsDescribeView, SettingsMirrorSnapshot,
} from './settings-mirror.ts'

/**
 * Required services: the Remote namespace the mirror reads through and the
 * forwarded settings invalidation it refreshes on.
 */
export const inject = ['remote', 'remote.settings']

/**
 * Provide the settings-namespace scope service over one shared describe
 * mirror, and keep that mirror fresh on the signals that can move the
 * settings document: a document commit, a (re)connect, and the first Host
 * generation a non-loopback page sees.
 *
 * Constructing the service in this plugin's fiber keeps its traced methods
 * bound to each consuming plugin's context.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  const schema = new SettingsSchemaService(ctx)
  // Resolved once here, where `remote` is declared in this plugin's own
  // `inject`; the binder hands the same answer to every scope it binds.
  // A non-loopback page starts as a PROBE: it tries Host persistence and
  // downgrades to process-local memory only when the /api trust fence refuses.
  const host = ctx.remote.$host
  const persistence = host.isLoopback ? 'host' : 'probe'
  const mirror = new SettingsDescribeMirror(ctx, persistence)
  // Optional: a headless composition (or a bench) may carry no Connection
  // service, and the probe retry is an enhancement rather than a hard need.
  const connection = ctx.get('connection') as ConnectionHandle | undefined
  ctx.effect(() => {
    // Re-probe before every refresh on a non-loopback page: a boot-time 403
    // must not lock the mirror into memory mode once trust settles.
    const refresh = (): void => {
      if (!host.isLoopback) mirror.retryProbe()
      void mirror.load()
    }
    const disposers = [
      ctx.remote.$on('settings/document-updated', refresh),
      ctx.on('connection/reset', refresh),
    ]
    // A non-loopback page can request settings before its first Host
    // generation has crossed the trust fence. Re-probe once that generation
    // lands so a boot-time 403 does not lock the mirror into memory mode.
    if (!host.isLoopback && connection !== undefined) {
      disposers.push(connection.generation.subscribe(() => {
        if (connection.generation.getSnapshot() !== undefined) refresh()
      }))
    }
    // The first connection also emits connection/reset, so startup normally
    // costs two reads (budgeted in startup-rpc-budget.e2e.ts). The in-flight
    // fold does not merge them into one; it guarantees at most one pending
    // read at a time and that no invalidation arriving mid-read is lost.
    void mirror.ensure()
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-settings: describe mirror invalidations')
  new SettingsScopeBinder(ctx, { mirror, schema, persistence })
}

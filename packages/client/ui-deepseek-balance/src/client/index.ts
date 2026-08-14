/**
 * DeepSeek balance plugin, browser half: the account-balance footer action
 * rendered above Settings in the sidebar foot. One BalanceController per
 * plugin fiber polls the host's deepseek.balance API; the host resolves the
 * DeepSeek API key and queries the official balance endpoint, so the key
 * never crosses the wire.
 * @module @deepseek-ai/dsh-client-ui-deepseek-balance/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ConnectionHandle / IApiClient merge through the Client assembly boundary.
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the sidebar SlotMap merge (the footer.action entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { BalanceController } from './controller.ts'
import { DeepseekBalance } from './DeepseekBalance.tsx'
import type { DeepseekBalanceFace } from './slots.ts'
import { en, zh } from './locales.ts'

export type { BalanceController, BalanceState } from './controller.ts'
export type { DeepseekBalanceFace } from './slots.ts'
export type { DeepseekBalanceKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'deepseek-balance'

/** Required services: the slot registry, the connection API, and the copy. */
export const inject = ['slots', 'connection', 'locale']

/**
 * Client plugin body: the balance footer action and its controller.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-deepseek-balance: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new BalanceController(connection.api.deepseek)

  ctx.slots.inject('sidebar.footer.action', () => {
    const dispose = ctx.slots.register({
      name: 'sidebar.footer.action',
      id: 'deepseek-balance',
      order: 10,
      locale: NS,
      inject: (): DeepseekBalanceFace => ({
        hooks: { balance: controller },
        refresh: () => { void controller.refresh(true) },
      }),
    }, DeepseekBalance)
    controller.start()
    return () => {
      dispose()
      controller.dispose()
    }
  })
}

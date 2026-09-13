/**
 * Git changes plugin, browser half: registers the Changes Conversation View
 * tab. The view reads the Host's authenticated Git routes; this package owns
 * no client service.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { GitChangesStats } from './GitChangesStats.tsx'
import { GitChangesView } from './GitChangesView.tsx'
import { en, NS, zh, type ChangesKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Changes view copy. */
    'changes': ChangesKey
  }
}

/** Required services: the conversation view slot and the locale registry. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the Changes View tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-git-changes: dictionaries')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'changes',
    order: 20,
    locale: NS,
    label: () => t('view.changes'),
  }, GitChangesView))
  ctx.slots.inject('conversation.composer.dock.stats', () => ctx.slots.register({
    name: 'conversation.composer.dock.stats', id: 'git-changes', order: 20, locale: NS,
  }, GitChangesStats))
}

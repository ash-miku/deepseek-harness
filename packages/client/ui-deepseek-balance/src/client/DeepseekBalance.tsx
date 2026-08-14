/**
 * DeepSeek account-balance surface: a compact footer action above Settings.
 * Wide renders an icon + label + amount; rail renders the icon alone. Clicking
 * forces a host-cache-bypassing re-read.
 */

import {
  IconLoadingOutline16, IconRefreshOutline16, IconSparkle16, IconWarningOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the sidebar SlotMap merge (the footer.action entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { DeepseekBalanceFace } from './slots.ts'
import type { DeepseekBalanceView } from '@deepseek-ai/dsh-api-remotes/client'
import css from './DeepseekBalance.module.css'

/** Full component props composed by the sidebar footer-action slot. */
export type DeepseekBalanceProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<DeepseekBalanceFace> & PropsLocale<'deepseek-balance'>

/** Render one balance reading as a compact amount string. */
function formatAmount(balance: DeepseekBalanceView): string {
  if (balance.currency === 'CNY') return '¥' + balance.totalBalance
  return balance.totalBalance + ' ' + balance.currency
}

/** Render the balance footer action. */
export function DeepseekBalance({ wide, useBalance, refresh, t }: DeepseekBalanceProps) {
  const state = useBalance(snapshot => snapshot)
  const balance = state.balance
  const ready = state.status === 'ready' && balance !== undefined
  const loading = state.status === 'loading' || state.status === 'idle'
  const failed = state.status === 'error'

  const amount = ready ? formatAmount(balance) : ''
  const tooltip = ready
    ? t('balance.label') + ': ' + amount + ' (' + t('balance.refresh') + ')'
    : failed ? t('balance.unavailable') + ' — ' + t('balance.refresh')
      : t('balance.refresh')

  const Icon = failed ? IconWarningOutline16 : loading ? IconLoadingOutline16 : IconSparkle16

  return (
    <Tooltip label={tooltip} side="bottom" delayMs={500}>
      <button
        type="button"
        className={wide ? css.action : [css.action, css.rail].join(' ')}
        aria-label={t('balance.refresh')}
        data-status={ready ? 'ready' : failed ? 'error' : 'loading'}
        onClick={() => { refresh() }}
      >
        <Icon size={14} className={loading ? css.spin : undefined} />
        {wide && (
          <span className={css.label}>
            {ready ? amount : failed ? t('balance.unavailable') : t('balance.loading')}
          </span>
        )}
        {wide && <IconRefreshOutline16 size={12} className={css.refresh} />}
      </button>
    </Tooltip>
  )
}

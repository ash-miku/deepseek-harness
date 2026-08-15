/**
 * DeepSeek account-balance surface: a compact footer action above Settings.
 * Wide renders the balance plus today's official cost when available; rail
 * renders the icon alone. Clicking forces a host-cache-bypassing re-read.
 */

import {
  IconLoadingOutline16, IconRefreshOutline16, IconSparkle16, IconWarningOutline16, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the sidebar SlotMap merge (the footer.action entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { DeepseekBalanceFace } from './slots.ts'
import css from './DeepseekBalance.module.css'

/** Full component props composed by the sidebar footer-action slot. */
export type DeepseekBalanceProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<DeepseekBalanceFace> & PropsLocale<'deepseek-balance'>

/** Render a monetary amount with its currency symbol. */
function formatMoney(currency: string, value: string): string {
  if (currency === 'CNY') return '¥' + value
  return value + ' ' + currency
}

/** Render the balance footer action. */
export function DeepseekBalance({ wide, useBalance, refresh, t }: DeepseekBalanceProps) {
  const state = useBalance(snapshot => snapshot)
  const balance = state.balance
  const ready = state.status === 'ready' && balance !== undefined
  const loading = state.status === 'loading' || state.status === 'idle'
  const failed = state.status === 'error'

  const amount = ready ? formatMoney(balance.currency, balance.totalBalance) : ''
  const today = ready && balance.todayCost !== undefined && balance.todayCurrency !== undefined
    ? t('balance.today') + ' ' + formatMoney(balance.todayCurrency, balance.todayCost)
    : undefined
  const tooltip = ready
    ? t('balance.label') + ': ' + amount + (today === undefined ? '' : ' · ' + today) + ' (' + t('balance.refresh') + ')'
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
        data-has-today={today !== undefined || undefined}
        onClick={() => { refresh() }}
      >
        <Icon size={14} className={loading ? css.spin : undefined} />
        {wide && (
          <span className={css.label}>
            {ready ? amount : failed ? t('balance.unavailable') : t('balance.loading')}
          </span>
        )}
        {wide && today !== undefined && <span className={css.today}>{today}</span>}
        {wide && <IconRefreshOutline16 size={12} className={css.refresh} />}
      </button>
    </Tooltip>
  )
}

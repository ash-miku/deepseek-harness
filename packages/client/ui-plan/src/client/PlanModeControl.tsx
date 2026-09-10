import { useEffect, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconCloseFill14 } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the input.plan seat and
// its {locked} owner share).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PlanChipInjected } from './index.ts'
import css from './PlanModeControl.module.css'

/** Full plan-seat component props: runtime share (standard kit + locked owner prop) & injected share & the locale seat. */
export type PlanChipProps =
  PropsRuntime<'conversation.input.plan'> & InjectFace<PlanChipInjected> & PropsLocale<'plan'>

/**
 * Plan-mode toggle over the host-computed `plan` projection. The chip renders
 * whenever plan mode is available (`pending ? !active : active` is the
 * effective target — a folded host value, not client optimism), so inactive
 * sessions expose the same visible Plan affordance as active ones.
 */
export function PlanChip({ useProjection, locked, setPlanMode, t }: PlanChipProps) {
  const plan = useProjection('plan')
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null)
  const [rpcBusy, setRpcBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // Keep the button locked until the host projection confirms the requested
  // state. Without this, a click landing after the RPC settles but before the
  // projection frame arrives would toggle from a stale target and send the
  // wrong /plan command.
  useEffect(() => {
    if (plan === undefined || pendingTarget === null) return
    const target = plan.pending ? !plan.active : plan.active
    if (target === pendingTarget) setPendingTarget(null)
  }, [pendingTarget, plan])

  if (plan === undefined) return null
  const target = plan.pending ? !plan.active : plan.active
  const busy = rpcBusy

  const toggle = (): void => {
    // No busy/locked guard: both disable the button, so no click arrives.
    const requested = !target
    setPendingTarget(requested)
    setRpcBusy(true)
    setError(null)
    void setPlanMode(requested).then((failure) => {
      if (!aliveRef.current) return
      if (failure !== null) setPendingTarget(null)
      setError(failure)
    }, (reason: unknown) => {
      if (!aliveRef.current) return
      setPendingTarget(null)
      setError(reason instanceof Error ? reason.message : String(reason))
    }).finally(() => {
      if (aliveRef.current) setRpcBusy(false)
    })
  }

  return (
    <span className={css.wrap}>
      <button
        type="button"
        className={target ? css.chip : css.chipInactive}
        aria-label={t(target ? 'chip.on.aria' : 'chip.off.aria')}
        title={t(target ? 'chip.on.title' : 'chip.off.title')}
        disabled={locked || busy}
        onClick={toggle}
      >
        {t('chip.label')}
        <span className={css.close} aria-hidden>
          <IconCloseFill14 size={12} />
        </span>
      </button>
      {error !== null && <span className={css.error} role="status" title={error}>{t('chip.exitFailed')}</span>}
    </span>
  )
}

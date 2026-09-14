/** Uncommitted workspace totals beside the composer's session statistics. */
import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { GIT_STATUS_PATH, isGitStatusResult, type GitStatusResult } from '../git-contract.ts'
import css from './ChangesView.module.css'

type Props = PropsRuntime<'conversation.composer.dock.stats'> & PropsLocale<'changes'>

/**
 * Refresh workspace totals on session activity and window focus.
 * @param props - session identity, live running state, and localized copy.
 * @returns the changed-file count and text additions/deletions, or nothing when unavailable.
 */
export function GitChangesStats({ sessionId, useSession, t, selectView }: Props) {
  const running = useSession(snapshot => snapshot.running)
  const [status, setStatus] = useState<{ sessionId: string; value: GitStatusResult } | null>(null)
  useEffect(() => {
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort()
      const request = new AbortController()
      controller = request
      void fetch(`${GIT_STATUS_PATH}?${new URLSearchParams({ sessionId })}`, {
        signal: request.signal, headers: { accept: 'application/json' },
      }).then(async (response) => {
        if (!response.ok) throw new Error('Git status unavailable')
        const value: unknown = await response.json()
        if (!isGitStatusResult(value)) throw new Error('Malformed Git status')
        if (!request.signal.aborted) setStatus({ sessionId, value })
      }).catch(() => {
        // An unavailable repository must not leave stale totals on screen.
        if (!request.signal.aborted) setStatus(null)
      })
    }
    refresh()
    window.addEventListener('focus', refresh)
    return () => {
      controller?.abort()
      window.removeEventListener('focus', refresh)
    }
  }, [sessionId, running])

  if (status?.sessionId !== sessionId || !status.value.repo) return null
  const changes = status.value.changes
  // The file count stays the untruncated total; line totals sum only the
  // changed paths the Host's cap returned.
  const total = status.value.total
  if (total === 0) return null
  const totals = changes.reduce((sum, change) => ({
    added: sum.added + (change.additions ?? 0),
    removed: sum.removed + (change.deletions ?? 0),
  }), { added: 0, removed: 0 })
  return (
    <button type="button" onClick={() => { selectView('changes') }} className={css.composerStats} title={t('stats.label', { count: total, ...totals })}>
      <span>{t('stats.files', { count: total })}</span>
      <span className={css.statAdded}>+{totals.added}</span>
      <span className={css.statRemoved}>−{totals.removed}</span>
    </button>
  )
}

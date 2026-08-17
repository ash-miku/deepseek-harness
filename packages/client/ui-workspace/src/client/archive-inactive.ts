/**
 * Candidate selection for bulk archiving sessions that have not updated for
 * a chosen number of days. Archive is registry-global and idempotent, so the
 * helper only decides which visible idle sessions are safe to move.
 */
import type { SessionId, SessionListState } from '@deepseek-ai/dsh-client-runtime/client'

/** Fixed threshold choices exposed by the archive-inactive dialog. */
export const INACTIVE_ARCHIVE_THRESHOLDS_DAYS = [7, 30, 90, 180] as const

/** One day in epoch milliseconds. */
const DAY_MS = 86_400_000

/**
 * Select sessions whose last update predates the cutoff and whose lifecycle
 * state makes archiving safe from the browser. Current, running, pending,
 * blank, subagent, and already-archived sessions are excluded; the rest of
 * the list remains eligible.
 * @param list - session list snapshot.
 * @param archivedSessionIds - registry-global archive set.
 * @param now - current epoch milliseconds.
 * @param days - inactivity threshold in whole days.
 * @returns eligible session ids in list order.
 */
export function selectInactiveSessions(
  list: SessionListState,
  archivedSessionIds: readonly SessionId[],
  now: number,
  days: number,
): SessionId[] {
  if (list.phase !== 'ready') return []
  const archived = new Set(archivedSessionIds)
  const cutoff = now - days * DAY_MS
  return list.ids.flatMap((id) => {
    const session = list.byId[id]
    if (session === undefined || session.blank || session.origin === 'subagent'
      || session.running || session.pendingInteraction !== undefined
      || session.id === list.current || archived.has(session.id)
      || session.updatedAt >= cutoff) return []
    return [id]
  })
}

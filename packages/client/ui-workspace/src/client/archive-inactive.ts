/**
 * Candidate selection for bulk archiving sessions that have not updated for
 * a chosen number of days. Archive is registry-global and idempotent, so the
 * helper only decides which visible idle sessions are safe to move.
 */
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Fixed threshold choices exposed by the archive-inactive dialog. */
export const INACTIVE_ARCHIVE_THRESHOLDS_DAYS = [7, 30, 90, 180] as const

/** One day in epoch milliseconds. */
const DAY_MS = 86_400_000

/**
 * Select sessions whose last update predates the cutoff and whose lifecycle
 * state makes archiving safe from the browser. Current, running, pending,
 * blank, subagent, and already-archived sessions are excluded; the rest of
 * the list remains eligible.
 *
 * Pending state is not a field of the list projection: it arrives on the
 * Session-owned interaction snapshot, so the caller passes the ids it holds
 * rather than the selector reaching for a second service.
 * @param list - session list snapshot.
 * @param archivedSessionIds - registry-global archive set.
 * @param pendingSessionIds - Sessions awaiting a user interaction right now.
 * @param now - current epoch milliseconds.
 * @param days - inactivity threshold in whole days.
 * @returns eligible session ids in list order.
 */
export function selectInactiveSessions(
  list: SessionListState,
  archivedSessionIds: readonly SessionId[],
  pendingSessionIds: Iterable<SessionId>,
  now: number,
  days: number,
): SessionId[] {
  if (list.phase !== 'ready') return []
  const archived = new Set(archivedSessionIds)
  const pending = new Set(pendingSessionIds)
  const cutoff = now - days * DAY_MS
  return list.ids.flatMap((id) => {
    const session = list.byId[id]
    if (session === undefined || session.blank || session.origin === 'subagent'
      || session.running || pending.has(session.id)
      || session.id === list.current || archived.has(session.id)
      || session.updatedAt >= cutoff) return []
    return [id]
  })
}

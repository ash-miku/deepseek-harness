import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  INACTIVE_ARCHIVE_THRESHOLDS_DAYS, selectInactiveSessions,
} from '../src/client/archive-inactive.ts'

const DAY_MS = 86_400_000
const NOW = 1_800_000_000_000

const sid = (id: string) => id as SessionId
const summary = (id: string, updatedAt: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), displayTitle: id, running: false, blank: false, updatedAt, ...overrides,
})
const state = (items: readonly SessionSummary[], overrides: Partial<SessionListState> = {}): SessionListState => ({
  ids: items.map(item => item.id),
  byId: Object.fromEntries(items.map(item => [item.id, item])),
  current: undefined,
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
  ...overrides,
})

describe('selectInactiveSessions', () => {
  it('keeps the fixed threshold options and returns old idle top-level sessions', () => {
    expect(INACTIVE_ARCHIVE_THRESHOLDS_DAYS).toEqual([7, 30, 90, 180])
    const current = summary('current', NOW - 40 * DAY_MS)
    const running = summary('running', NOW - 40 * DAY_MS, { running: true })
    const pending = summary('pending', NOW - 40 * DAY_MS)
    const blank = summary('blank', NOW - 40 * DAY_MS, { blank: true })
    const subagent = summary('subagent', NOW - 40 * DAY_MS, { origin: 'subagent' })
    const archivedOld = summary('archived', NOW - 40 * DAY_MS)
    const recent = summary('recent', NOW - 10 * DAY_MS)
    const eligible = summary('eligible', NOW - 40 * DAY_MS)

    expect(selectInactiveSessions(state([
      current, running, pending, blank, subagent, archivedOld, recent, eligible,
    ], { current: sid('current') }), [sid('archived')], [sid('pending')], NOW, 30)).toEqual([sid('eligible')])
  })

  it('applies the whole-day cutoff with the threshold boundary exclusive', () => {
    const older = summary('older', NOW - 31 * DAY_MS)
    const exactlyThirty = summary('exactlyThirty', NOW - 30 * DAY_MS)
    const exactlySeven = summary('exactlySeven', NOW - 7 * DAY_MS)
    const tenDays = summary('tenDays', NOW - 10 * DAY_MS)

    expect(selectInactiveSessions(state([older, exactlyThirty]), [], [], NOW, 30)).toEqual([sid('older')])
    expect(selectInactiveSessions(state([exactlySeven]), [], [], NOW, 7)).toEqual([])
    expect(selectInactiveSessions(state([tenDays]), [], [], NOW, 7)).toEqual([sid('tenDays')])
    expect(selectInactiveSessions(state([tenDays]), [], [], NOW, 30)).toEqual([])
  })

  it('returns no candidates before the list is ready or for rows absent from byId', () => {
    const pending = state([summary('old', NOW - 40 * DAY_MS)], { phase: 'pending' })
    const missing = state([], { ids: [sid('missing')] })

    expect(selectInactiveSessions(pending, [], [], NOW, 30)).toEqual([])
    expect(selectInactiveSessions(missing, [], [], NOW, 30)).toEqual([])
  })
})

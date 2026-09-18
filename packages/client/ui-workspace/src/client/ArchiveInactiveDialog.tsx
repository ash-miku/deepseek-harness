/**
 * Browser-owned modal for bulk archiving inactive sessions. The modal shows
 * the eligible count for the chosen threshold before committing, then reports
 * success and per-call failures while keeping the registry archive API as the
 * only write path.
 */
import { useEffect, useMemo, useState } from 'react'
import {
  Button, IconChevronDownOutline14, Menu, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { WorkspaceBrowserProps } from './contract/slots.ts'
import { INACTIVE_ARCHIVE_THRESHOLDS_DAYS, selectInactiveSessions } from './archive-inactive.ts'
import css from './rows/WorkspaceBrowser.module.css'

/** Default inactivity threshold when the dialog opens. */
const DEFAULT_ARCHIVE_DAYS = 30

/**
 * @param props.open - whether the modal is visible.
 * @param props.onClose - dismiss the modal; ignored while archiving.
 * @param props.useSessions - the standard session list hook.
 * @param props.useSessionStatus - the unified Session UI status hook; rows with a pending interaction are excluded.
 * @param props.archivedSessionIds - registry-global archive set.
 * @param props.archiveSession - one-session archive action.
 * @param props.t - workspace locale seat.
 * @returns the modal tree.
 */
export function ArchiveInactiveDialog({
  open, onClose, useSessions, useSessionStatus, archivedSessionIds, archiveSession, t,
}: {
  open: boolean
  onClose: () => void
  useSessions: WorkspaceBrowserProps['useSessions']
  useSessionStatus: WorkspaceBrowserProps['useSessionStatus']
  archivedSessionIds: readonly SessionId[]
  archiveSession: WorkspaceBrowserProps['archiveSession']
  t: WorkspaceBrowserProps['t']
}) {
  const list = useSessions(state => state)
  const statuses = useSessionStatus(state => state)
  const [days, setDays] = useState(DEFAULT_ARCHIVE_DAYS)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [result, setResult] = useState<{ archived: number; failed: number } | null>(null)
  useEffect(() => {
    if (!open) return
    setDays(DEFAULT_ARCHIVE_DAYS)
    setBusy(false)
    setResult(null)
  }, [open])
  const pendingSessionIds = useMemo(
    () => [...statuses].flatMap(([id, status]) =>
      status.pendingInteraction === undefined ? [] : [id]),
    [statuses],
  )
  const candidates = useMemo(
    () => selectInactiveSessions(list, archivedSessionIds, pendingSessionIds, Date.now(), days),
    [archivedSessionIds, days, list, pendingSessionIds],
  )
  const close = () => {
    /* v8 ignore next 3 -- Modal close and cancel are disabled while busy, so this guard only covers an external imperative close. */
    if (!busy) onClose()
  }
  const confirm = async () => {
    /* v8 ignore next 2 -- the confirm button is disabled while busy or empty;
       the empty branch is the only guard reachable through the UI. */
    if (busy || candidates.length === 0) return
    setBusy(true)
    const outcomes = await Promise.allSettled(candidates.map(id => Promise.resolve().then(() => archiveSession(id))))
    const archived = outcomes.filter(outcome => outcome.status === 'fulfilled').length
    setResult({ archived, failed: outcomes.length - archived })
    setBusy(false)
  }
  return (
    <Modal
      open={open}
      onClose={close}
      closeLabel={t('close')}
      title={t('archiveInactive.title')}
      footer={(
        <>
          <Button variant="outline" disabled={busy} onClick={close}>{t('cancel')}</Button>
          <Button
            variant="primary"
            disabled={busy || candidates.length === 0 || result?.failed === 0}
            onClick={() => { void confirm() }}
          >
            {t('archiveInactive.confirm')}
          </Button>
        </>
      )}
    >
      <label className={css.archiveField}>
        <span>{t('archiveInactive.field')}</span>
        <Menu
          open={menuOpen}
          /* v8 ignore next 2 -- Menu calls onClose for outside/Escape closes; selection closes through onSelect in the UI tests. */
          onClose={() => { setMenuOpen(false) }}
          items={INACTIVE_ARCHIVE_THRESHOLDS_DAYS.map(daysOption => ({
            id: String(daysOption),
            label: t('archiveInactive.days', { n: daysOption }),
          }))}
          selectedId={String(days)}
          onSelect={(id) => {
            setMenuOpen(false)
            setDays(Number(id))
            setResult(null)
          }}
          align="end"
          portal
          anchor={(
            <button
              type="button"
              className={css.archiveSelector}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              disabled={busy}
              onClick={() => { setMenuOpen(value => !value) }}
            >
              {t('archiveInactive.days', { n: days })}
              <IconChevronDownOutline14 className={css.archiveChevron} />
            </button>
          )}
        />
      </label>
      <div className={css.archiveSummary} role="status">
        {busy
          ? t('archiveInactive.pending', { n: candidates.length })
          : result === null
            ? candidates.length === 0
              ? t('archiveInactive.empty')
              : t('archiveInactive.summary', { n: candidates.length })
            : result.failed === 0
              ? t('archiveInactive.done', { n: result.archived })
              : t('archiveInactive.partial', { archived: result.archived, failed: result.failed })}
      </div>
      {result !== null && result.failed > 0 && (
        <div className={css.renameError} role="alert">{t('archiveInactive.failures', { failed: result.failed })}</div>
      )}
    </Modal>
  )
}

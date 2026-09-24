/** Changes view: workspace Git status and inline/split diff over the Host routes. */
import { useEffect, useMemo, useState } from 'react'
import type { ConvViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { IconChevronDownOutlineMedium, Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  GIT_DIFF_PATH, GIT_STATUS_PATH,
  isGitDiffValue, isGitStatusResult,
  type GitChange, type GitChangeKind, type GitDiffValue, type GitStatusResult,
} from '../git-contract.ts'
import { diffTotals, parseUnified, toSplit, type DiffMode, type DiffRow, type SplitRow } from './diff-model.ts'
import type { ChangesKey } from './locales.ts'
import css from './ChangesView.module.css'

/** One asynchronous fetch's lifecycle. */
type Load<T> = { readonly phase: 'loading' } | { readonly phase: 'error' } | { readonly phase: 'ready'; readonly value: T }

async function requestJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } })
  if (!response.ok) throw new Error(`request failed: ${response.status}`)
  return await response.json()
}

async function loadStatus(sessionId: string, base: string, signal: AbortSignal): Promise<GitStatusResult> {
  const params = new URLSearchParams({ sessionId })
  if (base !== '') params.set('base', base)
  const value = await requestJson(`${GIT_STATUS_PATH}?${params.toString()}`, signal)
  if (!isGitStatusResult(value)) throw new Error('malformed status payload')
  return value
}

async function loadDiff(sessionId: string, path: string, base: string, signal: AbortSignal): Promise<GitDiffValue> {
  const params = new URLSearchParams({ sessionId, path })
  if (base !== '') params.set('base', base)
  const value = await requestJson(`${GIT_DIFF_PATH}?${params.toString()}`, signal)
  if (!isGitDiffValue(value)) throw new Error('malformed diff payload')
  return value
}

const KIND_LETTER: Record<GitChangeKind, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  typechange: 'T',
  unmerged: 'U',
  untracked: '?',
}

/** Render the inline layout: one row per diff line with both line numbers. */
function InlineDiff({ rows }: { readonly rows: readonly DiffRow[] }) {
  return (
    <div className={css.diffRows}>
      {rows.map((row, index) => row.kind === 'hunk'
        ? <div key={index} className={css.hunk}>{row.text}</div>
        : (
          <div key={index} className={`${css.line} ${row.kind === 'add' ? css.lineAdd : row.kind === 'del' ? css.lineDel : row.kind === 'meta' ? css.lineMeta : ''}`}>
            <span className={css.lineNo}>{row.oldLine ?? ''}</span>
            <span className={css.lineNo}>{row.newLine ?? ''}</span>
            <span className={css.lineText}>{row.kind === 'add' ? '+' : row.kind === 'del' ? '-' : ' '}{row.text}</span>
          </div>
        ))}
    </div>
  )
}

/** Render the split layout: aligned old/new cells with their own line numbers. */
function SplitDiff({ rows }: { readonly rows: readonly SplitRow[] }) {
  return (
    <div className={css.splitRows}>
      {rows.map((row, index) => row.kind === 'hunk'
        ? <div key={index} className={css.hunk}>{row.text}</div>
        : (
          <div key={index} className={css.splitRow}>
            <div className={`${css.splitCell} ${row.left.kind === 'del' ? css.lineDel : row.left.kind === 'empty' ? css.lineEmpty : ''}`}>
              <span className={css.lineNo}>{row.left.line ?? ''}</span>
              <span className={css.lineText}>{row.left.text}</span>
            </div>
            <div className={`${css.splitCell} ${row.right.kind === 'add' ? css.lineAdd : row.right.kind === 'empty' ? css.lineEmpty : ''}`}>
              <span className={css.lineNo}>{row.right.line ?? ''}</span>
              <span className={css.lineText}>{row.right.text}</span>
            </div>
          </div>
        ))}
    </div>
  )
}

/**
 * The Changes Conversation view: pick a comparison base, list changed files,
 * and read one file's diff inline or side by side.
 * @param props - standard Session view props plus this namespace's translations.
 * @returns the changes surface.
 */
export function GitChangesView({ sessionId, t }: ConvViewProps & PropsLocale<'changes'>) {
  const [base, setBase] = useState('')
  const [baseOpen, setBaseOpen] = useState(false)
  const [mode, setMode] = useState<DiffMode>('inline')
  const [reloadToken, setReloadToken] = useState(0)
  const [status, setStatus] = useState<Load<GitStatusResult>>({ phase: 'loading' })
  const [selected, setSelected] = useState<string | null>(null)
  const [diff, setDiff] = useState<Load<GitDiffValue> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus({ phase: 'loading' })
    void loadStatus(sessionId, base, controller.signal).then(
      (value) => { if (!controller.signal.aborted) setStatus({ phase: 'ready', value }) },
      () => { if (!controller.signal.aborted) setStatus({ phase: 'error' }) },
    )
    return () => { controller.abort() }
  }, [sessionId, base, reloadToken])

  useEffect(() => {
    if (status.phase !== 'ready' || !status.value.repo || status.value.changes.length === 0) {
      setSelected(null)
      return
    }
    const paths = status.value.changes.map(change => change.path)
    setSelected(current => current !== null && paths.includes(current) ? current : paths[0] ?? null)
  }, [status])

  useEffect(() => {
    if (selected === null) {
      setDiff(null)
      return
    }
    const controller = new AbortController()
    setDiff({ phase: 'loading' })
    void loadDiff(sessionId, selected, base, controller.signal).then(
      (value) => { if (!controller.signal.aborted) setDiff({ phase: 'ready', value }) },
      () => { if (!controller.signal.aborted) setDiff({ phase: 'error' }) },
    )
    return () => { controller.abort() }
  }, [sessionId, selected, base, reloadToken])

  const rows = useMemo(
    () => diff?.phase === 'ready' ? parseUnified(diff.value.unified) : [],
    [diff],
  )
  const splitRows = useMemo(() => mode === 'split' ? toSplit(rows) : [], [mode, rows])
  const fileTotals = useMemo(() => diffTotals(rows), [rows])
  const changes: readonly GitChange[] = status.phase === 'ready' && status.value.repo ? status.value.changes : []
  const total = status.phase === 'ready' && status.value.repo ? status.value.total : 0
  const truncated = status.phase === 'ready' && status.value.repo ? status.value.truncated : false
  const isRepo = status.phase === 'ready' && status.value.repo
  const baseLabel = base === '' ? t('base.working') : base
  const baseItems: MenuEntry[] = [
    { id: '', label: t('base.working') },
    ...(status.phase === 'ready' && status.value.repo
      ? status.value.branches.map(branch => ({ id: branch, label: branch }))
      : []),
  ]
  const changeTotals = changes.reduce(
    (sum, change) => ({ added: sum.added + (change.additions ?? 0), removed: sum.removed + (change.deletions ?? 0) }),
    { added: 0, removed: 0 },
  )
  // A Host from before the numstat change sends no counts; hide the summary
  // rather than claim a false "+0 −0".
  const hasCounts = changes.some(change => change.additions !== undefined || change.deletions !== undefined)

  return (
    <div className={css.root} data-conversation-composer-overlay="">
      <div className={css.toolbar}>
        <span className={css.title}>{t('view.changes')}</span>
        {isRepo && (
          <>
            <span className={css.field}>
              <span className={css.fieldLabel}>{t('label.base')}</span>
              <Menu
                open={baseOpen}
                items={baseItems}
                selectedId={base}
                onSelect={(id) => { setBaseOpen(false); setBase(id) }}
                onClose={() => { setBaseOpen(false) }}
                anchor={
                  <button
                    type="button"
                    className={css.trigger}
                    aria-label={`${t('label.base')} ${baseLabel}`}
                    onClick={() => { setBaseOpen(value => !value) }}
                  >
                    <span className={css.triggerLabel}>{baseLabel}</span>
                    <span className={baseOpen ? `${css.chevron} ${css.chevronOpen}` : css.chevron} aria-hidden>
                      <IconChevronDownOutlineMedium />
                    </span>
                  </button>
                }
              />
            </span>
            <span className={css.branch}>{status.value.branch !== null ? status.value.branch : t('branch.detached')}</span>
            <span className={css.counts}>{t('counts.files', { count: total })}</span>
            {hasCounts && (
              <span className={css.totalStats}>
                <span className={css.statAdded}>+{changeTotals.added}</span>
                <span className={css.statRemoved}>−{changeTotals.removed}</span>
              </span>
            )}
          </>
        )}
        <span className={css.spacer} />
        <div className={css.segment}>
          <button
            type="button"
            className={mode === 'inline' ? css.segmentActive : css.segmentButton}
            onClick={() => { setMode('inline') }}
          >
            {t('mode.inline')}
          </button>
          <button
            type="button"
            className={mode === 'split' ? css.segmentActive : css.segmentButton}
            onClick={() => { setMode('split') }}
          >
            {t('mode.split')}
          </button>
        </div>
        <button type="button" className={css.refresh} onClick={() => { setReloadToken(value => value + 1) }}>
          {t('refresh')}
        </button>
      </div>

      {status.phase === 'loading' && <div className={css.notice}>{t('loading')}</div>}
      {status.phase === 'error' && <div className={css.notice}>{t('error')}</div>}
      {status.phase === 'ready' && !status.value.repo && (
        <div className={css.notice}>{status.value.message !== '' ? status.value.message : t('empty.nonRepo')}</div>
      )}
      {isRepo && (
        <div className={css.body}>
          <div className={css.fileList}>
            {truncated && (
              <div className={css.notice}>{t('list.truncated', { shown: changes.length, total })}</div>
            )}
            {changes.length === 0 && <div className={css.notice}>{t('empty.clean')}</div>}
            {changes.map(change => (
              <button
                key={`${change.path}|${change.staged ? 's' : ''}${change.unstaged ? 'u' : ''}`}
                type="button"
                className={selected === change.path ? css.fileActive : css.file}
                title={change.origPath === undefined ? change.path : `${change.origPath} → ${change.path}`}
                onClick={() => { setSelected(change.path) }}
              >
                <span className={css.badge} data-kind={change.kind}>{KIND_LETTER[change.kind]}</span>
                <span className={css.filePath}>{change.path}</span>
                <span className={css.fileStats}>
                  {(change.additions ?? 0) > 0 && <span className={css.statAdded}>+{change.additions}</span>}
                  {(change.deletions ?? 0) > 0 && <span className={css.statRemoved}>−{change.deletions}</span>}
                </span>
                <span className={css.flags}>
                  {change.staged && <span className={css.flagStaged} title={t('flag.staged')}>●</span>}
                  {change.unstaged && <span className={css.flagUnstaged} title={t('flag.unstaged')}>●</span>}
                </span>
              </button>
            ))}
          </div>
          <div className={css.diffPane}>
            {diff === null && <div className={css.notice}>{t('empty.noSelection')}</div>}
            {diff?.phase === 'loading' && <div className={css.notice}>{t('loading')}</div>}
            {diff?.phase === 'error' && <div className={css.notice}>{t('error')}</div>}
            {diff?.phase === 'ready' && diff.value.binary && <div className={css.notice}>{t('binary')}</div>}
            {diff?.phase === 'ready' && !diff.value.binary && rows.length === 0 && <div className={css.notice}>{t('empty.noDiff')}</div>}
            {diff?.phase === 'ready' && !diff.value.binary && rows.length > 0 && (
              <>
                <div className={css.diffHeader}>
                  <span className={css.diffPath}>{diff.value.path}</span>
                  <span className={css.diffTotals}>
                    <span className={css.statAdded}>+{fileTotals.added}</span>
                    <span className={css.statRemoved}>−{fileTotals.removed}</span>
                  </span>
                  {diff.value.truncated && <span className={css.truncated}>{t('truncated')}</span>}
                </div>
                <div className={css.diffScroll}>
                  {mode === 'inline' ? <InlineDiff rows={rows} /> : <SplitDiff rows={splitRows} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Namespace key vocabulary re-exported for the plugin's locale binding. */
export type { ChangesKey }

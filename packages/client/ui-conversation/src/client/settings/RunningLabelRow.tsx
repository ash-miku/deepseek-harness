/** General Settings row for custom running-status labels. */
import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './RunningLabelRow.module.css'

/** Registration-side preference face. */
export interface RunningLabelRowInjected {
  hooks: {
    /** Persisted newline-separated running labels bound as useRunningLabels. */
    runningLabels: SnapshotStore<string>
  }
  /** Change the newline-separated running-status labels. */
  setRunningLabels: (labels: string) => void
}

/** Full Settings-row props. */
export type RunningLabelRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<RunningLabelRowInjected>

/**
 * Render the running-label preference row.
 * Each line is one label; the chat picks one randomly while the agent runs.
 */
export function RunningLabelRow({ useRunningLabels, setRunningLabels, t }: RunningLabelRowProps) {
  const labels = useRunningLabels(value => value)
  const [draft, setDraft] = useState(labels)

  useEffect(() => {
    setDraft(labels)
  }, [labels])

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('settings.runningLabel.title')}</div>
        <div className={css.desc}>{t('settings.runningLabel.description')}</div>
      </div>
      <textarea
        className={css.input}
        value={draft}
        rows={3}
        maxLength={400}
        aria-label={t('settings.runningLabel.title')}
        placeholder={t('settings.runningLabel.placeholder')}
        onChange={(event) => { setDraft(event.target.value) }}
        onBlur={() => { setRunningLabels(draft) }}
      />
    </div>
  )
}

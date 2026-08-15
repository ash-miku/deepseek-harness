/** General Settings row for the chat process-display density. */
import { useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ConversationProcessDisplayMode } from '../../submission-settings.ts'
import type { ConversationKey } from '../locales.ts'
import css from './DisplayModeRow.module.css'

/** Registration-side preference face. */
export interface DisplayModeRowInjected {
  hooks: {
    /** Persisted process-display preference bound as useDisplayMode. */
    displayMode: SnapshotStore<ConversationProcessDisplayMode>
  }
  /** Change the chat process-display density. */
  setDisplayMode: (mode: ConversationProcessDisplayMode) => void
}

/** Full Settings-row props. */
export type DisplayModeRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<DisplayModeRowInjected>

const OPTIONS: readonly {
  id: ConversationProcessDisplayMode
  label: ConversationKey
}[] = [
  { id: 'full', label: 'settings.display.full' },
  { id: 'fold', label: 'settings.display.fold' },
  { id: 'conclusion', label: 'settings.display.conclusion' },
]

/**
 * Render the conversation process-display selector.
 * @param props - composed Settings slot props.
 * @returns the preference row.
 */
export function DisplayModeRow({ useDisplayMode, setDisplayMode, t }: DisplayModeRowProps) {
  const mode = useDisplayMode(value => value)
  const [open, setOpen] = useState(false)
  const selectedLabel = OPTIONS.find(option => option.id === mode)?.label
    ?? OPTIONS[0]?.label
    ?? 'settings.display.full'

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('settings.display.title')}</div>
        <div className={css.desc}>{t('settings.display.description')}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={OPTIONS.map(option => ({ id: option.id, label: t(option.label) }))}
        selectedId={mode}
        onSelect={(id) => {
          setOpen(false)
          setDisplayMode(id as ConversationProcessDisplayMode)
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(value => !value) }}
          >
            {t(selectedLabel)}
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}

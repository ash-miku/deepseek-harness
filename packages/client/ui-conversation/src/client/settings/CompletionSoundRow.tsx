/** General Settings row for the task-completion notification sound. */
import { useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import { Button, IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ConversationKey } from '../locales.ts'
import type { CompletionSoundSelection } from '../completion-sound.ts'
import type { CompletionSoundTone } from '../../submission-settings.ts'
import css from './CompletionSoundRow.module.css'

/** Registration-side completion-sound preference face. */
export interface CompletionSoundRowInjected {
  hooks: {
    /** Persisted enabled state bound as useCompletionSound. */
    completionSound: SnapshotStore<boolean>
    /** Persisted tone state bound as useCompletionSoundTone. */
    completionSoundTone: SnapshotStore<CompletionSoundTone>
  }
  /** Change the sound selection, including the explicit off option. */
  setCompletionSoundSelection: (selection: CompletionSoundSelection) => void
  /** Play the selected tone from the user's explicit Preview action. */
  previewCompletionSound: () => void
}

/** Full Settings-row props. */
export type CompletionSoundRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<CompletionSoundRowInjected>

const OPTIONS: readonly { id: CompletionSoundSelection; label: ConversationKey }[] = [
  { id: 'off', label: 'settings.completionSound.off' },
  { id: 'ding-dong', label: 'settings.completionSound.dingDong' },
  { id: 'bell', label: 'settings.completionSound.bell' },
  { id: 'chime', label: 'settings.completionSound.chime' },
]

/**
 * Render the completion-sound selector and Preview action.
 * @param props - settings row props and the injected preference face.
 * @returns the row element tree.
 */
export function CompletionSoundRow({
  useCompletionSound, useCompletionSoundTone, setCompletionSoundSelection, previewCompletionSound, t,
}: CompletionSoundRowProps) {
  const enabled = useCompletionSound(value => value)
  const tone = useCompletionSoundTone(value => value)
  const [open, setOpen] = useState(false)
  const selectedId: CompletionSoundSelection = enabled ? tone : 'off'
  const selectedLabel = OPTIONS.find(option => option.id === selectedId)?.label
    ?? 'settings.completionSound.off'

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('settings.completionSound.title')}</div>
        <div className={css.desc}>{t('settings.completionSound.description')}</div>
      </div>
      <div className={css.controls}>
        <Menu
          open={open}
          onClose={() => { setOpen(false) }}
          items={OPTIONS.map(option => ({ id: option.id, label: t(option.label) }))}
          selectedId={selectedId}
          onSelect={(id) => {
            setOpen(false)
            setCompletionSoundSelection(id as CompletionSoundSelection)
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
        <Button variant="outline" size="sm" onClick={previewCompletionSound}>
          {t('settings.completionSound.preview')}
        </Button>
      </div>
    </div>
  )
}

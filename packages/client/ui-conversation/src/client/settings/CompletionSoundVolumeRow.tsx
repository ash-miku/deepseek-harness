/** General Settings row for the task-completion notification volume. */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './CompletionSoundRow.module.css'

/** Registration-side completion-sound volume face. */
export interface CompletionSoundVolumeRowInjected {
  hooks: {
    /** Persisted volume percentage bound as useCompletionSoundVolume. */
    completionSoundVolume: SnapshotStore<number>
  }
  /** Change the application-level volume percentage. */
  setCompletionSoundVolume: (volume: number) => void
}

/** Full Settings-row props. */
export type CompletionSoundVolumeRowProps =
  PropsRuntime<'settings.general.item'>
  & PropsLocale<'conversation'>
  & InjectFace<CompletionSoundVolumeRowInjected>

/**
 * Render the completion-sound volume slider.
 * @param props - settings row props and the injected volume face.
 * @returns the row element tree.
 */
export function CompletionSoundVolumeRow({
  useCompletionSoundVolume, setCompletionSoundVolume, t,
}: CompletionSoundVolumeRowProps) {
  const volume = useCompletionSoundVolume(value => value)
  const valueLabel = t('settings.completionSound.volume.value', { value: String(volume) })
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('settings.completionSound.volume.title')}</div>
        <div className={css.desc}>{t('settings.completionSound.volume.description')}</div>
      </div>
      <div className={css.volumeControl}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={volume}
          aria-label={t('settings.completionSound.volume.title')}
          onChange={(event) => { setCompletionSoundVolume(Number(event.currentTarget.value)) }}
        />
        <span className={css.volumeValue}>{valueLabel}</span>
      </div>
    </div>
  )
}

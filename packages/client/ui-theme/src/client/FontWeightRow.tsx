/**
 * Font-weight preference row registered into the General section item slot:
 * title + description + a three-step segmented control (regular / medium /
 * semibold). Registered by this package — the theme feature owns the
 * interface base font weight the same way it owns the appearance preference
 * and the content font size. The selected step follows the persisted setting.
 */
import clsx from 'clsx'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { ThemeFontWeight } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createFontWeightRowStore } from './settings-store.ts'
import css from './FontWeightRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface FontWeightRowInjected {
  /** Change the interface base font weight. */
  setFontWeight: (weight: ThemeFontWeight) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type FontWeightRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createFontWeightRowStore>>
  & PropsLocale<'settings.theme'> & FontWeightRowInjected

/** Selectable steps in display order with their locale labels. */
const STEPS: readonly { weight: ThemeFontWeight; labelKey: ThemeKey }[] = [
  { weight: 400, labelKey: 'fontWeight.regular' },
  { weight: 500, labelKey: 'fontWeight.medium' },
  { weight: 600, labelKey: 'fontWeight.semibold' },
]

/**
 * Render the font-weight row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function FontWeightRow({ t, setFontWeight, useStore }: FontWeightRowComponentProps) {
  const fontWeight = useStore(s => s.fontWeight)
  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('fontWeight.title')}</div>
        <div className={css.desc}>{t('fontWeight.description')}</div>
      </div>
      <div className={css.control} role="group" aria-label={t('fontWeight.title')}>
        {STEPS.map(({ weight, labelKey }) => (
          <button
            key={weight}
            type="button"
            className={clsx(css.step, fontWeight === weight && css.selected)}
            aria-pressed={fontWeight === weight}
            onClick={() => { setFontWeight(weight) }}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30012 'Frame 2117131228'): theme preference cubes plus a compact
 * font-scale segmented row. Selection follows the persisted preference, never
 * the resolved active theme.
 */
import clsx from 'clsx'
import {
  IconDarkOutline16, IconFollowsystemOutline16, IconLightOutline16,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { FontScalePreference, ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
  /** Switch the font scale. */
  setFontScale: (id: FontScalePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Cube order and icons (figma 501:30015-30017: Light, Dark, System). */
const CUBES: readonly { id: ThemePreference; labelKey: ThemeKey; Icon: typeof IconLightOutline16 }[] = [
  { id: 'light', labelKey: 'appearance.light', Icon: IconLightOutline16 },
  { id: 'dark', labelKey: 'appearance.dark', Icon: IconDarkOutline16 },
  { id: 'system', labelKey: 'appearance.system', Icon: IconFollowsystemOutline16 },
]

/** Font-scale order and labels. */
const FONT_SCALES: readonly { id: FontScalePreference; labelKey: ThemeKey }[] = [
  { id: 'small', labelKey: 'fontSize.small' },
  { id: 'normal', labelKey: 'fontSize.normal' },
  { id: 'large', labelKey: 'fontSize.large' },
  { id: 'xlarge', labelKey: 'fontSize.xlarge' },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, setFontScale, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const fontScale = useStore(s => s.fontScale)
  return (
    <>
      <div className={css.group}>
        <div className={css.title}>{t('appearance.title')}</div>
        <div className={css.cubeRow}>
          {CUBES.map(({ id, labelKey, Icon }) => (
            <button
              key={id}
              type="button"
              className={clsx(css.themeCube, preference === id && css.selected)}
              aria-pressed={preference === id}
              onClick={() => { setTheme(id) }}
            >
              <Icon />
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
      <div className={css.group}>
        <div className={css.title}>{t('fontSize.title')}</div>
        <div className={css.fontScaleRow}>
          {FONT_SCALES.map(({ id, labelKey }) => (
            <button
              key={id}
              type="button"
              className={clsx(css.fontScaleChip, fontScale === id && css.selected)}
              aria-pressed={fontScale === id}
              onClick={() => { setFontScale(id) }}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

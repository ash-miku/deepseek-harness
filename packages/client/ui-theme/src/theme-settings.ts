/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Built-in font-scale preferences accepted at the settings boundaries. */
export const FONT_SCALES = ['small', 'normal', 'large', 'xlarge'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the selected built-in font scale. */
export const FONT_SCALE_FIELD = 'fontScale'

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Font scale persisted by the product Appearance row. */
export type FontScalePreference = typeof FONT_SCALES[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Default font scale when the user-settings document has no override. */
export const DEFAULT_FONT_SCALE: FontScalePreference = 'normal'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** Selected font scale. */
  fontScale: FontScalePreference
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [FONT_SCALE_FIELD]: z.union([...FONT_SCALES]).default(DEFAULT_FONT_SCALE),
})

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}

/**
 * Narrow one wire or registry value to a persistable font scale.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in font scale.
 */
export function isFontScale(value: unknown): value is FontScalePreference {
  return FONT_SCALES.some(fontScale => fontScale === value)
}

/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the conversation content font size. */
export const FONT_SIZE_FIELD = 'fontSize'

/** Field carrying the interface base font weight. */
export const FONT_WEIGHT_FIELD = 'fontWeight'

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Smallest accepted content font size (px). */
export const FONT_SIZE_MIN = 12

/** Largest accepted content font size (px). */
export const FONT_SIZE_MAX = 17

/** Content font size when the user-settings document has no override (px). */
export const DEFAULT_FONT_SIZE = 14

/**
 * Selectable base font weights. Limited to the standard steps the interface
 * fonts expose (regular/medium/semibold): the design system deliberately
 * avoids intermediate weights, which non-variable fonts snap unpredictably.
 */
export const FONT_WEIGHTS = [400, 500, 600] as const

/** Base font weight persisted by the product Font-weight row. */
export type ThemeFontWeight = typeof FONT_WEIGHTS[number]

/** Base font weight when the user-settings document has no override. */
export const DEFAULT_FONT_WEIGHT: ThemeFontWeight = 500

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** Conversation content font size in px (integer within {@link FONT_SIZE_MIN}..{@link FONT_SIZE_MAX}). */
  fontSize: number
  /** Interface base font weight ({@link FONT_WEIGHTS}). */
  fontWeight: ThemeFontWeight
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [FONT_SIZE_FIELD]: z.number().step(1).min(FONT_SIZE_MIN).max(FONT_SIZE_MAX).default(DEFAULT_FONT_SIZE),
  [FONT_WEIGHT_FIELD]: z.union([...FONT_WEIGHTS]).default(DEFAULT_FONT_WEIGHT),
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
 * Narrow one wire or registry value to a persistable font weight.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a selectable base font weight.
 */
export function isThemeFontWeight(value: unknown): value is ThemeFontWeight {
  return FONT_WEIGHTS.some(weight => weight === value)
}

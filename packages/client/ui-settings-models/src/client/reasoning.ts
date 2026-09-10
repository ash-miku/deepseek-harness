/**
 * Per-model thinking levels as the model rows edit them.
 *
 * The profile field is a dict mapping each offered level to the spelling the
 * wire protocol should send. `off` is the one level that may map to `null`
 * (supported, send nothing); every other level needs a non-empty string.
 * `false` declares a non-reasoning model, and absence inherits the installed
 * catalog's capability (a hand-declared model has none).
 */

/** Every pi-ai thinking level, in its canonical escalation order. */
export const REASONING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const

/** One level from {@link REASONING_LEVELS}. */
export type ReasoningLevel = (typeof REASONING_LEVELS)[number]

/** Level -> wire spelling; `off` may carry `null` to mean "send nothing". */
export type ReasoningEfforts = Partial<Record<ReasoningLevel, string | null>>

/** The field value a model row can carry. */
export type ModelReasoningEfforts = false | ReasoningEfforts | undefined

/** The declaration mode a model row renders. */
export type ReasoningMode = 'inherit' | 'none' | 'declared'

/**
 * The canonical spelling shown for one level.
 * @param level - the level to spell.
 * @returns the capitalized level name.
 */
export function levelName(level: ReasoningLevel): string {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`
}

/** Narrow an object value to the reasoning-declaration shape. */
function isReasoningEfforts(value: unknown): value is ReasoningEfforts {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The stored declaration of one model row, or `undefined` when it is absent or unreadable.
 * @param model - the model row to read, or undefined when no row is selected.
 * @returns the row's `reasoningEfforts` value, or undefined when it is absent or unreadable.
 */
export function reasoningEffortsOf(model: Record<string, unknown> | undefined): ModelReasoningEfforts {
  if (model === undefined) return undefined
  const value = model['reasoningEfforts']
  if (value === false || value === undefined) return value
  if (isReasoningEfforts(value)) return value
  return undefined
}

/**
 * The mode the row's select should show for a stored declaration.
 * @param efforts - the stored declaration, as {@link reasoningEffortsOf} returns it.
 * @returns the declaration mode the row renders.
 */
export function reasoningModeOf(efforts: ModelReasoningEfforts): ReasoningMode {
  if (efforts === false) return 'none'
  if (typeof efforts === 'object') return 'declared'
  return 'inherit'
}

/**
 * Whether a declaration is one the adapter will serve.
 * @param value - the stored `reasoningEfforts` value, or undefined when unset.
 * @returns false only when the declaration is invalid.
 */
export function reasoningEffortsValid(value: unknown): boolean {
  if (value === undefined || value === false) return true
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const efforts = value as Record<string, unknown>
  const keys = Object.keys(efforts)
  if (keys.length === 0) return false
  if (!keys.some(key => key !== 'off')) return false
  return keys.every((key) => {
    if (!REASONING_LEVELS.includes(key as ReasoningLevel)) return false
    const wire = efforts[key]
    if (wire === null) return key === 'off'
    return typeof wire === 'string' && wire.length > 0
  })
}

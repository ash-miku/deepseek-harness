/**
 * Wire contract shared by the Git changes Host routes and the browser view.
 * The Host owns Git execution; the browser only reads this narrow vocabulary.
 */

/** Authenticated route returning one Session workspace's repository status. */
export const GIT_STATUS_PATH = '/api/git-changes/status'

/** Authenticated route returning one file's unified diff. */
export const GIT_DIFF_PATH = '/api/git-changes/diff'

/** Change classification rendered as the file list's status letter. */
export type GitChangeKind =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typechange'
  | 'unmerged'
  | 'untracked'

/** One changed path in the workspace. */
export interface GitChange {
  /** Repository-relative path of the current file. */
  readonly path: string
  /** Previous path for a rename or copy. */
  readonly origPath?: string
  readonly kind: GitChangeKind
  /** The index side carries a change. */
  readonly staged: boolean
  /** The working-tree side carries a change. */
  readonly unstaged: boolean
  /** Added lines in this file's diff; absent for an untracked or binary file. */
  readonly additions?: number
  /** Removed lines in this file's diff; absent for an untracked or binary file. */
  readonly deletions?: number
}

/** Repository status shown by the Changes tab. */
export interface GitStatusValue {
  readonly repo: true
  /** Absolute repository top-level directory. */
  readonly root: string
  /** Current branch name, or null while HEAD is detached. */
  readonly branch: string | null
  readonly detached: boolean
  /** Changed paths, sorted by path. */
  readonly changes: readonly GitChange[]
  /** Local branch names, newest commit first. */
  readonly branches: readonly string[]
}

/** Answer for a workspace that is not a Git repository. */
export interface GitUnavailable {
  readonly repo: false
  readonly message: string
}

export type GitStatusResult = GitStatusValue | GitUnavailable

/** One file's diff: unified text plus display metadata. */
export interface GitDiffValue {
  /** Repository-relative path this diff describes. */
  readonly path: string
  /** Comparison base branch, or null for the uncommitted working tree. */
  readonly base: string | null
  /** Unified diff text; empty when nothing differs. */
  readonly unified: string
  /** The change is not text-diffable. */
  readonly binary: boolean
  /** The diff was cut at the Host's size cap. */
  readonly truncated: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validate a status payload received over HTTP.
 * @param value - decoded response body.
 * @returns whether every rendered field has a supported shape.
 */
export function isGitStatusResult(value: unknown): value is GitStatusResult {
  if (!isRecord(value) || typeof value.repo !== 'boolean') return false
  if (!value.repo) return typeof value.message === 'string'
  if (typeof value.root !== 'string' || typeof value.detached !== 'boolean') return false
  if (value.branch !== null && typeof value.branch !== 'string') return false
  if (!Array.isArray(value.changes) || !Array.isArray(value.branches)) return false
  if (!value.branches.every(branch => typeof branch === 'string')) return false
  return value.changes.every(change => isGitChange(change))
}

function isGitChange(value: unknown): value is GitChange {
  if (!isRecord(value)) return false
  if (typeof value.path !== 'string' || typeof value.kind !== 'string') return false
  if (value.origPath !== undefined && typeof value.origPath !== 'string') return false
  if (typeof value.staged !== 'boolean' || typeof value.unstaged !== 'boolean') return false
  if (value.additions !== undefined && (typeof value.additions !== 'number' || !Number.isSafeInteger(value.additions))) return false
  if (value.deletions !== undefined && (typeof value.deletions !== 'number' || !Number.isSafeInteger(value.deletions))) return false
  return (KINDS as readonly string[]).includes(value.kind)
}

const KINDS: readonly GitChangeKind[] = [
  'added', 'modified', 'deleted', 'renamed', 'copied', 'typechange', 'unmerged', 'untracked',
]

/**
 * Validate a diff payload received over HTTP.
 * @param value - decoded response body.
 * @returns whether every rendered field has a supported shape.
 */
export function isGitDiffValue(value: unknown): value is GitDiffValue {
  if (!isRecord(value)) return false
  if (typeof value.path !== 'string' || typeof value.unified !== 'string') return false
  if (value.base !== null && typeof value.base !== 'string') return false
  if (typeof value.binary !== 'boolean' || typeof value.truncated !== 'boolean') return false
  return true
}

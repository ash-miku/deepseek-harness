/** Bounded Git process execution and input validation for the changes routes. */
import { execFile } from 'node:child_process'
import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, join, normalize, sep } from 'node:path'

/** Captured result of one Git invocation; a non-zero exit stays data, not a rejection. */
export interface GitResult {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
}

/** Largest single Git capture; a diff beyond this is truncated by the caller. */
const MAX_BUFFER = 64 * 1024 * 1024

/** Largest untracked file embedded as a synthesized diff. */
export const MAX_UNTRACKED_BYTES = 2 * 1024 * 1024

/**
 * Run one Git command under an explicit working directory without a shell.
 * @param cwd - directory passed to `git -C`.
 * @param args - argument vector, never concatenated into a shell string.
 * @param signal - caller cancellation.
 * @returns the exit code plus captured stdout/stderr.
 */
export function git(cwd: string, args: readonly string[], signal?: AbortSignal): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile('git', ['-C', cwd, ...args], {
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8',
      signal,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat', GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' },
    }, (error, stdout, stderr) => {
      const code = error === null
        ? 0
        : typeof (error as { code?: unknown }).code === 'number'
          ? (error as { code: number }).code
          : 1
      resolve({ code, stdout, stderr })
    })
  })
}

/**
 * Whether a browser-supplied path is safe to pass to Git as a repository pathspec.
 * @param path - repository-relative path.
 * @returns true for a non-absolute, non-parent, non-option path.
 */
export function validRepoPath(path: string): boolean {
  if (path.length === 0 || path.includes('\0')) return false
  if (path.startsWith('-') || path.startsWith('/') || path.startsWith('\\')) return false
  if (isAbsolute(path)) return false
  return !path.split(/[\\/]/).includes('..')
}

/** Refs accepted as a comparison base: a local branch or lightweight tag name. */
const REF_PATTERN = /^[A-Za-z0-9._][A-Za-z0-9._/-]*$/

/**
 * Whether a browser-supplied string is safe to pass as a single revision argument.
 * @param ref - candidate ref name.
 * @returns true when the name cannot be read as an option or revision range escape.
 */
export function validRef(ref: string): boolean {
  if (!REF_PATTERN.test(ref)) return false
  if (ref.includes('..') || ref.includes('@{') || ref.endsWith('/') || ref.endsWith('.')) return false
  return true
}

/** Resolve a repository-relative path against the verified repository root. */
function absoluteIn(root: string, path: string): string {
  const target = normalize(join(root, path))
  const prefix = root.endsWith(sep) ? root : root + sep
  return target.startsWith(prefix) ? target : root
}

/**
 * Synthesize a unified diff for an untracked text file, mirroring git's new-file form.
 * @param root - verified repository top-level.
 * @param path - repository-relative path.
 * @returns unified diff text, or a binary marker; null when the file is unreadable.
 */
export async function untrackedDiff(root: string, path: string): Promise<{ unified: string; binary: boolean } | null> {
  const absolute = absoluteIn(root, path)
  try {
    const info = await stat(absolute)
    if (!info.isFile()) return null
    const buffer = await readFile(absolute)
    if (buffer.subarray(0, 8000).includes(0)) return { unified: '', binary: true }
    let text = buffer.toString('utf8')
    const truncated = text.length > MAX_UNTRACKED_BYTES
    if (truncated) text = text.slice(0, MAX_UNTRACKED_BYTES)
    const body = text.endsWith('\n') ? text.slice(0, -1) : text
    const lines = body === '' ? [] : body.split('\n')
    const header = `diff --git a/${path} b/${path}\nnew file mode 100644\n--- /dev/null\n+++ b/${path}\n`
    const hunk = `@@ -0,0 +${lines.length === 0 ? 0 : `1,${lines.length}`} @@\n`
    const applied = lines.map(line => `+${line}`).join('\n')
    return { unified: applied === '' ? header + hunk : `${header}${hunk}${applied}\n`, binary: false }
  } catch {
    return null
  }
}

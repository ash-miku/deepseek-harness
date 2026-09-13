/** Unified-diff parsing and inline/split row projection for the Changes view. */

/** Layout selected in the toolbar. */
export type DiffMode = 'inline' | 'split'

/** One parsed row of a unified diff, carrying each side's line number. */
export type DiffRow =
  | { readonly kind: 'hunk'; readonly text: string }
  | {
    readonly kind: 'context' | 'add' | 'del' | 'meta'
    readonly oldLine: number | null
    readonly newLine: number | null
    readonly text: string
  }

/** One side of a split row; `empty` fills the shorter side of a change block. */
export interface SplitCell {
  readonly kind: 'context' | 'add' | 'del' | 'empty'
  readonly line: number | null
  readonly text: string
}

/** A split row is either a hunk header or an aligned left/right pair. */
export type SplitRow =
  | { readonly kind: 'hunk'; readonly text: string }
  | { readonly kind: 'pair'; readonly left: SplitCell; readonly right: SplitCell }

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/** Lines git emits as file metadata rather than hunk content. */
function isFileHeader(line: string): boolean {
  return line.startsWith('diff --git ')
    || line.startsWith('index ')
    || line.startsWith('--- ')
    || line.startsWith('+++ ')
    || line.startsWith('new file mode ')
    || line.startsWith('deleted file mode ')
    || line.startsWith('old mode ')
    || line.startsWith('new mode ')
    || line.startsWith('similarity index ')
    || line.startsWith('rename from ')
    || line.startsWith('rename to ')
    || line.startsWith('copy from ')
    || line.startsWith('copy to ')
}

/**
 * Parse unified diff text into renderable rows.
 * @param unified - diff text produced by git.
 * @returns hunk headers and content rows in file order.
 */
export function parseUnified(unified: string): DiffRow[] {
  if (unified === '') return []
  const rows: DiffRow[] = []
  let oldLine = 0
  let newLine = 0
  for (const line of unified.split('\n')) {
    if (line.startsWith('@@')) {
      const match = HUNK_HEADER.exec(line)
      if (match !== null) {
        oldLine = Number(match[1])
        newLine = Number(match[3])
      }
      rows.push({ kind: 'hunk', text: line })
      continue
    }
    if (isFileHeader(line) || line.startsWith('Binary files ')) continue
    if (line.startsWith('\\')) {
      rows.push({ kind: 'meta', oldLine: null, newLine: null, text: line })
      continue
    }
    if (line.startsWith('+')) {
      rows.push({ kind: 'add', oldLine: null, newLine, text: line.slice(1) })
      newLine += 1
      continue
    }
    if (line.startsWith('-')) {
      rows.push({ kind: 'del', oldLine, newLine: null, text: line.slice(1) })
      oldLine += 1
      continue
    }
    if (line.startsWith(' ')) {
      rows.push({ kind: 'context', oldLine, newLine, text: line.slice(1) })
      oldLine += 1
      newLine += 1
      continue
    }
    if (line === '') continue
    rows.push({ kind: 'meta', oldLine: null, newLine: null, text: line })
  }
  return rows
}

/**
 * Align parsed rows into left/right pairs; a change block pairs its deletions
 * and additions index by index, and the longer side is padded with empties.
 * @param rows - parsed inline rows.
 * @returns hunk headers and aligned pairs.
 */
export function toSplit(rows: readonly DiffRow[]): SplitRow[] {
  const out: SplitRow[] = []
  let index = 0
  while (index < rows.length) {
    const row = rows[index]
    if (row === undefined) break
    if (row.kind === 'hunk') {
      out.push({ kind: 'hunk', text: row.text })
      index += 1
      continue
    }
    if (row.kind === 'context') {
      out.push({
        kind: 'pair',
        left: { kind: 'context', line: row.oldLine, text: row.text },
        right: { kind: 'context', line: row.newLine, text: row.text },
      })
      index += 1
      continue
    }
    if (row.kind === 'meta') {
      out.push({
        kind: 'pair',
        left: { kind: 'context', line: null, text: row.text },
        right: { kind: 'context', line: null, text: row.text },
      })
      index += 1
      continue
    }
    const deletions: { readonly line: number | null; readonly text: string }[] = []
    const additions: { readonly line: number | null; readonly text: string }[] = []
    for (;;) {
      const row = rows[index]
      if (row === undefined || row.kind !== 'del') break
      deletions.push({ line: row.oldLine, text: row.text })
      index += 1
    }
    for (;;) {
      const row = rows[index]
      if (row === undefined || row.kind !== 'add') break
      additions.push({ line: row.newLine, text: row.text })
      index += 1
    }
    const pairs = Math.max(deletions.length, additions.length)
    for (let offset = 0; offset < pairs; offset += 1) {
      const deletion = deletions[offset]
      const addition = additions[offset]
      out.push({
        kind: 'pair',
        left: deletion === undefined
          ? { kind: 'empty', line: null, text: '' }
          : { kind: 'del', line: deletion.line, text: deletion.text },
        right: addition === undefined
          ? { kind: 'empty', line: null, text: '' }
          : { kind: 'add', line: addition.line, text: addition.text },
      })
    }
  }
  return out
}

/**
 * Total added and removed lines across parsed rows.
 * @param rows - parsed inline rows.
 * @returns the counts shown in the footer.
 */
export function diffTotals(rows: readonly DiffRow[]): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const row of rows) {
    if (row.kind === 'add') added += 1
    else if (row.kind === 'del') removed += 1
  }
  return { added, removed }
}

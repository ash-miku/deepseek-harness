/** Unified-diff parsing and split alignment for the Changes view. */
import { describe, expect, it } from 'vitest'
import { diffTotals, parseUnified, toSplit } from '../src/client/diff-model.ts'

const SAMPLE = [
  'diff --git a/x.ts b/x.ts',
  'index 111..222 100644',
  '--- a/x.ts',
  '+++ b/x.ts',
  '@@ -1,3 +1,4 @@',
  ' const a = 1',
  '-const b = 2',
  '+const b = 3',
  '+const extra = 4',
  ' const c = 5',
].join('\n')

describe('parseUnified', () => {
  it('projects hunks with both line numbers and drops file headers', () => {
    const rows = parseUnified(SAMPLE)
    expect(rows[0]).toEqual({ kind: 'hunk', text: '@@ -1,3 +1,4 @@' })
    expect(rows[1]).toMatchObject({ kind: 'context', oldLine: 1, newLine: 1, text: 'const a = 1' })
    expect(rows[2]).toMatchObject({ kind: 'del', oldLine: 2, newLine: null, text: 'const b = 2' })
    expect(rows[3]).toMatchObject({ kind: 'add', oldLine: null, newLine: 2, text: 'const b = 3' })
    expect(rows[5]).toMatchObject({ kind: 'context', oldLine: 3, newLine: 4, text: 'const c = 5' })
    expect(diffTotals(rows)).toEqual({ added: 2, removed: 1 })
  })

  it('returns nothing for empty text', () => {
    expect(parseUnified('')).toEqual([])
  })
})

describe('toSplit', () => {
  it('pairs each deletion with an addition and pads the longer side', () => {
    const pairs = toSplit(parseUnified(SAMPLE)).filter(row => row.kind === 'pair')
    expect(pairs).toHaveLength(4)
    expect(pairs[1]).toMatchObject({
      left: { kind: 'del', line: 2, text: 'const b = 2' },
      right: { kind: 'add', line: 2, text: 'const b = 3' },
    })
    expect(pairs[2]).toMatchObject({
      left: { kind: 'empty', line: null, text: '' },
      right: { kind: 'add', line: 3, text: 'const extra = 4' },
    })
  })
})

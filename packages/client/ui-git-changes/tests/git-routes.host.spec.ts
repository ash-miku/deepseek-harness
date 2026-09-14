/** Change parsing plus an end-to-end status/diff read against a real Git repository. */
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GIT_DIFF_PATH, GIT_STATUS_PATH } from '../src/git-contract.ts'
import { parseNameStatusZ, parseNumstatZ, parseStatusZ, registerGitChanges } from '../src/git-routes.ts'

const run = promisify(execFile)

describe('parseStatusZ', () => {
  it('classifies staged, unstaged, untracked, and renamed entries', () => {
    const changes = parseStatusZ('M  a.ts\0 M b.ts\0?? c.ts\0MM d.ts\0R  new.ts\0old.ts\0')
    expect(changes.map(change => [change.path, change.kind, change.staged, change.unstaged])).toEqual([
      ['a.ts', 'modified', true, false],
      ['b.ts', 'modified', false, true],
      ['c.ts', 'untracked', false, true],
      ['d.ts', 'modified', true, true],
      ['new.ts', 'renamed', true, false],
    ])
    expect(changes[4]?.origPath).toBe('old.ts')
  })
})

describe('parseNameStatusZ', () => {
  it('carries the previous path for a rename', () => {
    const changes = parseNameStatusZ('M\0a.ts\0D\0b.ts\0R100\0old.ts\0new.ts\0')
    expect(changes.map(change => [change.path, change.kind, change.origPath])).toEqual([
      ['a.ts', 'modified', undefined],
      ['b.ts', 'deleted', undefined],
      ['new.ts', 'renamed', 'old.ts'],
    ])
  })
})

describe('parseNumstatZ', () => {
  it('parses text counts, the binary marker, and the rename form', () => {
    const stats = parseNumstatZ('4\t36\ta.ts\u0000-\t-\tb.bin\u0000\t0\t\u0000old.ts\u0000new.ts\u0000')
    expect(stats.get('a.ts')).toEqual({ additions: 4, deletions: 36 })
    expect(stats.get('b.bin')).toEqual({})
    expect(stats.get('new.ts')).toEqual({ additions: 0, deletions: 0 })
  })
})

interface Captured {
  readonly path: string
  readonly fetch: (request: Request) => Promise<Response>
}

function routeFixture(cwd: string): Map<string, Captured> {
  const captured = new Map<string, Captured>()
  const ctx = {
    connection: { fetch: { register: (definition: Captured) => { captured.set(definition.path, definition) } } },
    sessionController: { list: async () => ({ items: [{ sessionId: 'owner', cwd }] }) },
    sandboxPolicy: { workspaceRoot: cwd },
    effect: () => {},
  }
  registerGitChanges(ctx as never)
  return captured
}

describe('git changes routes', () => {
  let root = ''
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-git-changes-'))
    await run('git', ['-C', root, 'init', '-q', '-b', 'main'])
    await writeFile(join(root, 'a.txt'), 'one\n')
    await run('git', ['-C', root, 'add', '.'])
    await run('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init'])
    await run('git', ['-C', root, 'branch', 'base'])
    await writeFile(join(root, 'a.txt'), 'one\ntwo\n')
    await writeFile(join(root, 'b.txt'), 'new\n')
  })
  afterEach(async () => { await rm(root, { recursive: true, force: true }) })

  it('counts staged and unstaged edits once and counts new text without binary lines', async () => {
    await run('git', ['-C', root, 'add', 'a.txt'])
    await writeFile(join(root, 'a.txt'), 'one\nthree\nfour\n')
    await writeFile(join(root, 'b.txt'), 'new\nlast')
    await writeFile(join(root, 'empty.txt'), '')
    await writeFile(join(root, 'binary.bin'), Buffer.from([0, 1, 2]))
    const route = routeFixture(root).get(GIT_STATUS_PATH)!
    const result = await (await route.fetch(new Request(`http://localhost${GIT_STATUS_PATH}?sessionId=owner`))).json()
    expect(result.changes).toEqual([
      expect.objectContaining({ path: 'a.txt', staged: true, unstaged: true, additions: 2, deletions: 0 }),
      expect.objectContaining({ path: 'b.txt', additions: 2, deletions: 0 }),
      { path: 'binary.bin', kind: 'untracked', staged: false, unstaged: true },
      expect.objectContaining({ path: 'empty.txt' }),
    ])
  })

  it('counts working-tree text before the first commit', async () => {
    await run('git', ['-C', root, 'checkout', '--orphan', 'unborn'])
    await run('git', ['-C', root, 'add', 'a.txt'])
    await writeFile(join(root, 'a.txt'), 'one\ntwo\nthree\n')
    const route = routeFixture(root).get(GIT_STATUS_PATH)!
    const response = await route.fetch(new Request(`http://localhost${GIT_STATUS_PATH}?sessionId=owner`))
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.changes).toContainEqual(expect.objectContaining({ path: 'a.txt', additions: 3, deletions: 0 }))
  })

  it('reports the repository, its changes, and an untracked diff', async () => {
    const routes = routeFixture(root)
    const statusFetch = routes.get(GIT_STATUS_PATH)
    expect(statusFetch).toBeDefined()
    const status = await (await statusFetch!.fetch(new Request(`http://localhost${GIT_STATUS_PATH}?sessionId=owner`))).json() as {
      repo: boolean
      branch: string
      changes: Array<{ path: string; kind: string }>
    }
    expect(status.repo).toBe(true)
    expect(status.branch).toBe('main')
    expect(status.changes).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'a.txt', kind: 'modified', additions: 1, deletions: 0 }),
      expect.objectContaining({ path: 'b.txt', kind: 'untracked', additions: 1, deletions: 0 }),
    ]))

    const diffFetch = routes.get(GIT_DIFF_PATH)!
    const modified = await (await diffFetch.fetch(new Request(`http://localhost${GIT_DIFF_PATH}?${new URLSearchParams({ sessionId: 'owner', path: 'a.txt' })}`))).json() as { unified: string }
    expect(modified.unified).toContain('+two')
    const untracked = await (await diffFetch.fetch(new Request(`http://localhost${GIT_DIFF_PATH}?${new URLSearchParams({ sessionId: 'owner', path: 'b.txt' })}`))).json() as { unified: string }
    expect(untracked.unified).toContain('+new')
  })

  it('compares against a named base branch', async () => {
    await run('git', ['-C', root, 'add', '.'])
    await run('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'second'])
    const routes = routeFixture(root)
    const status = await (await routes.get(GIT_STATUS_PATH)!.fetch(new Request(
      `http://localhost${GIT_STATUS_PATH}?${new URLSearchParams({ sessionId: 'owner', base: 'base' })}`))).json() as { changes: Array<{ path: string }> }
    expect(status.changes.map(change => change.path).sort()).toEqual(['a.txt', 'b.txt'])
  })

  it('rejects a parent-escaping path before touching Git', async () => {
    const routes = routeFixture(root)
    const response = await routes.get(GIT_DIFF_PATH)!.fetch(new Request(
      `http://localhost${GIT_DIFF_PATH}?${new URLSearchParams({ sessionId: 'owner', path: '../etc/passwd' })}`))
    expect(response.status).toBe(400)
  })

  it('caps a large tracked change list and reports the untruncated total', async () => {
    for (let index = 0; index < 101; index += 1) await writeFile(join(root, `t${index}.txt`), 'x\n')
    await run('git', ['-C', root, 'add', '.'])
    await run('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'bulk'])
    for (let index = 0; index < 101; index += 1) await writeFile(join(root, `t${index}.txt`), 'x\ny\n')
    const route = routeFixture(root).get(GIT_STATUS_PATH)!
    const result = await (await route.fetch(new Request(`http://localhost${GIT_STATUS_PATH}?sessionId=owner`))).json() as {
      total: number
      truncated: boolean
      changes: Array<{ kind: string }>
    }
    expect(result.total).toBe(101)
    expect(result.truncated).toBe(true)
    expect(result.changes).toHaveLength(100)
    expect(result.changes.every(change => change.kind === 'modified')).toBe(true)
  })

  it('keeps tracked changes inside the cap when untracked paths would fill it', async () => {
    for (let index = 0; index < 130; index += 1) await writeFile(join(root, `u${String(index).padStart(3, '0')}.txt`), 'x\n')
    const route = routeFixture(root).get(GIT_STATUS_PATH)!
    const result = await (await route.fetch(new Request(`http://localhost${GIT_STATUS_PATH}?sessionId=owner`))).json() as {
      total: number
      truncated: boolean
      changes: Array<{ path: string; kind: string }>
    }
    expect(result.total).toBe(132)
    expect(result.truncated).toBe(true)
    expect(result.changes).toHaveLength(100)
    expect(result.changes[0]).toMatchObject({ path: 'a.txt', kind: 'modified' })
  })
})

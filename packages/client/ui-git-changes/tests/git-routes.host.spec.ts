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
      expect.objectContaining({ path: 'b.txt', kind: 'untracked' }),
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
})

/** Authenticated Host routes answering Git changes for one Session workspace. */
import { devNull } from 'node:os'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  GIT_DIFF_PATH, GIT_STATUS_PATH,
  type GitChange, type GitChangeKind, type GitDiffValue, type GitStatusResult, type GitUnavailable,
} from './git-contract.ts'
import { git, untrackedDiff, validRef, validRepoPath } from './git-service.ts'

const NO_STORE = { 'cache-control': 'no-store' } as const

/** Read the required Session identity from a query string. */
function readSessionId(query: URLSearchParams): SessionId | null {
  const value = query.get('sessionId')
  return value === null || value.length === 0 ? null : value as SessionId
}

function kindOf(letter: string): GitChangeKind {
  switch (letter) {
    case 'A': return 'added'
    case 'D': return 'deleted'
    case 'R': return 'renamed'
    case 'C': return 'copied'
    case 'T': return 'typechange'
    case 'U': return 'unmerged'
    case '?': return 'untracked'
    default: return 'modified'
  }
}

/**
 * Parse `git status --porcelain=v1 -z` into change rows.
 * @param raw - NUL-separated output.
 * @returns one row per changed path.
 */
export function parseStatusZ(raw: string): GitChange[] {
  const tokens = raw.split('\0')
  const changes: GitChange[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const entry = tokens[index]
    if (entry === undefined || entry.length < 4) continue
    const stagedLetter = entry[0] ?? ' '
    const worktreeLetter = entry[1] ?? ' '
    const path = entry.slice(3)
    if (stagedLetter === '!' && worktreeLetter === '!') continue
    if (stagedLetter === '?' && worktreeLetter === '?') {
      changes.push({ path, kind: 'untracked', staged: false, unstaged: true })
      continue
    }
    let origPath: string | undefined
    if (stagedLetter === 'R' || stagedLetter === 'C') {
      const previous = tokens[index + 1]
      if (previous !== undefined && previous.length > 0) origPath = previous
      index += 1
    }
    const staged = stagedLetter !== ' ' && stagedLetter !== '?'
    const unstaged = worktreeLetter !== ' ' && worktreeLetter !== '?'
    changes.push({
      path,
      ...origPath === undefined ? {} : { origPath },
      kind: kindOf(unstaged ? worktreeLetter : stagedLetter),
      staged,
      unstaged,
    })
  }
  return changes
}

/**
 * Parse `git diff --name-status -z` into change rows for a branch comparison.
 * @param raw - NUL-separated output.
 * @returns one row per changed path.
 */
export function parseNameStatusZ(raw: string): GitChange[] {
  const tokens = raw.split('\0').filter(token => token.length > 0)
  const changes: GitChange[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === undefined) continue
    const letter = token[0] ?? 'M'
    if (letter === 'R' || letter === 'C') {
      const origPath = tokens[index + 1]
      const path = tokens[index + 2]
      index += 2
      if (path === undefined) break
      changes.push({ path, ...origPath === undefined ? {} : { origPath }, kind: kindOf(letter), staged: true, unstaged: true })
      continue
    }
    const path = tokens[index + 1]
    index += 1
    if (path === undefined) break
    changes.push({ path, kind: kindOf(letter), staged: true, unstaged: true })
  }
  return changes
}

/**
 * Parse `git diff --numstat -z` into per-path added/removed counts.
 * @param raw - NUL-separated output; a rename carries an empty path then old/new.
 * @returns a map keyed by the current path.
 */
export function parseNumstatZ(raw: string): Map<string, { additions?: number; deletions?: number }> {
  const stats = new Map<string, { additions?: number; deletions?: number }>()
  const tokens = raw.split('\0')
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    if (token === undefined || token === '') continue
    const firstTab = token.indexOf('\t')
    const secondTab = token.indexOf('\t', firstTab + 1)
    if (firstTab < 0 || secondTab < 0) continue
    const added = token.slice(0, firstTab)
    const deleted = token.slice(firstTab + 1, secondTab)
    let path = token.slice(secondTab + 1)
    if (path === '') {
      path = tokens[index + 2] ?? ''
      index += 2
    }
    if (path === '') continue
    stats.set(path, {
      ...added === '-' ? {} : { additions: Number(added) },
      ...deleted === '-' ? {} : { deletions: Number(deleted) },
    })
  }
  return stats
}

/** Attach numstat counts to the matching change rows in place. */
function applyNumstat(changes: GitChange[], raw: string): void {
  const stats = parseNumstatZ(raw)
  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index]
    if (change === undefined) continue
    const stat = stats.get(change.path)
    if (stat === undefined) continue
    changes[index] = { ...change, ...stat }
  }
}

interface RepoInfo {
  readonly root: string
  readonly branch: string | null
  readonly branches: readonly string[]
}

/** Resolve the Session workspace and probe whether it is a Git repository. */
async function resolveRepo(ctx: Context, sessionId: SessionId, signal: AbortSignal): Promise<RepoInfo | null> {
  const list = await ctx.sessionController.list({}, signal)
  const cwd = list.items.find(item => item.sessionId === sessionId)?.cwd ?? ctx.sandboxPolicy.workspaceRoot
  const top = await git(cwd, ['rev-parse', '--show-toplevel'], signal)
  if (top.code !== 0 || top.stdout.trim() === '') return null
  const root = top.stdout.trim()
  const branchResult = await git(root, ['symbolic-ref', '--short', '-q', 'HEAD'], signal)
  const branch = branchResult.code === 0 && branchResult.stdout.trim() !== '' ? branchResult.stdout.trim() : null
  const branchesResult = await git(root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads'], signal)
  const branches = branchesResult.stdout.split('\n').map(name => name.trim()).filter(name => name !== '')
  return { root, branch, branches }
}

/** Answer the repository status route. */
async function statusFor(ctx: Context, query: URLSearchParams, signal: AbortSignal): Promise<Response> {
  const sessionId = readSessionId(query)
  if (sessionId === null) return new Response('Missing sessionId.', { status: 400 })
  const base = query.get('base')?.trim() ?? ''
  if (base !== '' && !validRef(base)) return new Response('Invalid comparison base.', { status: 400 })
  const repo = await resolveRepo(ctx, sessionId, signal)
  if (repo === null) {
    return Response.json({ repo: false, message: '当前工作区不是 Git 仓库' } satisfies GitUnavailable, { headers: NO_STORE })
  }
  let changes: GitChange[]
  if (base === '') {
    const porcelain = await git(repo.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], signal)
    changes = parseStatusZ(porcelain.stdout)
    const head = await git(repo.root, ['rev-parse', '--verify', 'HEAD'], signal)
    const baseTree = head.code === 0 ? 'HEAD'
      : (await git(repo.root, ['hash-object', '-t', 'tree', devNull], signal)).stdout.trim()
    const numstat = await git(repo.root, ['diff', baseTree, '--numstat', '-z', '--no-ext-diff', '--no-textconv'], signal)
    if (porcelain.code !== 0 || numstat.code !== 0) return new Response('Git status unavailable.', { status: 503 })
    applyNumstat(changes, numstat.stdout)
  } else {
    const named = await git(repo.root, ['diff', '--name-status', '-z', base], signal)
    changes = parseNameStatusZ(named.stdout)
    const numstat = await git(repo.root, ['diff', '--numstat', '-z', base], signal)
    applyNumstat(changes, numstat.stdout)
    const others = await git(repo.root, ['ls-files', '--others', '--exclude-standard', '-z'], signal)
    for (const path of others.stdout.split('\0')) {
      if (path !== '') changes.push({ path, kind: 'untracked', staged: false, unstaged: true })
    }
  }
  for (let index = 0; index < changes.length; index += 1) {
    const change = changes[index]
    if (change === undefined || change.kind !== 'untracked') continue
    const result = await git(repo.root, ['diff', '--no-index', '--numstat', '-z', '--no-ext-diff', '--no-textconv', '--', devNull, change.path], signal)
    if (signal.aborted) throw signal.reason
    if (result.code > 1) continue
    const counts = parseNumstatZ(result.stdout).values().next().value
    if (counts !== undefined) changes[index] = { ...change, ...counts }
  }
  changes.sort((left, right) => left.path.localeCompare(right.path))
  const value: GitStatusResult = {
    repo: true,
    root: repo.root,
    branch: repo.branch,
    detached: repo.branch === null,
    changes,
    branches: repo.branches,
  }
  return Response.json(value, { headers: NO_STORE })
}

/** Answer one file's unified diff route. */
async function diffFor(ctx: Context, query: URLSearchParams, signal: AbortSignal): Promise<Response> {
  const sessionId = readSessionId(query)
  if (sessionId === null) return new Response('Missing sessionId.', { status: 400 })
  const path = query.get('path') ?? ''
  if (!validRepoPath(path)) return new Response('Invalid path.', { status: 400 })
  const base = query.get('base')?.trim() ?? ''
  if (base !== '' && !validRef(base)) return new Response('Invalid comparison base.', { status: 400 })
  const repo = await resolveRepo(ctx, sessionId, signal)
  if (repo === null) {
    const empty: GitDiffValue = { path, base: base === '' ? null : base, unified: '', binary: false, truncated: false }
    return Response.json(empty, { headers: NO_STORE })
  }
  let unified = ''
  if (base !== '') {
    const result = await git(repo.root, ['diff', '--no-color', '--no-ext-diff', base, '--', path], signal)
    unified = result.stdout
  } else {
    const result = await git(repo.root, ['diff', '--no-color', '--no-ext-diff', 'HEAD', '--', path], signal)
    if (result.code !== 0 || result.stdout === '') {
      const fallback = await git(repo.root, ['diff', '--no-color', '--no-ext-diff', '--', path], signal)
      unified = fallback.stdout
    } else {
      unified = result.stdout
    }
  }
  let binary = /^Binary files .* differ$/m.test(unified)
  if (unified === '') {
    const synthesized = await untrackedDiff(repo.root, path)
    if (synthesized !== null) {
      unified = synthesized.unified
      binary = synthesized.binary
    }
  }
  const truncated = unified.length > 4 * 1024 * 1024
  if (truncated) unified = unified.slice(0, 4 * 1024 * 1024)
  const value: GitDiffValue = { path, base: base === '' ? null : base, unified, binary, truncated }
  return Response.json(value, { headers: NO_STORE })
}

/**
 * Register both Git changes routes inside Connection's authentication fence.
 * @param ctx - Host context carrying connection, session lookup, and sandbox policy.
 */
export function registerGitChanges(ctx: Context): void {
  const lifetime = new AbortController()
  const pending = new Set<Promise<Response>>()
  const run = (request: Request, handler: (signal: AbortSignal) => Promise<Response>): Promise<Response> => {
    const task = handler(AbortSignal.any([request.signal, lifetime.signal]))
    pending.add(task)
    void task.then(() => { pending.delete(task) }, () => { pending.delete(task) })
    return task
  }
  ctx.connection.fetch.register({
    path: GIT_STATUS_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: request => run(request, signal => statusFor(ctx, new URL(request.url).searchParams, signal)),
  })
  ctx.connection.fetch.register({
    path: GIT_DIFF_PATH,
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: request => run(request, signal => diffFor(ctx, new URL(request.url).searchParams, signal)),
  })
  ctx.effect(() => async () => {
    lifetime.abort()
    await Promise.allSettled(pending)
  })
}

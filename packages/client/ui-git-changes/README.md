# @deepseek-ai/dsh-client-ui-git-changes

Workspace Git changes as a Conversation View tab.

## What it does

The package is dual-face:

- **Node half** (\`exports["."]\`) registers two authenticated `ctx.connection.fetch` routes
  under `/api/git-changes`:
  - `status` — repository detection, current branch, local branches, and the
    changed paths (staged, unstaged, untracked, or a branch comparison).
  - `diff` — one file's unified diff, including a synthesized new-file diff
    for an untracked text file and a binary marker.
  Git runs through `execFile` without a shell; every browser-supplied path and
  ref is validated before it becomes an argument.
- **Browser half** (`exports["./client"]`) registers the `changes` entry in the
  `conversation.view` slot: a file list plus an inline diff and a side-by-side
  diff with a toolbar toggle, a comparison-base selector, and refresh.

## Extension points

- Compose the row out of `cordis.patch.yml` to remove the tab and both routes.
- The wire vocabulary lives in `src/git-contract.ts`; the diff projection is a
  pure function in `src/client/diff-model.ts`.

## Known Limitations and Deferred Work

- **No hunk staging** — the view is read-only; staging, discarding, and commit
  actions are deferred.
- **Untracked diff cap** — an untracked file over 2 MiB is summarized without
  its full body.
- **Branch comparison** — the base list is local branches only; remote refs and
  arbitrary revisions are deferred.

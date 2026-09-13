---
description: "Workspace Git changes as a Conversation View tab plus uncommitted totals beside the composer's session statistics."
kind: "package-reference"
---
# @deepseek-ai/dsh-client-ui-git-changes

English | [中文](README.zh.md)

## Summary

Use this package to inspect a Session workspace's uncommitted Git changes, or compare one file against a local branch, without leaving the conversation. The Changes tab lists staged, unstaged, and untracked paths with line totals and renders an inline or side-by-side diff for the selected file. The composer footer adds the changed-file count and its text additions and deletions beside the session usage pills, and selects the Changes tab when clicked.

## Table of Contents

- [What it does](#what-it-does)
- [Composer statistics](#composer-statistics)
- [Extension points](#extension-points)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="what-it-does"></a>
## What it does

The package is dual-face.

- **Node half** (`exports["."]`) registers two authenticated `ctx.connection.fetch` routes under `/api/git-changes`:
  - `status` — repository detection, current branch, local branches, and the changed paths (staged, unstaged, untracked, or a branch comparison).
  - `diff` — one file's unified diff, including a synthesized new-file diff for an untracked text file and a binary marker.
- **Browser half** (`exports["./client"]`) registers the `changes` entry in the `conversation.view` slot: a file list plus an inline diff and a side-by-side diff with a toolbar toggle, a comparison-base selector, and refresh.

Git runs through `execFile` without a shell; every browser-supplied path and ref is validated before it becomes an argument.

-----

<a id="composer-statistics"></a>
## Composer statistics

The browser contributes uncommitted file totals to `conversation.composer.dock.stats`, beside session usage. It shows localized changed-file copy, green additions, and red deletions. Clicking the statistics selects the current session's Changes tab through the Conversation shell's existing view action. Counts refresh when the session changes, its running state changes, or the window regains focus; clean or unavailable repositories hide the entry. Branch comparison selection does not affect the footer. File counts include staged, unstaged, untracked, and binary changes; line totals use the working tree relative to HEAD (the empty tree before the first commit), with untracked text counted as additions. Binary files contribute no text lines.

-----

<a id="extension-points"></a>
## Extension points

- Removing the row from `cordis.patch.yml` removes both the tab and the two routes.
- The wire vocabulary lives in `src/git-contract.ts`; the diff projection is a pure function in `src/client/diff-model.ts`.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package is a browser-side UI plugin layer that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **No hunk staging** — the view is read-only; staging, discarding, and commit actions are not implemented.
- **Untracked diff cap** — an untracked file over 2 MiB is summarized without its full body.
- **Branch comparison** — the base list is local branches only; remote refs and arbitrary revisions are deferred.
- No invariant companion is published because these surfaces own no relationship that two independent observations could diverge on.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The feature, its refresh policy, and the rejected alternatives are recorded in [the composer Git statistics note](../../../.agents/notes/implemented/feature/2026-09-13-composer-git-statistics.md).

</details>

# Agent Note: Cap the Git changes status response

Status: implemented

English | [中文](2026-09-14-git-changes-response-cap.zh.md)
## Problem

The Changes tab ran `git status --untracked-files=all` and then one `git diff --no-index` process per untracked path for that path's line counts. A workspace holding a large untracked tree (node_modules and the like) produced an unbounded path list and one process per path, so the tab took minutes to open and streamed an oversized response.

## Decision

The status route returns at most 100 changed paths. It sorts every path, keeps tracked changes ahead of untracked ones while filling the cap, and runs the per-untracked-path numstat only for the paths it returns. The payload carries the untruncated `total` and a `truncated` flag; the Changes view reports the real total and notes the cut, and the composer statistics count `total` while summing line totals over the returned paths.

## Alternatives considered

**Client-side pagination ("load more").** It requires an offset parameter, appended client state, and a second fetch contract for a case whose whole point is to stop the tab from stalling; a bounded first page with an explicit notice answers the same need.

**Keep the full list and only bound the per-file numstat loop.** The list and its JSON payload stay unbounded, so a large tree still streams and renders thousands of rows.

**Raise the cap without prioritizing tracked changes.** Untracked paths sort among tracked ones (`node_modules` before `src`), so a path-ordered cut hides real edits behind untracked noise.

## Consequences

A workspace with more than 100 changed paths no longer stalls the tab, and real edits stay visible. Paths past the cap are not listed, and untracked line totals are computed only for the returned paths, so the composer's line totals under-report a heavily truncated untracked tree while its file count stays exact. Focused real-repository route tests cover the tracked-first cap and the `total`/`truncated` report; a client test covers the notice.

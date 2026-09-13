# Agent Note: Composer Git statistics

Status: implemented

English | [中文](2026-09-13-composer-git-statistics.zh.md)
## Problem

The composer exposes session usage but requires opening Changes to see uncommitted workspace size. Branch comparison totals answer a different question.

## Decision

Clicking the statistics selects the current session’s Changes tab through the shell’s shared view-selection action. Chat owns an additive statistics slot; the Git changes plugin contributes localized file and line totals through it. The existing authenticated status route supplies working-tree totals independently of the Changes view's selected branch. New text files use Git numstat, including files without a final newline; binary files count only toward the file total. Before the first commit, tracked files compare with the empty tree.

## Alternatives considered

**Import the Git component into Chat.** This couples a general session surface to an optional feature and violates feature package runtime isolation.

**Reuse selected branch totals.** These include committed changes and do not describe uncommitted work.

**Continuous polling.** Refresh on session state and window focus keeps the footer useful without continuously scanning idle workspaces.

## Consequences

The footer keeps existing usage controls and shares the Changes view's colors. External filesystem changes become visible on the next focus or session state change. New-file counting requires one bounded Git capture per untracked file. Focused client and real-repository route tests cover totals, refresh, cancellation, and unavailable repositories; the feature does not alter model requests or session logs.

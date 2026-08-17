# Agent Note: Bulk Archive Inactive Sessions

Status: implemented

English | [中文](2026-08-15-bulk-archive-inactive-sessions.zh.md)

## Problem

A sidebar with many finished sessions is hard to scan. The row Archive action cleans one session at a time, and deleting a Workspace moves sessions to Ungrouped instead of reducing the list, so there was no low-risk route to retire a large backlog.

## Decision

The Workspace browser header adds an archive icon beside view options and add workspace. It opens a modal with 7, 30, 90, and 180-day thresholds and previews the eligible count before committing. `selectInactiveSessions` selects ready-list, non-blank, non-subagent, idle sessions whose `updatedAt` is older than the cutoff and not in the registry archive set. Current, running, pending, blank, subagent, and archived sessions are excluded. Confirmation calls the existing idempotent `archiveSession` action for every candidate and reports success, partial failure, and empty outcomes in the same dialog.

## Alternatives considered

**Add thresholds directly to the row menu.** A row-level action cannot cover a backlog efficiently and would force the user to repeat a gesture per session.

**Archive without a preview.** Bulk archiving is reversible but the preview makes the threshold semantics explicit and avoids a surprising count.

**Introduce a Host batch RPC.** The existing archive action is idempotent and the Web object layer already installs full archive sets; a new RPC would duplicate the durable operation without a UI-facing benefit.

## Consequences

- Finished sessions can be retired from the active list in one action while logs and accounting slots remain.
- The action is browser-only: it composes existing archiveSession calls, so every Host archive-set invariant and failure behavior is unchanged.
- Bulk archive is available in both wide and rail header states.

## Testing

Unit tests cover threshold boundaries, list readiness, missing rows, and every exclusion. UI tests cover the preview count, empty state, pending progress, full success, and partial failure.

# Agent Note: Retry Web session and workspace baselines after transient startup failures

Status: implemented

English | [中文](2026-08-20-web-baseline-startup-retry.zh.md)

## Problem

The Web client performed one session-list pull and one workspace-list pull when a connection generation became ready. A transient host failure during DSH startup left either list phase at `pending` with an error and no follow-up request, so the page presented an empty project until restarting the service created another connection generation.

## Decision

The client runtime retries a failed `session.list` or `workspace.list` while the current connection remains active and the corresponding baseline has not succeeded. Retries use a shared exponential delay beginning at 250 ms and capped at 5 seconds. A successful baseline resets the delay, a new connection starts a fresh retry sequence, and disconnection or runtime disposal cancels pending timers. A successful empty response still advances the phase to `ready`; the client does not poll a genuinely empty deployment.

Session and workspace managers own their retry timers because they own the two independent baseline lifecycles. `WorkspaceRuntime` forwards connection teardown to its manager, and the runtime disposes both managers before stopping the connection stream.

## Alternatives considered

**Make the systemd unit wait longer before starting DSH.** Rejected: the failure is an RPC baseline request that can lose a startup race even after the process has bound its Web server, and a service delay cannot cover later connection generations or backend recovery.

**Retry only `session.list`.** Rejected: the initial project selection requires both session and workspace baselines, so a workspace-list failure produces the same empty-project symptom.

**Treat a successful empty list as transient.** Rejected: an empty list is a valid durable state and cannot be distinguished from a backend that is ready and has no sessions without changing the wire contract.

## Consequences

The first page load can recover historical sessions and workspaces without a manual service restart when the host becomes ready shortly after the Web connection. While the host remains unavailable, the client retries at a bounded cadence until the connection generation dies; ordinary reconnect handling cancels the old timer and starts a new sequence. The list state still exposes the latest error while a retry is pending, and successful responses preserve existing mutation replay and ordering behavior.

## Testing

`packages/client/runtime/tests/manager.client.spec.ts` and `packages/client/runtime/tests/workspaces-service.client.spec.ts` cover a first connected pull that fails, a delayed retry that succeeds, phase recovery, and timer cleanup. The focused runtime suite, repository typecheck, and whitespace check pass.

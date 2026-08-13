# Agent Note: Persist Web preferences and open every /api method to LAN/ZeroTier pages

Status: implemented

English | [中文](2026-08-14-lan-web-preferences.zh.md)

## Problem

The host-backed Web preferences (Appearance, Language, busy-Enter) persisted only for pages the browser considered loopback. `ctx.connection.isLoopback` is derived from `window.location.hostname` (`localhost`, `[::1]`, `127/8` only), so a page opened through a LAN IP or a ZeroTier address bound its settings scopes in `memory` mode: every `settings.mutate` short-circuited without a wire call, the choice applied only to the live page, and a refresh reverted to the Host defaults. The deployment deliberately serves the GUI to the LAN and ZeroTier (all-interfaces bind, settings/credentials already fence-open), so the client gate contradicted the server's own trust posture — the server would have accepted the writes.

The remaining server-side loopback pins (`agentPreset.read/copy/openDocument/remove`, `host.pickDirectory`, `host.openPath`) blocked preset management, directory picking, and native opens from the same trusted pages, and the client mirrored the pin by hiding the settings-document action and the produced-files folder opener for non-loopback pages.

## Decision

**Probe scopes.** `SettingsScopeController` gains a third persistence mode, `probe`, used for every non-loopback page: it starts like `host` (initial read runs, writes go to the wire) and downgrades itself to `memory` the moment the /api trust fence answers a settings call with HTTP 403 (the fetch carrier throws `transport failure for <path>: HTTP <status>`, so the fence verdict is distinguishable from transient network failures). A page the deployment trusts — loopback, derived LAN IPv4 literals, or declared `trustedHosts` — persists exactly like loopback; a refused page keeps the historical process-local behavior and never touches the Host again. The welcome-notice store (`WelcomeNoticeStore`) gets the same probe semantics.

**Fence-following client gates.** The settings-document action and the produced-files folder opener no longer test the page hostname. The document action registers when `connection.isLoopback` or the connection settled (the `host.describe` that rides the same fence has already succeeded, so settlement proves the fence accepted the page). The folder opener keys on the Host description's `canOpenPath` alone.

**No loopback-only method pin.** The `/api` trust fence (loopback + derived LAN literals + `trustedHosts`) is the whole configuration plane's boundary: the `LOOPBACK_ONLY_METHODS` pin is removed, so preset management, directory picking, and native path opening ride the same fence as settings and credentials. `trustedHosts` remains a DNS-rebinding fence, not authentication; serving beyond a trusted network still needs a real auth layer in front of the server.

## Alternatives considered

**Keep the hostname test and tell the user to use 127.0.0.1.** The deployment's whole purpose is LAN/ZeroTier access; the server already trusted those pages, so the client gate was a fence the server did not enforce.

**A one-shot trust probe per consumer.** The settings scopes already own a read/write lifecycle, so the probe is one extra mode on the existing controller instead of a new transport surface; the document action and folder opener derive trust from signals they already hold.

**Downgrade on any read failure.** Transient network errors would permanently disable preferences for the page; only the fence's own 403 verdict downgrades.

## Consequences

Appearance, Language, busy-Enter, models configuration, the welcome acknowledgement, permission defaults, preset management, directory picking, and native opens all work from LAN and ZeroTier pages and persist to `$DSH_HOME/settings.yaml` when the page authority is fence-accepted. A refused page (stock loopback-only deployment) pays one 403 describe per scope before settling into memory mode — the same net behavior as before, no settings data leaves the Host.

ZeroTier IP literals (100.x.x.x) are non-internal IPv4 addresses, so `resolveLanTrust` samples them automatically; accessing the GUI through a DNS name instead of an IP literal still requires `--trusted-host <name>` (or `--trusted-host <name>:<port>`).

Focused unit coverage pins the probe downgrade on 403, probe persistence on acceptance, the welcome-store fallback, the fence-gated document action, the produced-files opener, and the removed method pin over real HTTP.

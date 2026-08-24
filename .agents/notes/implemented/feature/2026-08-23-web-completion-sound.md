# Agent Note: Web task-completion sound notifications

Status: implemented

English | [中文](2026-08-23-web-completion-sound.zh.md)

## Problem

A completed agent run is easy to miss when the operator is reading another session or has stepped away from the conversation. The sidebar completion marker is visual and does not help when the browser tab is not in view.

## Decision

The browser conversation plugin owns completion notification audio. The Host-backed ui-conversation settings namespace keeps the boolean completionSound for compatibility and adds completionSoundTone and completionSoundVolume. General settings uses the existing selector-pill Menu and outline Button patterns: Off, Ding-dong, Bell, Bright chime, Preview, and a 0–100 volume slider. The preference remains in src/client/completion-sound.ts beside the settings rows instead of entering the React conversation shell.

SessionRuntime emits the internal session/completed Context event only when a structured turn/end carries reason.kind === completed, deduplicated by session event sequence. CompletionSoundController consumes that event; it no longer infers completion from a running true to false list edge, so cancellation, failure, reconnect convergence, and unrelated session transitions do not play a notification. A completed event observed before audio is unlocked is held as one pending notification and flushed by the next successful user gesture.

The tones are synthesized from short Web Audio sine and triangle notes, so the feature ships no binary sound asset. The controller creates an AudioContext only from a pointer or keyboard gesture, or from Preview, scales gain by the persisted application volume, and closes it with the plugin lifecycle. Audio failures are isolated to the notification path and do not affect session rendering or settings writes.

## Alternatives considered

- **A React effect in ConversationRoot.** Rejected because the resident shell only represents the selected session; a controller at the apply layer can observe background sessions and keeps browser side effects outside presentation components.
- **A sound asset loaded from the Web server.** Rejected because a synthesized two-tone cue removes asset serving, preload, and cache behavior while matching the requested ding-dong notification.
- **A new runtime session event or wire field.** Rejected because running transitions and the existing session-list projection already carry the completion fact; adding a model-visible or durable event would expand the protocol without adding authority.

## Consequences

The completion cue is available in the assembled Web client without changing Host protocol messages. Existing settings documents resolve the new field through its schema default, while an explicit toggle persists with the other ui-conversation preferences. Browser autoplay policy still applies: a page that has received no user gesture cannot play immediately, so the first completion is queued until the operator interacts or uses Preview. The default-on behavior can be disabled from General settings.

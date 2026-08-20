# Agent Note: Preserve interjection order in folded chat

Status: implemented

English | [中文](2026-08-19-chat-fold-interjection-order.zh.md)

## Problem

The Web chat folds reasoning, tool calls, and assistant answers by whole turn. A running turn can contain a user steering message between two assistant steps, so whole-turn grouping can render the later answer before the steering message even though the durable event sequence places the message first.

## Decision

Fold groups are built from contiguous process and answer nodes within one turn segment. A visible user, steering, context, or other non-process node ends the current segment; a later assistant step starts a new fold group. The existing process disclosure and answer rendering stay unchanged inside each segment, while the Chat order remains the source of transcript order between segments.

## Alternatives considered

**Keep whole-turn grouping.** It keeps one compact process disclosure per turn but moves later answers across steering and context rows, which misrepresents the conversation order.

**Disable process folding after steering.** It preserves row order but removes the configured default folding from the affected turn; segment-local groups retain both ordering and the fold preference.

**Reorder durable Chat nodes.** It would make presentation repair the event-derived order and could affect replay, location indexes, and other renderers; the defect belongs in the presentation grouping algorithm.

## Consequences

A turn with several tool or reasoning phases can display multiple process disclosures when an input or context row separates those phases. Each disclosure still contains the contiguous reasoning, tool, and answer rows it owns, and a steered answer renders below its steering message in full, folded, and replayed views.

Focused ChatView coverage verifies the DOM order of the old answer, steering message, and continued answer while fold mode is active.

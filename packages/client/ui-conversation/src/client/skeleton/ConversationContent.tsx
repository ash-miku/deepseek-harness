import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { SessionSnapshot } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types'
import type { ConversationSlotProps, InputZone } from '../contract/slots.ts'
import { HeroShell, WorkspaceChip, workspaceLabel } from './EmptyHero.tsx'
import css from './ConversationRoot.module.css'

type ConversationContentProps = Omit<ConversationSlotProps, 'useSession' | 'useConversation'> & {
  session: SessionSnapshot | undefined
  phase: 'settling' | 'hero' | 'active'
  hero: boolean
  onHandleStart: () => number
  onHandleDrag: (width: number) => void
  onHandleCommit: (width: number) => void
  onHandleEnd: () => void
}

/** One transcript width handle: pointer capture + rAF-throttled symmetric
 * resize (both sides write the one centered width, so outward travel widens
 * by 2× the pointer distance). The strip itself is pointer-transparent so a
 * wheel over it chains to the transcript scrollport natively — the platform's
 * own (compositor) scrolling rather than a main-thread \`scrollTop\` write, which
 * is what made the pass-through feel choppy. The gesture and the resize cursor
 * therefore live on the enclosing band and hit-test the strip's box.
 * pointermove publishes the pointer's Y as a CSS variable so the glow indicator
 * rides it. Coarse pointers keep the strip interactive (touch-action: none)
 * because they have no wheel to pass through. Mirrors ui-layout AppFrame's
 * DragHandle capture model. */
function WidthHandle(props: {
  side: 'left' | 'right'
  onStart: () => number
  onDrag: (width: number) => void
  onCommit: (width: number) => void
  onEnd: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const base = useRef(0)
  const origin = useRef(0)
  const latest = useRef(0)
  const frame = useRef<number | null>(null)
  const capture = useRef<{ element: HTMLElement; id: number } | null>(null)
  const hovering = useRef(false)
  const callbacks = useRef(props)
  callbacks.current = props
  const handleRef = useRef<HTMLDivElement | null>(null)

  const outwardWidth = () => {
    const dx = latest.current - origin.current
    const outward = callbacks.current.side === 'right' ? dx : -dx
    return base.current + outward * 2
  }

  // The gesture listens on the enclosing band instead of the strip: the strip
  // is pointer-events: none so the wheel reaches the scrollport, which also
  // means it can own neither hover nor the resize cursor. One listener set per
  // handle hit-tests that handle's box; only the handle whose hover state
  // changes touches the shared band cursor.
  useEffect(() => {
    const handle = handleRef.current
    /* v8 ignore next -- the ref is attached by effect time: the handle renders unconditionally. */
    if (handle === null) return
    const surface = handle.parentElement
    /* v8 ignore next -- the strip always renders inside the conversation band. */
    if (surface === null) return

    const boxOf = (): DOMRect => handle.getBoundingClientRect()
    const within = (clientX: number): boolean => {
      const box = boxOf()
      return clientX >= box.left && clientX <= box.right
    }
    const paint = (clientY: number): void => {
      handle.style.setProperty('--dsh-width-handle-pointer-y', `${clientY - boxOf().top}px`)
    }
    const cancelFrame = (): void => {
      if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    }
    const setHover = (hover: boolean): void => {
      hovering.current = hover
      if (hover) handle.dataset.hover = ''
      else delete handle.dataset.hover
      surface.style.cursor = hover ? 'col-resize' : ''
    }
    const endDrag = (): void => {
      const active = capture.current
      if (active === null) return
      capture.current = null
      cancelFrame()
      if (active.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id)
      setDragging(false)
      callbacks.current.onEnd()
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || capture.current !== null || !within(event.clientX)) return
      // Capture phase: the transparent strip lets the press fall through to the
      // transcript, so stop it here to keep a resize from selecting text or
      // activating the row underneath.
      event.preventDefault()
      event.stopPropagation()
      surface.setPointerCapture(event.pointerId)
      capture.current = { element: surface, id: event.pointerId }
      origin.current = event.clientX
      latest.current = event.clientX
      base.current = callbacks.current.onStart()
      setHover(true)
      setDragging(true)
    }
    const onPointerMove = (event: PointerEvent): void => {
      if (capture.current?.id === event.pointerId) {
        paint(event.clientY)
        latest.current = event.clientX
        frame.current ??= requestAnimationFrame(() => {
          frame.current = null
          callbacks.current.onDrag(outwardWidth())
        })
        return
      }
      const inside = within(event.clientX)
      if (inside) paint(event.clientY)
      if (inside !== hovering.current) setHover(inside)
    }
    const onPointerUp = (event: PointerEvent): void => {
      if (capture.current?.id !== event.pointerId) return
      latest.current = event.clientX
      // Only a gesture with actual travel commits: a press-and-release on a
      // window-clamped width must not overwrite the wider stored preference
      // with the clamped display value.
      if (latest.current !== origin.current) callbacks.current.onCommit(outwardWidth())
      endDrag()
      // onEnd republished from storage and may have moved the strip; re-test
      // the release point so the glow and cursor do not stick on.
      setHover(within(event.clientX))
    }
    // Releasing outside the window delivers pointercancel (or drops the capture
    // silently) instead of pointerup; endDrag abandons the gesture uncommitted
    // and onEnd republishes the stored preference.
    const onPointerCancel = (event: PointerEvent): void => {
      if (capture.current?.id !== event.pointerId) return
      endDrag()
      setHover(within(event.clientX))
    }
    const onPointerLeave = (): void => {
      if (capture.current === null && hovering.current) setHover(false)
    }

    surface.addEventListener('pointerdown', onPointerDown, true)
    surface.addEventListener('pointermove', onPointerMove)
    surface.addEventListener('pointerup', onPointerUp)
    surface.addEventListener('pointercancel', onPointerCancel)
    surface.addEventListener('pointerleave', onPointerLeave)
    return () => {
      surface.removeEventListener('pointerdown', onPointerDown, true)
      surface.removeEventListener('pointermove', onPointerMove)
      surface.removeEventListener('pointerup', onPointerUp)
      surface.removeEventListener('pointercancel', onPointerCancel)
      surface.removeEventListener('pointerleave', onPointerLeave)
      surface.style.cursor = ''
    }
  }, [])

  return (
    <div
      ref={handleRef}
      className={css.widthHandle}
      data-side={props.side}
      data-width-handle={props.side}
      data-dragging={dragging || undefined}
    />
  )
}

/**
 * Render the existing Conversation body, Composer, and width handles.
 * @param props - original Conversation seats plus MainPanel-derived phase and width callbacks.
 * @returns the unchanged Conversation body subtree.
 */
export function ConversationContent({
  sessionId, session, phase, hero, useSessions, useSessionPendingInteraction,
  useWorkspaces, useInput, useComposerBlock, renderSlot, renderSlotChain,
  selectWorkspace, t, onHandleStart, onHandleDrag, onHandleCommit, onHandleEnd,
}: ConversationContentProps) {
  const pendingInteraction = useSessionPendingInteraction(snapshot =>
    sessionId === undefined ? undefined : snapshot.get(sessionId))
  const inputState = useInput(s => s)
  const cwd = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.cwd)
  const workspaces = useWorkspaces(s => s)
  // A plugin this package cannot import (ui-model-selection) says this session cannot
  // send; its reason is already localized by whoever raised it.
  const composerBlock = useComposerBlock(block => block)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingWorkspaceId, setPendingWorkspaceId] = useState<WorkspaceId | undefined>()
  const pickerAnchor = useRef<HTMLButtonElement>(null)

  // Publishes the two live measurements floating View chrome reads off the
  // scroll body: the seat's height as --dsh-composer-height, so controls clear
  // the composer as it grows, and the scrollport's own height as
  // --dsh-conversation-viewport-height, so a control can sit in the band the
  // seat leaves visible. Callback ref, not an effect; stable identity prevents
  // observer churn while the first blank session fills the resident body
  // outlet.
  const seatObserver = useRef<ResizeObserver | null>(null)
  const seatResizeRef = useCallback((seat: HTMLDivElement | null): void => {
    seatObserver.current?.disconnect()
    seatObserver.current = null
    const scroller = seat?.parentElement ?? null
    if (seat === null || scroller === null) return
    seatObserver.current = new ResizeObserver(() => {
      scroller.style.setProperty('--dsh-composer-height', `${seat.offsetHeight}px`)
      scroller.style.setProperty(
        '--dsh-conversation-viewport-height',
        `${scroller.clientHeight}px`,
      )
    })
    seatObserver.current.observe(seat)
    seatObserver.current.observe(scroller)
  }, [])

  const sessionWorkspace = sessionId === undefined
    ? undefined
    : workspaces.items.find(workspace => workspace.sessionIds.includes(sessionId))
  const pendingWorkspace = workspaces.items.find(
    workspace => workspace.workspaceId === pendingWorkspaceId,
  )

  // Clear the pending pick once the session lands in it, or when the picked
  // workspace disappears from a ready list (deleted from the sidebar).
  useEffect(() => {
    if (pendingWorkspaceId === undefined) return
    if (sessionWorkspace?.workspaceId === pendingWorkspaceId
      || (workspaces.phase === 'ready' && pendingWorkspace === undefined)) {
      setPendingWorkspaceId(undefined)
    }
  }, [pendingWorkspaceId, sessionWorkspace?.workspaceId, workspaces.phase, pendingWorkspace])

  const zone: InputZone | undefined =
    session === undefined || inputState === undefined ? undefined : { session, input: inputState }

  // The chip is a selector; label resolution walks the flow top-down:
  //   1. a just-picked workspace (pending) → its title;
  //   2. cold start, no session yet → placeholder ("Choose workspace");
  //   3. the blank session's workspace is in the list → its title;
  //   4. list still loading → cwd folder name bridges so the title does not
  //      flash on refresh (empty cwd → placeholder);
  //   5. list ready but no owning workspace (deleted from the sidebar) →
  //      placeholder, never the deleted folder's name via cwd.
  const chipTitle = pendingWorkspace?.title
    ?? (sessionId === undefined
      ? undefined
      : sessionWorkspace?.title
        ?? (workspaces.phase === 'ready' || cwd === undefined || cwd === ''
          ? undefined
          : workspaceLabel(cwd)))

  const heroWorkspaceRow = (
    <div className={css.heroWorkspaceRow}>
      <WorkspaceChip
        buttonRef={pickerAnchor}
        label={chipTitle}
        menuOpen={pickerOpen}
        onClick={() => { setPickerOpen(open => !open) }}
        t={t}
      />
      {renderSlot('conversation.hero.workspace', {
        open: pickerOpen,
        anchorRef: pickerAnchor,
        selectedId: pendingWorkspaceId ?? sessionWorkspace?.workspaceId,
        onPick: (workspaceId) => {
          setPickerOpen(false)
          setPendingWorkspaceId(workspaceId)
          void selectWorkspace(workspaceId).catch(() => {
            setPendingWorkspaceId(current => current === workspaceId ? undefined : current)
          })
        },
        onClose: () => { setPickerOpen(false) },
      })}
      {renderSlot('conversation.hero.agentPreset', {})}
    </div>
  )

  // The placeholder chip ("Choose workspace") and the Workspace-trigger input travel
  // together: no workspace picked yet (cold start, no session at all), or a
  // blank session whose workspace vanished (deleted from the sidebar). The
  // bar is ONE session-maybe slot rendered unconditionally — inert is a prop,
  // not a different tree, so the textarea DOM survives the transition.
  const inert = sessionId === undefined || (hero && chipTitle === undefined)
  // A raised block is the same inert posture with the blocker's own reason:
  // one disabled textarea, never a second tree. The no-workspace state wins
  // when both hold — picking a workspace is the earlier prerequisite.
  const blocked = !inert && composerBlock !== undefined
  const inputBar = renderSlot('conversation.composer.bar', {
    variant: hero ? 'hero' : 'composer',
    ...(inert
      ? {
        disabled: true,
        placeholder: t('placeholder.workspace'),
        workspacePickerOpen: pickerOpen,
        onRequestWorkspace: () => { setPickerOpen(true) },
      }
      : blocked
        // `blocked`, not `disabled`: the bar refuses input either way, but a
        // block keeps the model seat live because choosing a model is how the
        // user clears it.
        ? { blocked: composerBlock, placeholder: composerBlock.reason }
        : hero ? { placeholder: t('placeholder.hero') } : {}),
  })

  const composerBar = (
    <div className={clsx(css.composerStack, hero && css.composerHero)}>
      {hero && <HeroShell t={t} renderSlot={renderSlot} />}
      {hero && heroWorkspaceRow}
      {zone !== undefined && renderSlot('conversation.input.dock', zone)}
      {inputBar}
    </div>
  )

  const composer = renderSlotChain(
    'conversation.composer',
    { sessionId, session, pendingInteraction },
    { fallback: composerBar, fallbackOnly: sessionId === undefined, overlay: true },
  )

  // Sticky wraps the whole chain output (fallback + elected overlay), not
  // only `.composerStack`: overlay:true renders those as siblings, and sticky
  // on the fallback alone would leave a business-owned takeover at the content
  // end off-screen when the user is not pinned to the floor.
  const composerSeat = (
    <div ref={seatResizeRef} className={css.composerSeat} data-composer-seat="">
      {composer}
    </div>
  )

  return (
    <div className={css.body}>
      <div className={css.scrollBody} data-conversation-scroll="">
        {sessionId === undefined ? null : renderSlot('conversation.session', {})}
        {composerSeat}
      </div>
      {/* Width handles only while a transcript is on screen; the hero has no
          content column to size. */}
      {phase === 'active' && (['left', 'right'] as const).map(side => (
        <WidthHandle
          key={side}
          side={side}
          onStart={onHandleStart}
          onDrag={onHandleDrag}
          onCommit={onHandleCommit}
          onEnd={onHandleEnd}
        />
      ))}
    </div>
  )
}

import { memo, useMemo } from 'react'
import type { ChatNodeViewProps, TurnTailOwnerProps } from '../contract/slots.ts'
import { AssistantMarkdown } from './AssistantMarkdown.tsx'

/** Streaming, settled, and interrupted Assistant states share one keyed renderer instance. */
export const AssistantNodeView = memo(function AssistantNodeView({
  node, useTurnData, displayMode, processSlice, openFile, renderMessageImages, fileMentions, t,
}: ChatNodeViewProps<'assistant-step'>) {
  const data = node.data
  const blocks = processSlice === 'process'
    ? data.blocks.filter(block => block.kind === 'reasoning' && block.text.trim() !== '')
    : processSlice === 'answer'
      ? data.blocks.filter(block => (
        (block.kind === 'text' && block.text.trim() !== '')
        || block.kind === 'image'
        || block.kind === 'other'
      ))
      : data.blocks
  const turn = node.location.kind === 'turn' || node.location.kind === 'step'
    ? node.location.turn
    : undefined
  const tail = useTurnData('turn-tail')
  const owner = useMemo<TurnTailOwnerProps | undefined>(() => {
    if (turn?.status !== 'closed' || data.finalNode === undefined) return undefined
    if (tail?.closing?.finalNode.seq !== data.finalNode.seq) return undefined
    return { turn, seq: data.finalNode.seq, openFile }
  }, [data.finalNode, openFile, tail, turn])
  const mentions = useMemo(
    () => owner === undefined ? undefined : fileMentions(owner),
    [fileMentions, owner],
  )
  return (
    <AssistantMarkdown
      blocks={blocks}
      streaming={data.status === 'running'}
      interrupted={data.status === 'interrupted'}
      displayMode={displayMode}
      renderMessageImages={renderMessageImages}
      mentions={mentions}
      t={t}
    />
  )
})

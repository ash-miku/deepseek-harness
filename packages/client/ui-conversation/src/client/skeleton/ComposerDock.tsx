/** Session-scoped dock sharing the header's Conversation view selection. */
import type { PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

type Props = PropsRenderSlots<'conversation.composer.dock.content'>
  & Pick<PropsRuntime<'conversation.composer.dock.content'>, 'selectView'>

/**
 * Forward the current session's view action to composer dock contributions.
 * @param props - authorized child renderer and shared tab-selection action.
 * @returns the dock's contributed content.
 */
export function ComposerDock({ renderSlot, selectView }: Props) {
  return renderSlot('conversation.composer.dock.content', { selectView })
}

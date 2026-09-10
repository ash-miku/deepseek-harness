// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { makeTranslate, stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { ConversationDisplayPreference } from '../src/client/display-preference.ts'
import { RunningLabelRow } from '../src/client/settings/RunningLabelRow.tsx'
import type { RunningLabelRowProps } from '../src/client/settings/RunningLabelRow.tsx'
import { DEFAULT_RUNNING_LABELS } from '../src/submission-settings.ts'
import type { ConversationSettings } from '../src/submission-settings.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
  }))
}

function emptyWorkspaces() {
  return bindSnapshotSelector(createSnapshotStore<WorkspaceSnapshot>({
    items: [], archivedSessionIds: [], favoriteSessionIds: [], state: 'idle', phase: 'ready', error: null,
  }))
}

function noPendingInteraction() {
  return bindSnapshotSelector(createSnapshotStore<SessionPendingInteractionSnapshot>(new Map()))
}

// The resource hook the resources plugin merges into GlobalStandardProps; this row reads no address.
const useResource = (() => ({ status: 'none' as const, value: undefined, failure: undefined })) as GlobalStandardProps['useResource']

function mount() {
  const preference = new ConversationDisplayPreference()
  const setRunningLabels = vi.fn((labels: string) => { preference.setRunningLabels(labels) })
  const props: RunningLabelRowProps = {
    usePanelInfo: selector => selector({ activePanelId: null }),
    useSessions: emptySessions(),
    useSessionPendingInteraction: noPendingInteraction(),
    useWorkspaces: emptyWorkspaces(),
    useResource,
    useRunningLabels: bindSnapshotSelector(preference.runningLabels),
    setRunningLabels,
    t: makeTranslate(en),
  }
  render(<RunningLabelRow {...props} />)
  return { preference, setRunningLabels }
}

describe('RunningLabelRow', () => {
  it('shows the default running label and accepts multiple lines', () => {
    const b = mount()
    const input = screen.getByLabelText('Running label') as HTMLTextAreaElement
    expect(input.value).toBe(DEFAULT_RUNNING_LABELS)

    fireEvent.change(input, { target: { value: 'Working hard...\nThinking hard...' } })
    fireEvent.blur(input)
    expect(b.setRunningLabels).toHaveBeenCalledWith('Working hard...\nThinking hard...')
    expect(b.preference.runningLabels.getSnapshot()).toBe('Working hard...\nThinking hard...')
  })

  it('persists normalized labels through the durable settings scope', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const preference = new ConversationDisplayPreference(host.scope)
    const props: RunningLabelRowProps = {
      usePanelInfo: selector => selector({ activePanelId: null }),
      useSessions: emptySessions(),
      useSessionPendingInteraction: noPendingInteraction(),
      useWorkspaces: emptyWorkspaces(),
      useResource,
      useRunningLabels: bindSnapshotSelector(preference.runningLabels),
      setRunningLabels: (labels) => { preference.setRunningLabels(labels) },
      t: makeTranslate(en),
    }
    render(<RunningLabelRow {...props} />)
    const input = screen.getByLabelText('Running label') as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: 'One\n\nTwo' } })
    fireEvent.blur(input)
    expect(host.set).toHaveBeenCalledWith('runningLabels', 'One\nTwo')
  })
})

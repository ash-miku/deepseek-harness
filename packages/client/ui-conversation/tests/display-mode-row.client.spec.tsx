// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-test-runtime'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate, stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import { DisplayModeRow } from '../src/client/settings/DisplayModeRow.tsx'
import type { DisplayModeRowProps } from '../src/client/settings/DisplayModeRow.tsx'
import { ConversationDisplayPreference } from '../src/client/display-preference.ts'
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
  return bindSnapshotSelector(createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], favoriteSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  }))
}

function mount() {
  const preference = new ConversationDisplayPreference()
  const setDisplayMode = vi.fn((mode: 'full' | 'fold' | 'conclusion') => { preference.setDisplayMode(mode) })
  const props: DisplayModeRowProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useDisplayMode: bindSnapshotSelector(preference.displayMode),
    setDisplayMode,
    t: makeTranslate(en),
  }
  render(<DisplayModeRow {...props} />)
  return { preference, setDisplayMode }
}

describe('DisplayModeRow', () => {
  it('shows the default Full process choice', () => {
    mount()
    expect(screen.getByText('Process display')).toBeDefined()
    expect(screen.getByRole('button', { name: /Full process/ }).getAttribute('aria-expanded')).toBe('false')
  })

  it('selects Conclusion only and follows later preference changes', () => {
    const b = mount()
    const trigger = screen.getByRole('button', { name: /Full process/ })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Conclusion only' }))
    expect(b.setDisplayMode).toHaveBeenCalledWith('conclusion')
    expect(screen.getByRole('button', { name: /Conclusion only/ })).toBeDefined()

    act(() => { b.preference.setDisplayMode('fold') })
    expect(screen.getByRole('button', { name: /Fold process/ })).toBeDefined()
  })

  it('writes explicit changes through the durable settings scope', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const preference = new ConversationDisplayPreference(host.scope)
    preference.setDisplayMode('fold')
    expect(host.set).toHaveBeenCalledWith('processDisplay', 'fold')
    expect(preference.displayMode.getSnapshot()).toBe('fold')
  })
})

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { bindSnapshotSelector, makeTranslate, stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionPendingInteractionSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { CompletionSoundPreference } from '../src/client/completion-sound.ts'
import { CompletionSoundRow } from '../src/client/settings/CompletionSoundRow.tsx'
import type { CompletionSoundRowProps } from '../src/client/settings/CompletionSoundRow.tsx'
import { CompletionSoundVolumeRow } from '../src/client/settings/CompletionSoundVolumeRow.tsx'
import type { CompletionSoundVolumeRowProps } from '../src/client/settings/CompletionSoundVolumeRow.tsx'
import {
  DEFAULT_COMPLETION_SOUND, DEFAULT_COMPLETION_SOUND_TONE, DEFAULT_COMPLETION_SOUND_VOLUME,
  type ConversationSettings,
} from '../src/submission-settings.ts'
import { en } from '../src/client/locales.ts'

afterEach(() => {
  document.body.replaceChildren()
  localStorage.clear()
})

function emptySessions() {
  return bindSnapshotSelector(createSnapshotStore<SessionListState>({
    ids: [], byId: {}, current: undefined, phase: 'ready',
    subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined,
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
  const preference = new CompletionSoundPreference()
  const preview = vi.fn()
  const props: CompletionSoundRowProps = {
    usePanelInfo: selector => selector({ activePanelId: null }),
    useSessions: emptySessions(),
    useSessionPendingInteraction: noPendingInteraction(),
    useWorkspaces: emptyWorkspaces(),
    useResource,
    useCompletionSound: bindSnapshotSelector(preference.enabled),
    useCompletionSoundTone: bindSnapshotSelector(preference.tone),
    setCompletionSoundSelection: (value) => { preference.setSelection(value) },
    previewCompletionSound: preview,
    t: makeTranslate(en),
  }
  render(<CompletionSoundRow {...props} />)
  return { preference, preview }
}

function mountVolume() {
  const preference = new CompletionSoundPreference()
  const props: CompletionSoundVolumeRowProps = {
    usePanelInfo: selector => selector({ activePanelId: null }),
    useSessions: emptySessions(),
    useSessionPendingInteraction: noPendingInteraction(),
    useWorkspaces: emptyWorkspaces(),
    useResource,
    useCompletionSoundVolume: bindSnapshotSelector(preference.volume),
    setCompletionSoundVolume: (value) => { preference.setVolume(value) },
    t: makeTranslate(en),
  }
  render(<CompletionSoundVolumeRow {...props} />)
  return preference
}

describe('CompletionSoundRow', () => {
  it('renders the existing selector-pill style and persists tone choices', () => {
    const b = mount()
    const selector = screen.getByRole('button', { name: 'Ding-dong' })
    expect(selector).toBeDefined()
    fireEvent.click(selector)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bell' }))
    expect(b.preference.enabled.getSnapshot()).toBe(true)
    expect(b.preference.tone.getSnapshot()).toBe('bell')
  })

  it('turns the sound off through the same selector and routes Preview', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: 'Ding-dong' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Off' }))
    expect(b.preference.enabled.getSnapshot()).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(b.preview).toHaveBeenCalledOnce()
  })
})

describe('CompletionSoundVolumeRow', () => {
  it('renders and persists the volume slider', () => {
    const preference = mountVolume()
    const slider = screen.getByRole('slider', { name: 'Completion sound volume' }) as HTMLInputElement
    expect(Number(slider.value)).toBe(DEFAULT_COMPLETION_SOUND_VOLUME)
    fireEvent.change(slider, { target: { value: '45' } })
    expect(preference.volume.getSnapshot()).toBe(45)
  })
})

describe('CompletionSoundPreference settings compatibility', () => {
  it('adopts a complete durable settings section', () => {
    const host = stubSettingsScope<ConversationSettings>()
    host.publish({
      status: 'ready',
      value: {
        busyEnter: 'queue',
        completionSound: DEFAULT_COMPLETION_SOUND,
        completionSoundTone: DEFAULT_COMPLETION_SOUND_TONE,
        completionSoundVolume: DEFAULT_COMPLETION_SOUND_VOLUME,
      },
      revision: 1,
      writable: true,
    })
    const preference = new CompletionSoundPreference(host.scope)
    expect(preference.tone.getSnapshot()).toBe(DEFAULT_COMPLETION_SOUND_TONE)
    expect(preference.volume.getSnapshot()).toBe(DEFAULT_COMPLETION_SOUND_VOLUME)
  })
})

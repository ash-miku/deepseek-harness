// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import {
  CompletionSoundController, CompletionSoundPreference,
} from '../src/client/completion-sound.ts'
import {
  DEFAULT_COMPLETION_SOUND_TONE, DEFAULT_COMPLETION_SOUND_VOLUME,
  type CompletionSoundTone, type ConversationSettings,
} from '../src/submission-settings.ts'
import { stubSettingsScope } from '@deepseek-ai/dsh-client-test-runtime'

const originalAudioContext = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext')

class FakeAudioContext {
  static readonly instances: FakeAudioContext[] = []
  state = 'suspended'
  currentTime = 10
  destination = {}
  readonly oscillators: {
    type: string
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> }
    connect: ReturnType<typeof vi.fn>
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
  }[] = []
  readonly gains: {
    gain: {
      setValueAtTime: ReturnType<typeof vi.fn>
      exponentialRampToValueAtTime: ReturnType<typeof vi.fn>
    }
    connect: ReturnType<typeof vi.fn>
  }[] = []
  readonly resume = vi.fn(async () => { this.state = 'running' })
  readonly close = vi.fn(async () => { this.state = 'closed' })

  constructor() {
    FakeAudioContext.instances.push(this)
  }

  createOscillator() {
    const oscillator = {
      type: '',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }
    this.oscillators.push(oscillator)
    return oscillator
  }

  createGain() {
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    }
    this.gains.push(gain)
    return gain
  }
}

function installAudioContext(): void {
  FakeAudioContext.instances.length = 0
  Object.defineProperty(globalThis, 'AudioContext', {
    configurable: true,
    writable: true,
    value: FakeAudioContext,
  })
}

function restoreAudioContext(): void {
  if (originalAudioContext === undefined) Reflect.deleteProperty(globalThis, 'AudioContext')
  else Object.defineProperty(globalThis, 'AudioContext', originalAudioContext)
}

function controller(
  enabled = true,
  tone: CompletionSoundTone = DEFAULT_COMPLETION_SOUND_TONE,
  volume = DEFAULT_COMPLETION_SOUND_VOLUME,
) {
  return new CompletionSoundController(
    createSnapshotStore(enabled),
    createSnapshotStore(tone),
    createSnapshotStore(volume),
  )
}

afterEach(() => {
  restoreAudioContext()
  vi.restoreAllMocks()
})

beforeEach(() => {
  installAudioContext()
})

describe('CompletionSoundController', () => {
  it('plays only when the runtime reports a completed turn', () => {
    const sound = controller()
    const stop = sound.start()

    act(() => { fireEvent.pointerDown(document.body) })
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(0)
    sound.notifyCompleted()

    const audio = FakeAudioContext.instances[0]
    expect(audio).toBeDefined()
    expect(audio?.oscillators).toHaveLength(2)
    expect(audio?.oscillators[0]?.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10)
    expect(audio?.oscillators[1]?.frequency.setValueAtTime).toHaveBeenCalledWith(1174.66, 10.1)
    stop()
    expect(audio?.close).toHaveBeenCalledOnce()
  })

  it('does not play for lifecycle changes without a completed-turn event', () => {
    const sound = controller()
    const stop = sound.start()
    act(() => { fireEvent.pointerDown(document.body) })
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(0)
    stop()
  })

  it('queues a completed notification until the first user gesture unlocks audio', async () => {
    const sound = controller()
    const stop = sound.start()

    sound.notifyCompleted()
    expect(FakeAudioContext.instances).toHaveLength(0)

    await act(async () => {
      fireEvent.keyDown(document.body, { key: 'Enter' })
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(2)
    stop()
  })

  it('uses the selected tone and volume for Preview', async () => {
    const tone = createSnapshotStore<CompletionSoundTone>('bell')
    const volume = createSnapshotStore(60)
    const sound = new CompletionSoundController(createSnapshotStore(true), tone, volume)
    const stop = sound.start()

    await act(async () => {
      sound.preview()
      await Promise.resolve()
      await Promise.resolve()
    })
    const audio = FakeAudioContext.instances[0]
    expect(audio?.oscillators).toHaveLength(3)
    expect(audio?.oscillators[0]?.type).toBe('sine')
    expect(audio?.gains[0]?.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(0.21, 10.012)
    stop()
  })

  it('clears pending completion when disabled and still supports explicit Preview', async () => {
    const enabled = createSnapshotStore(false)
    const sound = new CompletionSoundController(
      enabled,
      createSnapshotStore(DEFAULT_COMPLETION_SOUND_TONE),
      createSnapshotStore(DEFAULT_COMPLETION_SOUND_VOLUME),
    )
    const stop = sound.start()

    sound.notifyCompleted()
    act(() => { fireEvent.pointerDown(document.body) })
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(0)
    enabled.set(true)
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(0)

    await act(async () => {
      sound.preview()
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(FakeAudioContext.instances[0]?.oscillators).toHaveLength(2)
    stop()
  })
})

describe('CompletionSoundPreference', () => {
  it('adopts Host state and persists tone, volume, and enabled changes', () => {
    const host = stubSettingsScope<ConversationSettings>()
    const preference = new CompletionSoundPreference(host.scope)
    host.publish({
      status: 'ready',
      value: {
        busyEnter: 'queue',
        completionSound: false,
        completionSoundTone: 'bell',
        completionSoundVolume: 60,
      },
      revision: 1,
      writable: true,
    })
    expect(preference.enabled.getSnapshot()).toBe(false)
    expect(preference.tone.getSnapshot()).toBe('bell')
    expect(preference.volume.getSnapshot()).toBe(60)

    preference.setSelection('chime')
    preference.setVolume(75)
    expect(host.set).toHaveBeenCalledWith('completionSoundTone', 'chime')
    expect(host.set).toHaveBeenCalledWith('completionSound', true)
    expect(host.set).toHaveBeenCalledWith('completionSoundVolume', 75)
  })
})

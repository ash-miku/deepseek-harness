import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  COMPLETION_SOUND_FIELD, CONVERSATION_SETTINGS_NAMESPACE, DEFAULT_BUSY_ENTER_BEHAVIOR,
  DEFAULT_COMPLETION_SOUND, DEFAULT_COMPLETION_SOUND_TONE, DEFAULT_COMPLETION_SOUND_VOLUME,
  DEFAULT_RUNNING_LABELS, apply,
} from '@deepseek-ai/dsh-client-ui-conversation'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

describe('ui-conversation host', () => {
  it('registers, validates, and disposes the durable busy-Enter preference', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = CONVERSATION_SETTINGS_NAMESPACE
    expect(ctx.settings.get(ns)).toEqual({
      busyEnter: DEFAULT_BUSY_ENTER_BEHAVIOR,
      runningLabels: DEFAULT_RUNNING_LABELS,
      completionSound: DEFAULT_COMPLETION_SOUND,
      completionSoundTone: DEFAULT_COMPLETION_SOUND_TONE,
      completionSoundVolume: DEFAULT_COMPLETION_SOUND_VOLUME,
    })
    await ctx.settings.update(ns, { busyEnter: 'steer' })
    expect(ctx.settings.get(ns)).toEqual({
      busyEnter: 'steer',
      runningLabels: DEFAULT_RUNNING_LABELS,
      completionSound: DEFAULT_COMPLETION_SOUND,
      completionSoundTone: DEFAULT_COMPLETION_SOUND_TONE,
      completionSoundVolume: DEFAULT_COMPLETION_SOUND_VOLUME,
    })
    await ctx.settings.update(ns, { runningLabels: 'Deep diving...\nThinking hard...' })
    expect(ctx.settings.get(ns)).toEqual({ busyEnter: 'steer', runningLabels: 'Deep diving...\nThinking hard...', completionSound: DEFAULT_COMPLETION_SOUND, completionSoundTone: DEFAULT_COMPLETION_SOUND_TONE, completionSoundVolume: DEFAULT_COMPLETION_SOUND_VOLUME })
    await ctx.settings.update(ns, { [COMPLETION_SOUND_FIELD]: false })
    await ctx.settings.update(ns, { completionSoundTone: 'bell', completionSoundVolume: 55 })
    expect(ctx.settings.get(ns)).toEqual({ busyEnter: 'steer', runningLabels: 'Deep diving...\nThinking hard...', completionSound: false, completionSoundTone: 'bell', completionSoundVolume: 55 })
    await expect(ctx.settings.update(ns, { busyEnter: 'invalid' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { runningLabels: 42 })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { [COMPLETION_SOUND_FIELD]: 'invalid' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { completionSoundTone: 'invalid' })).rejects.toThrow()
    await expect(ctx.settings.update(ns, { completionSoundVolume: 101 })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })
})

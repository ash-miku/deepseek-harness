import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import * as HostPlugin from '../src/index.ts'
import { liveConfig, omitsGeneratedPage } from '../../../settings/settings/tests/live-config.ts'
import { plainConfig } from '../../../settings/settings/src/schema.ts'
import {
  DEFAULT_BUSY_ENTER_BEHAVIOR, DEFAULT_COMPLETION_SOUND, DEFAULT_COMPLETION_SOUND_TONE,
  DEFAULT_COMPLETION_SOUND_VOLUME, Config, apply,
} from '@deepseek-ai/dsh-client-ui-conversation'


describe('ui-conversation host', () => {
  it('registers, validates, and disposes the durable conversation preferences', async () => {
    const ctx = new Context()
    const configuration = await liveConfig(ctx, { Config, apply })
    const { fiber } = configuration
    expect(plainConfig(configuration.fiber.config)).toEqual({
      busyEnter: DEFAULT_BUSY_ENTER_BEHAVIOR,
      completionSound: DEFAULT_COMPLETION_SOUND,
      completionSoundTone: DEFAULT_COMPLETION_SOUND_TONE,
      completionSoundVolume: DEFAULT_COMPLETION_SOUND_VOLUME,
    })
    await configuration.update({ busyEnter: 'steer' })
    await configuration.update({
      completionSound: false, completionSoundTone: 'bell', completionSoundVolume: 55,
    })
    expect(plainConfig(configuration.fiber.config)).toEqual({
      busyEnter: 'steer',
      completionSound: false,
      completionSoundTone: 'bell',
      completionSoundVolume: 55,
    })
    await expect(configuration.update({ busyEnter: 'invalid' })).rejects.toThrow()
    await expect(configuration.update({ completionSoundTone: 'invalid' })).rejects.toThrow()
    await expect(configuration.update({ completionSoundVolume: 101 })).rejects.toThrow()
    await fiber.dispose()
  })
})

it('keeps its own instance off the generated Settings pages', () => omitsGeneratedPage(ctx => ctx.plugin(HostPlugin)))

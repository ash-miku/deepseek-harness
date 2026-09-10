import { describe, expect, it } from 'vitest'
import { segmentRunningLabel } from '../src/client/chat/running-label-emoji.ts'

describe('segmentRunningLabel', () => {
  it('keeps plain text in one shimmer segment', () => {
    expect(segmentRunningLabel('Deep diving...')).toEqual([
      { text: 'Deep diving...', emoji: false },
    ])
  })

  it('splits emoji into a native-color segment', () => {
    expect(segmentRunningLabel('Rocket \u{1F680}')).toEqual([
      { text: 'Rocket ', emoji: false },
      { text: '\u{1F680}', emoji: true },
    ])
  })

  it('keeps ZWJ emoji grapheme clusters together', () => {
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'
    const label = 'Team ' + family + ' ready'
    expect(segmentRunningLabel(label)).toEqual([
      { text: 'Team ', emoji: false },
      { text: family, emoji: true },
      { text: ' ready', emoji: false },
    ])
  })

  it('does not treat plain digits as emoji', () => {
    expect(segmentRunningLabel('123')).toEqual([
      { text: '123', emoji: false },
    ])
  })
})

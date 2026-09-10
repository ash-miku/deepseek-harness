/**
 * Split a running-status label into shimmer text and native-color emoji
 * segments. The running label uses text-fill gradient painting, which also
 * paints emoji glyphs blue; wrapping emoji separately lets the platform
 * render them as colored glyphs.
 */

const EMOJI_GRAPHEME = /[\p{Extended_Pictographic}\u200d\ufe0f\u{1f1e6}-\u{1f1ff}\u{1f3fb}-\u{1f3ff}\u20e3]/u

const GRAPHEME_SEGMENTER: Intl.Segmenter | null =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null

/** One contiguous run of a running label that shares a single paint treatment. */
export interface RunningLabelSegment {
  text: string
  emoji: boolean
}

/**
 * Split a running-status label into shimmer text and native-color emoji segments.
 * @param label - the running-status text to split.
 * @returns the contiguous segments in label order, adjacent runs of one treatment merged.
 */
export function segmentRunningLabel(label: string): readonly RunningLabelSegment[] {
  const segments: RunningLabelSegment[] = []
  const push = (text: string, emoji: boolean): void => {
    const previous = segments[segments.length - 1]
    if (previous !== undefined && previous.emoji === emoji) {
      previous.text += text
    } else {
      segments.push({ text, emoji })
    }
  }

  const segmenter = GRAPHEME_SEGMENTER
  if (segmenter === null) {
    push(label, EMOJI_GRAPHEME.test(label))
    return segments
  }

  for (const part of segmenter.segment(label)) {
    push(part.segment, EMOJI_GRAPHEME.test(part.segment))
  }
  return segments
}

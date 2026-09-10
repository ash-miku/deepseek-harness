import { describe, expect, it, vi } from 'vitest'
import { BaselineRetry, baselineRetryDelay } from '../src/client/baseline-retry.ts'

describe('baselineRetryDelay', () => {
  it('doubles from the base delay and saturates at the cap', () => {
    expect(baselineRetryDelay(0)).toBe(250)
    expect(baselineRetryDelay(1)).toBe(500)
    expect(baselineRetryDelay(2)).toBe(1_000)
    expect(baselineRetryDelay(3)).toBe(2_000)
    expect(baselineRetryDelay(4)).toBe(4_000)
    // The exponent clamps at 4, so the effective ceiling is 250ms × 2^4.
    expect(baselineRetryDelay(5)).toBe(4_000)
    expect(baselineRetryDelay(50)).toBe(4_000)
  })
})

describe('BaselineRetry', () => {
  it('is inert until a connection generation is adopted', () => {
    vi.useFakeTimers()
    try {
      const pull = vi.fn()
      const retry = new BaselineRetry(pull)
      expect(retry.schedule()).toBe(false)
      vi.advanceTimersByTime(60_000)
      expect(pull).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('pulls once per scheduled attempt on the shared backoff', () => {
    vi.useFakeTimers()
    try {
      const pull = vi.fn()
      const retry = new BaselineRetry(pull)
      retry.connect()
      expect(retry.schedule()).toBe(true)
      // A second schedule while one is pending is refused, not stacked.
      expect(retry.schedule()).toBe(false)
      vi.advanceTimersByTime(249)
      expect(pull).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(pull).toHaveBeenCalledTimes(1)

      expect(retry.schedule()).toBe(true)
      vi.advanceTimersByTime(499)
      expect(pull).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1)
      expect(pull).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reset cancels the pending attempt and clears the failure budget', () => {
    vi.useFakeTimers()
    try {
      const pull = vi.fn()
      const retry = new BaselineRetry(pull)
      retry.connect()
      retry.schedule()
      retry.schedule()
      retry.reset()
      vi.advanceTimersByTime(60_000)
      expect(pull).not.toHaveBeenCalled()

      // The budget restarted, so the next attempt uses the base delay again.
      expect(retry.schedule()).toBe(true)
      vi.advanceTimersByTime(250)
      expect(pull).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('disconnect stops retries until a later connect re-arms them', () => {
    vi.useFakeTimers()
    try {
      const pull = vi.fn()
      const retry = new BaselineRetry(pull)
      retry.connect()
      retry.schedule()
      retry.disconnect()
      vi.advanceTimersByTime(60_000)
      expect(pull).not.toHaveBeenCalled()
      expect(retry.schedule()).toBe(false)

      retry.connect()
      expect(retry.schedule()).toBe(true)
      vi.advanceTimersByTime(250)
      expect(pull).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})

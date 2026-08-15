// @vitest-environment jsdom
/** DeepseekBalance surface: ready/loading/error renders in wide and rail, and the click drives refresh. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DeepseekBalance } from '../src/client/DeepseekBalance.tsx'
import type { DeepseekBalanceProps } from '../src/client/DeepseekBalance.tsx'
import type { BalanceState } from '../src/client/controller.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'balance.label': 'Balance',
  'balance.loading': 'Loading…',
  'balance.unavailable': 'Balance unavailable',
  'balance.refresh': 'Refresh balance',
  'balance.today': 'Today',
}

function readyState(todayCost?: string): BalanceState {
  return {
    status: 'ready',
    balance: {
      isAvailable: true, currency: 'CNY', totalBalance: '110.00',
      grantedBalance: '10.00', toppedUpBalance: '100.00', cachedAt: 1234,
      ...todayCost === undefined ? {} : { todayCost, todayCurrency: 'CNY' },
    },
  }
}

function mount(state: BalanceState, wide = true) {
  const refresh = vi.fn()
  const useBalance = vi.fn((selector: (s: BalanceState) => BalanceState) => selector(state))
  const props = {
    wide,
    useBalance,
    refresh,
    t: (key: string) => COPY[key] ?? key,
  } as unknown as DeepseekBalanceProps
  render(<DeepseekBalance {...props} />)
  return { refresh }
}

describe('DeepseekBalance', () => {
  it('renders the amount when ready (wide)', () => {
    mount(readyState(), true)
    expect(screen.getByText('Balance ¥110.00')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Refresh balance' }).getAttribute('data-status')).toBe('ready')
    expect(screen.queryByText(/Today/)).toBeNull()
  })

  it('renders today cost when the platform token is configured (wide)', () => {
    mount(readyState('0.80'), true)
    expect(screen.getByText('Balance ¥110.00')).toBeDefined()
    expect(screen.getByText('Today ¥0.80')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Refresh balance' }).getAttribute('data-has-today')).toBe('true')
  })

  it('renders the unavailable label when errored (wide)', () => {
    mount({ status: 'error', error: 'upstream down' }, true)
    expect(screen.getByText('Balance unavailable')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Refresh balance' }).getAttribute('data-status')).toBe('error')
  })

  it('renders the loading label before the first read (wide)', () => {
    mount({ status: 'loading' }, true)
    expect(screen.getByText('Loading…')).toBeDefined()
  })

  it('rail renders the icon only, no amount text', () => {
    mount(readyState(), false)
    expect(screen.queryByText('¥110.00')).toBeNull()
    expect(screen.getByRole('button', { name: 'Refresh balance' })).toBeDefined()
  })

  it('click drives refresh', () => {
    const { refresh } = mount(readyState(), true)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh balance' }))
    expect(refresh).toHaveBeenCalledOnce()
  })
})

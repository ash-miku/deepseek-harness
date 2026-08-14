// @vitest-environment jsdom
/** BalanceController: refresh lifecycle, snapshot publication, and dispose. */

import { describe, expect, it, vi } from 'vitest'
import { BalanceController } from '../src/client/controller.ts'
import type { IApiClient } from '@deepseek-ai/dsh-api-remotes/client'

function balanceView() {
  return {
    isAvailable: true, currency: 'CNY', totalBalance: '110.00',
    grantedBalance: '10.00', toppedUpBalance: '100.00', cachedAt: 1234,
  }
}

function okResult(value: unknown) {
  return { rpcId: 'r' as never, result: { ok: true as const, value } }
}

function errResult(message: string) {
  return { rpcId: 'r' as never, result: { ok: false as const, error: { code: 'deepseek-balance-unavailable', message, details: {} } } }
}

describe('BalanceController', () => {
  it('starts idle and publishes ready after a successful refresh', async () => {
    const api = { balance: vi.fn(async () => okResult({ balance: balanceView() })) } as unknown as IApiClient['deepseek']
    const controller = new BalanceController(api)
    expect(controller.getSnapshot().status).toBe('idle')
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ status: 'ready', balance: balanceView() })
  })

  it('publishes error when the API rejects', async () => {
    const api = { balance: vi.fn(async () => errResult('upstream down')) } as unknown as IApiClient['deepseek']
    const controller = new BalanceController(api)
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ status: 'error', error: 'upstream down' })
  })

  it('notifies subscribers on each state change', async () => {
    const api = { balance: vi.fn(async () => okResult({ balance: balanceView() })) } as unknown as IApiClient['deepseek']
    const controller = new BalanceController(api)
    const listener = vi.fn()
    controller.subscribe(listener)
    await controller.refresh()
    expect(listener).toHaveBeenCalled()
  })

  it('unsubscribe stops notifications', async () => {
    const api = { balance: vi.fn(async () => okResult({ balance: balanceView() })) } as unknown as IApiClient['deepseek']
    const controller = new BalanceController(api)
    const listener = vi.fn()
    const stop = controller.subscribe(listener)
    stop()
    await controller.refresh()
    expect(listener).not.toHaveBeenCalled()
  })

  it('dispose silences further refreshes', async () => {
    const api = { balance: vi.fn(async () => okResult({ balance: balanceView() })) } as unknown as IApiClient['deepseek']
    const controller = new BalanceController(api)
    controller.dispose()
    await controller.refresh()
    expect(api.balance).not.toHaveBeenCalled()
  })
})

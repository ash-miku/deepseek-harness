/**
 * deepseek.balance over createApiProxy: key resolution through the
 * credential seam, the upstream balance read, the five-minute host cache,
 * force bypass, and the failure projection. The key value never leaves the
 * host — the wire carries only the projected balance view.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import SessionStore from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import { CredentialProvider } from '@deepseek-ai/dsh-credentials'
import type { CredentialInfo, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import type { RpcRequest, RpcResponse } from '../src/api/index.ts'
import { RpcId } from '../src/api/rpc.ts'
import { createApiProxy } from '../src/api-proxy.ts'

const DEFAULTS = { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' }

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`req-${String(nextRpc++)}`), payload }
}

function expectOk<T>(response: RpcResponse<T>): T {
  expect(response.result.ok).toBe(true)
  if (!response.result.ok) throw new Error('unreachable')
  return response.result.value
}

function expectErr<T>(response: RpcResponse<T>): { code: string; message: string } {
  expect(response.result.ok).toBe(false)
  if (response.result.ok) throw new Error('unreachable')
  return response.result.error
}

/** In-memory credential provider holding one reference. */
class MemoryCredentials extends CredentialProvider {
  constructor(ctx: ConstructorParameters<typeof CredentialProvider>[0], private readonly key?: string) {
    super(ctx)
  }

  resolve(_ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    return Promise.resolve(this.key === undefined ? undefined : { value: this.key, source: 'file' })
  }

  describe(_ref: CredentialRef): Promise<CredentialInfo> {
    return Promise.resolve({ configured: this.key !== undefined, ...this.key !== undefined ? { source: 'file' } : {}, writable: true })
  }

  set(_ref: CredentialRef, _value: string): Promise<void> {
    return Promise.reject(new Error('not exercised'))
  }

  unset(_ref: CredentialRef): Promise<void> {
    return Promise.reject(new Error('not exercised'))
  }
}

function upstreamBalance(): Record<string, unknown> {
  return {
    is_available: true,
    balance_infos: [{
      currency: 'CNY',
      total_balance: '110.00',
      granted_balance: '10.00',
      topped_up_balance: '100.00',
    }],
  }
}

function upstreamResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

async function harness(credentials?: false | { key?: string }): Promise<{ api: ReturnType<typeof createApiProxy> }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LlmRuntime)
  if (credentials !== false) {
    await ctx.plugin(MemoryCredentials, credentials?.key !== undefined ? credentials.key : undefined)
  }
  ctx.provide('workspaceRegistry', { list: () => [] } as never)
  const api = createApiProxy(ctx, DEFAULTS)
  return { api }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('deepseek.balance', () => {
  it('reports internal when the credential seam is absent', async () => {
    const { api } = await harness(false)
    const error = expectErr(await api.deepseek.balance(request({})))
    expect(error.code).toBe('internal')
  })

  it('reports deepseek-balance-unavailable when the key is not configured', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({})
    const error = expectErr(await api.deepseek.balance(request({})))
    expect(error.code).toBe('deepseek-balance-unavailable')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads the balance through the official endpoint and projects the view', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined
      expect(headers?.Authorization).toContain('Bearer sk-test')
      return upstreamResponse(200, upstreamBalance())
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ key: 'sk-test' })
    const value = expectOk(await api.deepseek.balance(request({})))
    expect(value.balance).toMatchObject({
      isAvailable: true, currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00',
    })
    expect(value.balance.cachedAt).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith('https://api.deepseek.com/user/balance', expect.anything())
  })

  it('serves a fresh reading from the host cache without re-fetching', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(200, upstreamBalance()))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ key: 'sk-test' })
    const first = expectOk(await api.deepseek.balance(request({})))
    const second = expectOk(await api.deepseek.balance(request({})))
    expect(second.balance.cachedAt).toBe(first.balance.cachedAt)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('force bypasses the host cache and re-queries upstream', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(200, upstreamBalance()))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ key: 'sk-test' })
    await api.deepseek.balance(request({}))
    expectOk(await api.deepseek.balance(request({ force: true })))
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('projects an upstream HTTP failure as deepseek-balance-unavailable', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(401, { error: { message: 'invalid key' } }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ key: 'sk-test' })
    const error = expectErr(await api.deepseek.balance(request({})))
    expect(error.code).toBe('deepseek-balance-unavailable')
    expect(error.message).toContain('401')
  })

  it('projects a body without balance_infos as deepseek-balance-unavailable', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(200, { is_available: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ key: 'sk-test' })
    const error = expectErr(await api.deepseek.balance(request({})))
    expect(error.code).toBe('deepseek-balance-unavailable')
  })
})

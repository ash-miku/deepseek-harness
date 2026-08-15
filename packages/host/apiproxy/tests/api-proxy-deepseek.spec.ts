/**
 * deepseek.balance over createApiProxy: key resolution through the
 * credential seam, the upstream balance read, optional today-cost via the
 * platform token, the five-minute host cache, force bypass, and failure
 * projection. Credentials never leave the host — the wire carries only the
 * projected balance view.
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

/** In-memory credential provider holding named references. */
class MemoryCredentials extends CredentialProvider {
  constructor(ctx: ConstructorParameters<typeof CredentialProvider>[0], private readonly values: Record<string, string> = {}) {
    super(ctx)
  }

  resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const value = this.values[ref]
    return Promise.resolve(value === undefined ? undefined : { value, source: 'file' })
  }

  describe(ref: CredentialRef): Promise<CredentialInfo> {
    const configured = this.values[ref] !== undefined
    return Promise.resolve({ configured, ...configured ? { source: 'file' } : {}, writable: true })
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

function upstreamTodayCost(cost = '0.50'): Record<string, unknown> {
  return {
    code: 0,
    data: {
      biz_code: 0,
      biz_data: {
        data: [{
          currency: 'CNY',
          series: [{
            model: 'deepseek-v4-flash',
            buckets: [
              { time: 1786723200, cost: '0.10' },
              { time: 1786726800, cost: '0.20' },
              { time: 1786730400, cost },
            ],
          }],
        }],
      },
    },
  }
}

function upstreamResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

async function harness(credentials?: false | Record<string, string>): Promise<{ api: ReturnType<typeof createApiProxy> }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(UserQuestionService)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LlmRuntime)
  if (credentials !== false) {
    await ctx.plugin(MemoryCredentials, credentials)
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
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test' })
    const value = expectOk(await api.deepseek.balance(request({})))
    expect(value.balance).toMatchObject({
      isAvailable: true, currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00',
    })
    expect(value.balance.cachedAt).toBeGreaterThan(0)
    expect(fetchMock).toHaveBeenCalledWith('https://api.deepseek.com/user/balance', expect.anything())
  })

  it('does not query the private cost endpoint without a platform token', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(200, upstreamBalance()))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test' })
    const value = expectOk(await api.deepseek.balance(request({})))
    expect(value.balance.todayCost).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('queries the platform cost endpoint and includes today cost when configured', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined
      if (String(url).includes('/user/balance')) {
        expect(headers?.Authorization).toContain('Bearer sk-test')
        return upstreamResponse(200, upstreamBalance())
      }
      expect(String(url)).toContain('/api/v0/usage/by_api_key/cost')
      expect(headers?.Authorization).toContain('Bearer pt-test')
      expect(headers?.Origin).toBe('https://platform.deepseek.com')
      return upstreamResponse(200, upstreamTodayCost())
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test', DEEPSEEK_PLATFORM_TOKEN: 'pt-test' })
    const value = expectOk(await api.deepseek.balance(request({})))
    expect(value.balance.todayCost).toBe('0.80')
    expect(value.balance.todayCurrency).toBe('CNY')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps the balance when the private cost endpoint fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/user/balance')) return upstreamResponse(200, upstreamBalance())
      return upstreamResponse(500, {})
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test', DEEPSEEK_PLATFORM_TOKEN: 'pt-test' })
    const value = expectOk(await api.deepseek.balance(request({})))
    expect(value.balance.totalBalance).toBe('110.00')
    expect(value.balance.todayCost).toBeUndefined()
  })

  it('serves a fresh reading from the host cache without re-fetching', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/user/balance')) return upstreamResponse(200, upstreamBalance())
      return upstreamResponse(200, upstreamTodayCost())
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test', DEEPSEEK_PLATFORM_TOKEN: 'pt-test' })
    const first = expectOk(await api.deepseek.balance(request({})))
    const second = expectOk(await api.deepseek.balance(request({})))
    expect(second.balance.cachedAt).toBe(first.balance.cachedAt)
    expect(second.balance.todayCost).toBe(first.balance.todayCost)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('force bypasses the host cache and re-queries upstream', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/user/balance')) return upstreamResponse(200, upstreamBalance())
      return upstreamResponse(200, upstreamTodayCost())
    })
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test', DEEPSEEK_PLATFORM_TOKEN: 'pt-test' })
    await api.deepseek.balance(request({}))
    expectOk(await api.deepseek.balance(request({ force: true })))
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('projects an upstream HTTP failure as deepseek-balance-unavailable', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(401, { error: { message: 'invalid key' } }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test' })
    const error = expectErr(await api.deepseek.balance(request({})))
    expect(error.code).toBe('deepseek-balance-unavailable')
    expect(error.message).toContain('401')
  })

  it('projects a body without balance_infos as deepseek-balance-unavailable', async () => {
    const fetchMock = vi.fn(async () => upstreamResponse(200, { is_available: true }))
    vi.stubGlobal('fetch', fetchMock)
    const { api } = await harness({ DEEPSEEK_API_KEY: 'sk-test' })
    const error = expectErr(await api.deepseek.balance(request({})))
    expect(error.code).toBe('deepseek-balance-unavailable')
  })
})

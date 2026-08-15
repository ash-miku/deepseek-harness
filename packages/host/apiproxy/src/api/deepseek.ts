/**
 * deepseek domain contract: account balance and today's official usage cost
 * for the DeepSeek platform. Balance uses the same `DEEPSEEK_API_KEY` as the
 * llm-deepseek and web-search-deepseek adapters; today's cost is queried
 * through the platform usage endpoint with an optional `DEEPSEEK_PLATFORM_TOKEN`
 * when configured. Neither credential ever crosses the wire. The reading is
 * cached host-side for a short TTL so a settings-surface poll does not hammer
 * the upstream endpoints.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** One balance reading, projected from the upstream `balance_infos` entry. */
export interface DeepseekBalanceView {
  /** Whether the account is currently available for API calls. */
  isAvailable: boolean
  /** Currency code of this entry (e.g. `CNY`, `USD`). */
  currency: string
  /** Total balance as the upstream reports it (decimal string). */
  totalBalance: string
  /** Granted (promotional) portion of the balance. */
  grantedBalance: string
  /** Topped-up (paid) portion of the balance. */
  toppedUpBalance: string
  /** Today's usage cost (official platform figure), present only when the optional platform token is configured. */
  todayCost?: string
  /** Currency of todayCost when present (the cost endpoint carries its own currency). */
  todayCurrency?: string
  /** Epoch milliseconds of the cached reading (the upstream's own time is not exposed). */
  cachedAt: number
}

/** DeepSeek-domain unary methods (the map key deepseek.balance of RpcMethodMap). */
export interface DeepseekApi {
  /**
   * Read the account balance plus today's cost when the optional platform
   * token is configured. `force` bypasses the host-side cache and re-queries
   * upstream; otherwise a fresh cached reading is returned.
   */
  balance(request: RpcRequest<{ force?: boolean }>): Promise<RpcResponse<{ balance: DeepseekBalanceView }>>
}

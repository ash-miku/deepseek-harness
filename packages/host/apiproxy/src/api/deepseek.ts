/**
 * deepseek domain contract: account balance for the DeepSeek official API.
 * The host resolves the credential (the same `DEEPSEEK_API_KEY` the
 * llm-deepseek and web-search-deepseek adapters use) and queries
 * `GET https://api.deepseek.com/user/balance` on the client's behalf — the
 * key never crosses the wire. The value is cached host-side for a short TTL
 * so a settings-surface poll does not hammer the upstream endpoint.
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
  /** Epoch milliseconds of the cached reading (the upstream's own time is not exposed). */
  cachedAt: number
}

/** DeepSeek-domain unary methods (the map key deepseek.balance of RpcMethodMap). */
export interface DeepseekApi {
  /**
   * Read the account balance. `force` bypasses the host-side cache and
   * re-queries upstream; otherwise a fresh cached reading is returned.
   */
  balance(request: RpcRequest<{ force?: boolean }>): Promise<RpcResponse<{ balance: DeepseekBalanceView }>>
}

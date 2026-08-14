/** Injected face for the deepseek-balance sidebar footer action. */

import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceState } from './controller.ts'

/** Live facts and verbs the surface consumes. */
export interface DeepseekBalanceFace {
  hooks: {
    balance: HostObservable<BalanceState>
  }
  /** Force a host-cache-bypassing re-read. */
  refresh: () => void
}

/**
 * deepseek domain zod schemas (names derived from the map key:
 * deepseekBalanceRequestSchema / deepseekBalanceValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { DeepseekBalanceView } from './deepseek.ts'

/** deepseek.balance request payload. */
export const deepseekBalanceRequestSchema = z.object({
  force: z.boolean().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'deepseek.balance'>>>

/** One balance reading on the wire. */
export const deepseekBalanceViewSchema = z.object({
  isAvailable: z.boolean(),
  currency: z.string(),
  totalBalance: z.string(),
  grantedBalance: z.string(),
  toppedUpBalance: z.string(),
  cachedAt: z.number(),
}) satisfies z.ZodType<Wire<DeepseekBalanceView>>

/** deepseek.balance response value. */
export const deepseekBalanceValueSchema = z.object({
  balance: deepseekBalanceViewSchema,
}) satisfies z.ZodType<Wire<ResponseValue<'deepseek.balance'>>>

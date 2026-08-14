/** `deepseek-balance` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'balance.label': '余额',
  'balance.loading': '查询中…',
  'balance.unavailable': '余额不可用',
  'balance.refresh': '刷新余额',
} satisfies Record<string, string>

/** The deepseek-balance namespace key union. */
export type DeepseekBalanceKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The DeepSeek balance surface's copy. */
    'deepseek-balance': DeepseekBalanceKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'balance.label': 'Balance',
  'balance.loading': 'Loading…',
  'balance.unavailable': 'Balance unavailable',
  'balance.refresh': 'Refresh balance',
} satisfies Record<DeepseekBalanceKey, string>

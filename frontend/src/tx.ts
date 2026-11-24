// Trạng thái giao dịch dùng chung: không bao giờ để người dùng không biết chuyện gì đang xảy ra.
export type TxState =
  | { kind: 'idle' }
  | { kind: 'signing' }
  | { kind: 'pending'; hash: `0x${string}` }
  | { kind: 'confirmed'; hash: `0x${string}` }
  | { kind: 'rejected' }
  | { kind: 'failed'; message: string; hash?: `0x${string}` }

export function classifyError(err: unknown): TxState {
  const e = err as { name?: string; shortMessage?: string; message?: string; cause?: { name?: string } }
  const text = `${e?.name ?? ''} ${e?.cause?.name ?? ''} ${e?.shortMessage ?? ''} ${e?.message ?? ''}`
  if (/UserRejected|User rejected|User denied|rejected the request/i.test(text)) return { kind: 'rejected' }
  const msg = (e?.shortMessage ?? e?.message ?? 'Unknown error').split('\n')[0]
  return { kind: 'failed', message: msg.length > 140 ? msg.slice(0, 140) + '...' : msg }
}

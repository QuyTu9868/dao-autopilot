import { useQuery } from '@tanstack/react-query'
import { BLOCKSCOUT } from './config'

type LogItem = { transaction_hash: string; topics: (string | null)[]; data: string }

async function fetchLogs(address: string): Promise<LogItem[]> {
  const res = await fetch(`${BLOCKSCOUT}/addresses/${address}/logs`)
  if (!res.ok) throw new Error(`explorer ${res.status}`)
  return (await res.json()).items ?? []
}

// Tx hash theo từng sự kiện. Nếu explorer lỗi thì trả rỗng: giao diện vẫn chạy, chỉ thiếu link.
export function useLogs(address?: string) {
  return useQuery({
    queryKey: ['logs', address],
    queryFn: () => fetchLogs(address!),
    enabled: !!address,
    refetchInterval: 6000,
    retry: false,
  })
}

export const pad = (v: bigint | string) =>
  (typeof v === 'bigint' ? '0x' + v.toString(16).padStart(64, '0') : '0x' + v.toLowerCase().replace(/^0x/, '').padStart(64, '0')).toLowerCase()

export function findTx(items: LogItem[] | undefined, match: (l: LogItem) => boolean) {
  return items?.find(match)?.transaction_hash as `0x${string}` | undefined
}

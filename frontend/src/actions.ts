import { useQuery } from '@tanstack/react-query'
import { decodeFunctionData, formatEther, formatUnits, type Abi } from 'viem'
import { BLOCKSCOUT } from './config'

// Đọc phần thực thi của một đề xuất từ tx propose (Blockscout giải mã sẵn), rồi giải mã từng lệnh gọi bằng ABI đã verify.
type Info = { name?: string; abi?: Abi } | null
const infoCache = new Map<string, Promise<Info>>()

function contractInfo(address: string): Promise<Info> {
  const key = address.toLowerCase()
  if (!infoCache.has(key)) {
    infoCache.set(
      key,
      fetch(`${BLOCKSCOUT}/smart-contracts/${address}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d?.abi ? { name: d.name as string, abi: d.abi as Abi } : null))
        .catch(() => null),
    )
  }
  return infoCache.get(key)!
}

const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

function fmtArg(v: unknown): string {
  if (typeof v === 'bigint') return v >= 10n ** 15n ? Number(formatUnits(v, 18)).toLocaleString('en-US') : v.toString()
  if (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)) return short(v)
  if (Array.isArray(v)) return `[${v.map(fmtArg).join(', ')}]`
  return String(v)
}

const ZERO = '0x0000000000000000000000000000000000000000'

async function load(hash: string): Promise<string[]> {
  const res = await fetch(`${BLOCKSCOUT}/transactions/${hash}`)
  if (!res.ok) throw new Error('explorer')
  const tx = await res.json()
  const params: { name: string; value: unknown }[] | undefined = tx.decoded_input?.parameters
  if (!params) throw new Error('not indexed yet')
  const get = (n: string) => (params.find((p) => p.name === n)?.value ?? []) as string[]
  const targets = get('targets')
  const values = get('values')
  const calldatas = get('calldatas')
  const lines: string[] = []
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i]
    const value = BigInt(values[i] ?? '0')
    const data = (calldatas[i] ?? '0x') as `0x${string}`
    const eth = value > 0n ? `, sends ${formatEther(value)} ETH` : ''
    if (data === '0x') {
      lines.push(target.toLowerCase() === ZERO && value === 0n ? 'No on-chain action (signal proposal)' : `Plain transfer to ${short(target)}${eth}`)
      continue
    }
    const info = await contractInfo(target)
    try {
      if (!info?.abi) throw new Error('no abi')
      const d = decodeFunctionData({ abi: info.abi, data })
      lines.push(`${info.name ?? short(target)}.${d.functionName}(${(d.args ?? []).map(fmtArg).join(', ')})${eth}`)
    } catch {
      lines.push(`Call to ${info?.name ?? short(target)} with data ${data.slice(0, 10)}...${eth}`)
    }
  }
  return lines
}

export function useActions(hash?: string) {
  return useQuery({
    queryKey: ['actions', hash],
    queryFn: () => load(hash!),
    enabled: !!hash,
    staleTime: Infinity,
    retry: 4,
    retryDelay: 3000,
  })
}

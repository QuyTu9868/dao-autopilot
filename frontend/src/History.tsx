import { useReadContract, useReadContracts } from 'wagmi'
import { HUB, chain, hubAbi, voterAbi } from './config'
import { cleanTitle } from './Proposals'
import type { useSetup } from './useAutopilot'

type Setup = ReturnType<typeof useSetup>
const SHOW = 10
const VERDICT = ['', 'For', 'Against', 'Skip'] as const
const TONE = ['', 'for', 'against', 'skip'] as const

// Lịch sử của một Voter: bộ đếm và các đề xuất đã chấm gần nhất, đọc thẳng từ contract.
export function History({ s }: { s: Setup }) {
  const voter = s.voter!
  const common = { address: voter, abi: voterAbi, chainId: chain.id } as const
  const counters = useReadContracts({
    contracts: (['forCount', 'againstCount', 'skipCount', 'vetoCount', 'lowConfidenceCount', 'judgedCount'] as const).map((fn) => ({ ...common, functionName: fn })),
    query: { refetchInterval: 5000 },
  })
  const c = (counters.data ?? []).map((r) => (r.status === 'success' ? Number(r.result) : 0))
  const total = c[5] ?? 0
  const idx = Array.from({ length: Math.min(total, SHOW) }, (_, i) => total - 1 - i)
  const ids = useReadContracts({
    contracts: idx.map((i) => ({ ...common, functionName: 'judgedAt', args: [BigInt(i)] }) as const),
    query: { enabled: idx.length > 0 },
  })
  const pids = (ids.data ?? []).flatMap((r) => (r.status === 'success' ? [r.result as bigint] : []))
  const results = useReadContracts({
    contracts: pids.map((p) => ({ ...common, functionName: 'results', args: [p] }) as const),
    query: { enabled: pids.length > 0, refetchInterval: 5000 },
  })

  // Tiêu đề lấy từ danh sách đề xuất trên Hub
  const count = useReadContract({ address: HUB, abi: hubAbi, functionName: 'proposalCount', chainId: chain.id })
  const n = Number(count.data ?? 0n)
  const hubIdx = Array.from({ length: Math.min(n, 60) }, (_, i) => n - 1 - i)
  const hubItems = useReadContracts({
    contracts: hubIdx.map((i) => ({ address: HUB, abi: hubAbi, functionName: 'proposalAt', args: [BigInt(i)], chainId: chain.id }) as const),
    query: { enabled: hubIdx.length > 0 && pids.length > 0 },
  })
  const titles = new Map<string, string>()
  for (const r of hubItems.data ?? []) if (r.status === 'success') titles.set((r.result as { id: bigint }).id.toString(), (r.result as { title: string }).title)

  return (
    <section className="history" aria-labelledby="history-h">
      <h3 id="history-h">History</h3>
      <p className="counts">
        For {c[0] ?? 0} <span className="sep" aria-hidden="true">/</span> Against {c[1] ?? 0} <span className="sep" aria-hidden="true">/</span> Skipped {c[2] ?? 0}{' '}
        <span className="sep" aria-hidden="true">/</span> Vetoed {c[3] ?? 0} <span className="sep" aria-hidden="true">/</span> Below threshold {c[4] ?? 0}
      </p>
      {total === 0 ? (
        <p className="note">Nothing judged yet. Verdicts for your voter will collect here.</p>
      ) : (
        <ol className="hlist">
          {pids.map((p, i) => {
            const r = results.data?.[i]?.status === 'success' ? (results.data[i].result as unknown as readonly [number, number, boolean, boolean, number, string]) : undefined
            const v = r?.[0] ?? 0
            const status = !r ? '' : !r[2] ? 'pending' : r[3] ? 'vetoed' : v === 3 ? 'skipped' : r[1] < s.minConf ? 'below threshold' : 'voted'
            return (
              <li key={p.toString()}>
                <span className="htitle">{cleanTitle(titles.get(p.toString()) ?? `Proposal ...${p.toString().slice(-6)}`)}</span>
                <span className="hmeta">
                  <span className={`verdict ${TONE[v]}`}>{VERDICT[v] || '...'}</span> {r ? `${r[1]}%, ${status}` : ''}
                </span>
                {r?.[5] && <span className="hreason">{r[5]}</span>}
              </li>
            )
          })}
        </ol>
      )}
      {total > SHOW && <p className="note">Showing the latest {SHOW} of {total}.</p>}
    </section>
  )
}

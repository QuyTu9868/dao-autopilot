import { useEffect, useRef, useState } from 'react'
import { useReadContract, useReadContracts, useWriteContract, usePublicClient } from 'wagmi'
import { decodeEventLog, encodeFunctionData, formatUnits, keccak256, toBytes, toEventSelector, zeroAddress } from 'viem'
import { AGENT_NAMES, HUB, chain, governorAbi, hubAbi, tokenAbi, voterAbi } from './config'
import { Action, TxLink } from './Action'
import { useActions } from './actions'
import { findTx, pad, useLogs } from './useExplorerEvents'
import type { useSetup } from './useAutopilot'

type Setup = ReturnType<typeof useSetup>
export type Posted = { id: bigint; governor: string; title: string; hash: `0x${string}` }
type Result = readonly [number, number, boolean, boolean, number, string] // verdict, confidence, voted, vetoed, readyAt, reason
type AgentSay = { agent: string; verdict: number; confidence: number; reason: string }

// Ví nhận mẫu cho các đề xuất có lệnh chuyển token (không thuộc ai, chỉ để demo).
const PAYEE = '0x7a3b5c1f9e2d4a6b8c0d1e3f5a7b9c1d3e5f7a9b' as const
type Preset = { label: string; text: string; transfer?: bigint }
function presetsFor(symbol: string): Preset[] {
  const audit = `Pay 5,000 ${symbol} to the auditor for a security audit of the core contracts`
  return [
    { label: 'Bug bounty, 5 percent of treasury', text: 'Allocate 5 percent of the treasury to a bug bounty program for the core contracts' },
    { label: 'Halve the audit budget', text: 'Cut the security audit budget in half to fund a marketing campaign' },
    { label: 'Dark mode for the dashboard', text: 'Add a dark mode option to the community dashboard' },
    { label: `Pay auditor 5,000 ${symbol}`, text: audit, transfer: 5_000n * 10n ** 18n },
    { label: `Pay auditor 5,000 ${symbol} (sends 50,000)`, text: audit, transfer: 50_000n * 10n ** 18n },
  ]
}

const SHOW = 8
const SCAN = 40 // số đề xuất gần nhất trên Hub để lọc theo DAO
const STATE_ENDED = 3 // Defeated, Succeeded and later states
const VERDICT = ['', 'For', 'Against', 'Skip'] as const
const TONE = ['', 'for', 'against', 'skip'] as const

const T_REVIEW = toEventSelector('event ReviewRequested(address indexed governor, uint256 indexed proposalId)')
const T_VERDICT = toEventSelector('event VerdictSubmitted(address indexed voter, uint256 indexed proposalId, uint8 verdict, uint8 confidence, string reason, uint256 readyAt)')
const T_AGENT = toEventSelector('event AgentVerdict(address indexed voter, uint256 indexed proposalId, address indexed agent, uint8 verdict, uint8 confidence, string reason)')
const T_VOTED = toEventSelector('event Voted(uint256 indexed proposalId, uint8 support, bool byVerdict)')
const T_SKIPPED = toEventSelector('event VoteSkipped(uint256 indexed proposalId, string why)')
const T_CREATED = toEventSelector('event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)')

export const cleanTitle = (t: string) => t.replace(/ \(#[0-9a-f]{4}\)$/, '').replace(/ \(run \d+\)( [AB])?$/, '').replace(/ \d{9,}$/, '')

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

const clock = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
const fmt = (v?: bigint) => (v === undefined ? '0' : Number(formatUnits(v, 18)).toLocaleString('en-US'))
const agentName = (a: string) => AGENT_NAMES[a.toLowerCase()] ?? `${a.slice(0, 6)}...${a.slice(-4)}`

export function Proposals({ s, posted, onPosted }: { s: Setup; posted: Posted[]; onPosted: (p: Posted) => void }) {
  const now = useNow()
  const ready = s.current === -1
  const gov = s.dao.governor.toLowerCase()
  const count = useReadContract({ address: HUB, abi: hubAbi, functionName: 'proposalCount', chainId: chain.id, query: { refetchInterval: 3000 } })
  const threshold = useReadContract({ address: HUB, abi: hubAbi, functionName: 'threshold', chainId: chain.id })
  const n = Number(count.data ?? 0n)
  const idxs = Array.from({ length: Math.min(n, SCAN) }, (_, i) => n - 1 - i)
  const items = useReadContracts({
    contracts: idxs.map((i) => ({ address: HUB, abi: hubAbi, functionName: 'proposalAt', args: [BigInt(i)], chainId: chain.id }) as const),
    query: { enabled: idxs.length > 0, refetchInterval: 5000 },
  })

  const fromHub = (items.data ?? [])
    .flatMap((r) => (r.status === 'success' ? [r.result as { governor: string; id: bigint; title: string }] : []))
    .filter((p) => p.governor.toLowerCase() === gov)
  const hubIds = new Set(fromHub.map((p) => p.id.toString()))
  const waiting = posted.filter((p) => p.governor.toLowerCase() === gov && !hubIds.has(p.id.toString()))
  const list = [...waiting.map((p) => ({ id: p.id, title: p.title, inHub: false })), ...fromHub.map((p) => ({ id: p.id, title: p.title, inHub: true }))].slice(0, SHOW)

  const voterAddr = s.voter ?? zeroAddress
  const detail = useReadContracts({
    contracts: list.flatMap((p) => [
      { address: s.dao.governor, abi: governorAbi, functionName: 'state', args: [p.id], chainId: chain.id },
      { address: s.dao.governor, abi: governorAbi, functionName: 'proposalVotes', args: [p.id], chainId: chain.id },
      { address: s.dao.governor, abi: governorAbi, functionName: 'proposalSnapshot', args: [p.id], chainId: chain.id },
      { address: s.dao.governor, abi: governorAbi, functionName: 'proposalDeadline', args: [p.id], chainId: chain.id },
      { address: voterAddr, abi: voterAbi, functionName: 'results', args: [p.id], chainId: chain.id },
    ] as const),
    query: { enabled: list.length > 0, refetchInterval: 3000 },
  })

  const hubLogs = useLogs(HUB)
  const voterLogs = useLogs(s.voter)
  const govLogs = useLogs(s.dao.governor)

  return (
    <section aria-labelledby="proposals-h" className="proposals">
      <h2 id="proposals-h">Proposals in {s.dao.name}</h2>
      <PostProposal ready={ready} s={s} onPosted={onPosted} />
      {list.length === 0 ? (
        <p className="empty">No proposals in {s.dao.name} yet. Post one above and watch it get read, judged and voted.</p>
      ) : (
        <ul className="plist">
          {list.map((p, i) => {
            const d = detail.data?.slice(i * 5, i * 5 + 5)
            const state = d?.[0]?.status === 'success' ? Number(d[0].result) : undefined
            const votes = d?.[1]?.status === 'success' ? (d[1].result as readonly [bigint, bigint, bigint]) : undefined
            const snap = d?.[2]?.status === 'success' ? Number(d[2].result) : 0
            const end = d?.[3]?.status === 'success' ? Number(d[3].result) : 0
            const res = d?.[4]?.status === 'success' ? (d[4].result as unknown as Result) : undefined
            const pid = pad(p.id)
            const me = s.voter ? pad(s.voter) : undefined
            const post =
              posted.find((x) => x.id === p.id)?.hash ?? findTx(govLogs.data, (l) => l.topics[0] === T_CREATED && l.data.slice(0, 66).toLowerCase() === pid)
            const review = findTx(hubLogs.data, (l) => l.topics[0] === T_REVIEW && l.topics[2] === pid)
            const verdictTx = findTx(hubLogs.data, (l) => l.topics[0] === T_VERDICT && l.topics[2] === pid && !!me && l.topics[1]?.toLowerCase() === me)
            const voteTx = findTx(voterLogs.data, (l) => (l.topics[0] === T_VOTED || l.topics[0] === T_SKIPPED) && l.topics[1] === pid)
            const agents: AgentSay[] = (hubLogs.data ?? [])
              .filter((l) => l.topics[0] === T_AGENT && l.topics[2] === pid && !!me && l.topics[1]?.toLowerCase() === me)
              .flatMap((l) => {
                try {
                  const ev = decodeEventLog({ abi: hubAbi, data: l.data as `0x${string}`, topics: l.topics as [`0x${string}`, ...`0x${string}`[]] })
                  const a = ev.args as unknown as { agent: string; verdict: number; confidence: number; reason: string }
                  return [{ agent: a.agent, verdict: Number(a.verdict), confidence: Number(a.confidence), reason: a.reason }]
                } catch {
                  return []
                }
              })
            return (
              <ProposalRow
                key={p.id.toString()}
                id={p.id}
                title={cleanTitle(p.title)}
                inHub={p.inHub}
                state={state}
                votes={votes}
                timing={timing(state, snap, end, now)}
                res={res}
                agents={agents}
                threshold={Number(threshold.data ?? 1)}
                now={now}
                s={s}
                txs={{ post, review, verdict: verdictTx, vote: voteTx }}
              />
            )
          })}
        </ul>
      )}
    </section>
  )
}

function timing(state: number | undefined, snap: number, end: number, now: number) {
  if (state === 0) return `Voting opens in ${clock(Math.max(0, snap - now))}`
  if (state === 1) return `Voting closes in ${clock(Math.max(0, end - now))}`
  return state === undefined ? '' : 'Voting closed'
}

function PostProposal({ ready, s, onPosted }: { ready: boolean; s: Setup; onPosted: (p: Posted) => void }) {
  const [text, setText] = useState('')
  const [transfer, setTransfer] = useState<bigint | undefined>()
  const lastDesc = useRef('')
  const lastCall = useRef<{ targets: readonly `0x${string}`[]; values: readonly bigint[]; calldatas: readonly `0x${string}`[] }>({ targets: [], values: [], calldatas: [] })
  const { writeContractAsync } = useWriteContract()
  const client = usePublicClient({ chainId: chain.id })
  const empty = text.trim().length === 0
  const presets = presetsFor(s.dao.symbol)

  if (!ready)
    return <p className="note gate">Finish your autopilot setup for {s.dao.name} first. Posting a proposal needs a funded wallet, tokens, a voter and a policy.</p>

  const call = () =>
    transfer
      ? { targets: [s.dao.token] as const, values: [0n] as const, calldatas: [encodeFunctionData({ abi: tokenAbi, functionName: 'transfer', args: [PAYEE, transfer] })] as const }
      : { targets: [zeroAddress] as const, values: [0n] as const, calldatas: ['0x'] as const }
  const description = () => `${text.trim()} (#${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')})`

  return (
    <div className="post">
      <label htmlFor="proposal">Post a test proposal</label>
      <input
        id="proposal"
        type="text"
        maxLength={140}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setTransfer(undefined)
        }}
        placeholder="Describe what the DAO should do"
      />
      <div className="presets" role="group" aria-label="Example proposals">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            onClick={() => {
              setText(p.text)
              setTransfer(p.transfer)
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="note">
        {transfer
          ? `On-chain action: transfer ${Number(formatUnits(transfer, 18)).toLocaleString('en-US')} ${s.dao.symbol} to ${PAYEE.slice(0, 6)}...${PAYEE.slice(-4)}${s.dao.treasury ? ', paid from the treasury if the proposal passes' : ''}. The AI checks it against the text.`
          : 'On-chain action: none, this is a signal proposal.'}
      </p>
      <p className="note">Anyone can post. Voting opens after 1 minute and runs for 5 minutes. Your delegated votes are counted at the moment it opens.</p>
      <Action
        label="Post proposal"
        disabled={empty || !s.voter}
        run={async () => {
          lastDesc.current = description()
          lastCall.current = call()
          const c = lastCall.current
          return writeContractAsync({ address: s.dao.governor, abi: governorAbi, functionName: 'propose', args: [c.targets, c.values, c.calldatas, lastDesc.current], chainId: chain.id })
        }}
        onConfirmed={async (hash) => {
          const c = lastCall.current
          const id = await client!.readContract({
            address: s.dao.governor,
            abi: governorAbi,
            functionName: 'hashProposal',
            args: [c.targets, c.values, c.calldatas, keccak256(toBytes(lastDesc.current))],
          })
          onPosted({ id, governor: s.dao.governor, title: lastDesc.current, hash })
          setText('')
          setTransfer(undefined)
        }}
      />
    </div>
  )
}

type Stop = { key: string; label: string; done: boolean; tone: string; tx?: `0x${string}` }

function ProposalRow({ id, title, inHub, state, votes, timing, res, agents, threshold, now, s, txs }: {
  id: bigint
  title: string
  inHub: boolean
  state?: number
  votes?: readonly [bigint, bigint, bigint]
  timing: string
  res?: Result
  agents: AgentSay[]
  threshold: number
  now: number
  s: Setup
  txs: { post?: `0x${string}`; review?: `0x${string}`; verdict?: `0x${string}`; vote?: `0x${string}` }
}) {
  const { writeContractAsync } = useWriteContract()
  const verdict = res?.[0] ?? 0
  const confidence = res?.[1] ?? 0
  const voted = res?.[2] ?? false
  const vetoed = res?.[3] ?? false
  const readyAt = res?.[4] ?? 0
  const reason = res?.[5] ?? ''
  const ended = state !== undefined && state >= STATE_ENDED
  const belowThreshold = (verdict === 1 || verdict === 2) && confidence < s.minConf
  const didVote = voted && !vetoed && verdict !== 3 && !belowThreshold
  const disagree = verdict === 0 && agents.length >= threshold && new Set(agents.map((a) => a.verdict)).size > 1
  const secondsLeft = readyAt - now
  const canVeto = verdict > 0 && !voted && !vetoed && !ended
  const actions = useActions(txs.post)

  const stops: Stop[] = [
    { key: 'posted', label: 'Posted', done: true, tone: 'info', tx: txs.post },
    { key: 'relayed', label: 'Relayed', done: inHub, tone: 'info', tx: txs.review },
    { key: 'verdict', label: disagree ? 'Sources disagree' : 'Verdict', done: verdict > 0 || disagree, tone: disagree ? 'skip' : TONE[verdict] || 'info', tx: txs.verdict },
    {
      key: 'vote',
      label: !voted ? 'Vote' : vetoed ? 'Vetoed' : didVote ? `Voted ${VERDICT[verdict]}` : 'Not voted',
      done: voted,
      tone: !voted ? 'info' : didVote ? TONE[verdict] : 'skip',
      tx: txs.vote,
    },
  ]
  const pendingIdx = ended || disagree ? -1 : stops.findIndex((x) => !x.done)

  let outcome: string
  if (!s.voter || !s.policy) outcome = `Set up your autopilot in ${s.dao.name} to have this proposal judged and voted for you.`
  else if (disagree) outcome = 'The AI sources disagree, so no verdict is final and your voter does not vote.'
  else if (verdict === 0) outcome = ended ? 'No verdict arrived before voting closed.' : inHub ? 'The AI sources are reading this proposal against your policy.' : 'Waiting for Reactive to pick this proposal up.'
  else if (voted && vetoed) outcome = 'You vetoed this vote, so your voter did not vote.'
  else if (voted && verdict === 3) outcome = 'The AI judged this unrelated or unclear, so your voter skipped it.'
  else if (voted && belowThreshold) outcome = `The AI was ${confidence}% confident, below your ${s.minConf}% threshold, so your voter did not vote.`
  else if (voted) outcome = `Your voter voted ${VERDICT[verdict]} with your delegated tokens.`
  else if (vetoed) outcome = 'You vetoed this vote. Reactive will close it out after the window.'
  else if (ended) outcome = 'The verdict arrived after voting closed, so no vote was cast.'
  else if (secondsLeft > 0) outcome = `Your voter votes ${VERDICT[verdict]} in ${secondsLeft} s unless you veto.`
  else outcome = 'Veto window over. Reactive is sending the vote.'

  return (
    <li className="proposal">
      <div className="p-head">
        <h3>{title}</h3>
        <span className={`badge ${state === 1 ? 'open' : state === undefined || state === 0 ? 'wait' : 'closed'}`}>
          {state === 1 ? 'Open' : state === 0 ? 'Opens soon' : state === undefined ? 'Loading' : 'Closed'}
        </span>
      </div>
      <p className="p-meta">
        {timing}
        {votes && (
          <>
            {' '}
            <span className="sep" aria-hidden="true">/</span> For {fmt(votes[1])} <span className="sep" aria-hidden="true">/</span> Against {fmt(votes[0])}{' '}
            <span className="sep" aria-hidden="true">/</span> Abstain {fmt(votes[2])}
          </>
        )}
      </p>
      <ol className="trail" aria-label="Progress">
        {stops.map((st, i) => (
          <li key={st.key} className={`tstop ${st.done ? 'done' : i === pendingIdx ? 'now' : 'todo'} ${st.done ? st.tone : ''}`}>
            <span className="dot" aria-hidden="true" />
            <span className="tlabel">{st.label}</span>
            <span className="tlink">{st.tx && <TxLink hash={st.tx} text="tx" />}</span>
          </li>
        ))}
      </ol>
      <div className="actions">
        <span className="alabel">On-chain actions</span>
        {actions.data ? (
          <ol>
            {actions.data.map((a, k) => (
              <li key={k}>{a}</li>
            ))}
          </ol>
        ) : (
          <p>{actions.isError ? 'Could not read the actions from the explorer.' : txs.post ? 'Reading actions...' : 'Not found yet.'}</p>
        )}
      </div>
      <p className="outcome">{outcome}</p>
      {canVeto && (
        <div className="veto">
          <Action
            label={secondsLeft > 0 ? `Veto this vote (${secondsLeft} s left)` : 'Veto this vote'}
            tone="coral"
            run={() => writeContractAsync({ address: s.voter!, abi: voterAbi, functionName: 'veto', args: [id], chainId: chain.id })}
          />
        </div>
      )}
      {verdict > 0 && reason && (
        <p className="reason">
          <span className={`verdict ${TONE[verdict]}`}>{VERDICT[verdict]}</span> {confidence}% confident. {reason}
        </p>
      )}
      {agents.length > 0 && (
        <ul className="sources" aria-label="AI sources">
          {agents.map((a) => (
            <li key={a.agent}>
              <span className={`verdict ${TONE[a.verdict]}`}>{VERDICT[a.verdict]}</span> {agentName(a.agent)}, {a.confidence}%
              {disagree && <span className="sreason">: {a.reason}</span>}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

import { useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useSwitchChain, useWriteContract } from 'wagmi'
import { formatEther, formatUnits } from 'viem'
import { DRIP_URL, EXPLORER, FAUCET_URL, HUB, MINT_AMOUNT, chain, hubAbi, tokenAbi, voterAbi } from './config'
import { Action } from './Action'
import { useSetup } from './useAutopilot'

const EXAMPLE_POLICY =
  'Support spending on security, audits and bug bounties. Oppose any proposal that cuts the security budget or raises pay for core team members. If a proposal is unrelated or unclear, skip it.'

const NO_HASH = '0x' as `0x${string}`

type Setup = ReturnType<typeof useSetup>

export function SetupRoute({ s }: { s: Setup }) {
  const titles = ['Connect a wallet with gas', `Get ${s.dao.symbol} tokens`, 'Create your voter', 'Delegate your votes', 'Write your policy']
  return (
    <ol className="route">
      {titles.map((title, i) => {
        const state = i === s.current ? 'current' : s.done[i] ? 'done' : 'locked'
        return (
          <li key={title} className={`stop ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="node" aria-hidden="true">
              {state === 'done' ? <Check /> : i + 1}
            </span>
            <div className="stopbody">
              <h3>{title}</h3>
              {state === 'locked' && <p className="note">Needs: {titles[i - 1].toLowerCase()}.</p>}
              {state === 'current' && <Step index={i} s={s} />}
              {state === 'done' && <DoneSummary index={i} s={s} />}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.2 3.2L13 4.8" />
    </svg>
  )
}

function DoneSummary({ index, s }: { index: number; s: Setup }) {
  const [editing, setEditing] = useState(false)
  if (index === 0) return <p className="note">Connected to {chain.name}.</p>
  if (index === 1) return <p className="note">1,000 {s.dao.symbol} minted.</p>
  if (index === 2)
    return (
      <p className="note">
        <a href={`${EXPLORER}/address/${s.voter}`} target="_blank" rel="noreferrer">
          {s.voter?.slice(0, 8)}...{s.voter?.slice(-6)}
        </a>
      </p>
    )
  if (index === 3) return <p className="note">Your voter holds your voting power.</p>
  return (
    <div>
      {editing ? (
        <PolicyEditor s={s} onSaved={() => setEditing(false)} />
      ) : (
        <>
          <p className="policy-preview">{s.policy}</p>
          <p className="note">
            Votes when at least {s.minConf}% confident. {s.vetoWindow > 0 ? `You get ${s.vetoWindow} seconds to veto each vote.` : 'No veto window.'}
          </p>
          <button type="button" className="textbtn" onClick={() => setEditing(true)}>
            Edit policy and settings
          </button>
        </>
      )}
    </div>
  )
}

function Step({ index, s }: { index: number; s: Setup }) {
  if (index === 0) return <ConnectStep s={s} />
  if (index === 1) return <MintStep s={s} />
  if (index === 2) return <VoterStep s={s} />
  if (index === 3) return <DelegateStep s={s} />
  return <PolicyEditor s={s} />
}

function ConnectStep({ s }: { s: Setup }) {
  const { switchChainAsync } = useSwitchChain()
  if (!s.isConnected)
    return (
      <>
        <p className="note">Use a test wallet. Nothing here uses real money.</p>
        <ConnectButton.Custom>
          {({ openConnectModal }) => (
            <button type="button" className="capsule" onClick={openConnectModal}>
              Connect wallet
            </button>
          )}
        </ConnectButton.Custom>
      </>
    )
  if (!s.rightChain)
    return (
      <>
        <p className="note">Your wallet is on another network. Switch to {chain.name} to continue.</p>
        <Action
          label={`Switch to ${chain.name}`}
          tone="blue"
          run={async () => {
            await switchChainAsync({ chainId: chain.id })
            return NO_HASH
          }}
        />
      </>
    )
  return <GasStep s={s} />
}

// Ví chưa có gas: xin 0.002 ETH test từ dịch vụ của dự án, hoặc dùng faucet công khai.
function GasStep({ s }: { s: Setup }) {
  const [state, setState] = useState<{ kind: 'idle' | 'asking' | 'sent' | 'error'; text?: string; hash?: string }>({ kind: 'idle' })
  async function ask() {
    setState({ kind: 'asking' })
    try {
      const res = await fetch(`${DRIP_URL}/drip`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: s.address }),
        signal: AbortSignal.timeout(90_000),
      })
      const body = await res.json().catch(() => ({}))
      if (res.ok) setState({ kind: 'sent', hash: body.hash })
      else setState({ kind: 'error', text: body.error || `Request failed (${res.status}).` })
    } catch {
      setState({ kind: 'error', text: 'The gas service did not answer. It may be waking up, try again in a minute.' })
    }
  }
  return (
    <>
      <p className="note">
        {s.ethLoaded ? 'This wallet has no Base Sepolia ETH to pay for gas.' : 'Checking your balance.'} New test wallets can get 0.002 ETH from us, enough for the whole demo.
      </p>
      <div className="action">
        <button type="button" className="capsule" onClick={ask} disabled={state.kind === 'asking' || state.kind === 'sent'}>
          {state.kind === 'asking' ? 'Sending test ETH' : state.kind === 'sent' ? 'Test ETH sent' : 'Get free test gas'}
        </button>
        <p className={`txline ${state.kind === 'error' ? 'failed' : ''}`} role="status" aria-live="polite">
          {state.kind === 'asking' && 'Asking the DAO Autopilot service. This can take up to a minute if it was asleep.'}
          {state.kind === 'sent' && (
            <>
              Sent. This step continues by itself once it lands.{' '}
              <a href={`${EXPLORER}/tx/${state.hash}`} target="_blank" rel="noreferrer">
                View transaction
              </a>
            </>
          )}
          {state.kind === 'error' && state.text}
        </p>
      </div>
      <p className="note">
        Or use a public{' '}
        <a href={FAUCET_URL} target="_blank" rel="noreferrer">
          Base Sepolia faucet
        </a>
        .
      </p>
    </>
  )
}

function MintStep({ s }: { s: Setup }) {
  const { writeContractAsync } = useWriteContract()
  return (
    <>
      <p className="note">
        {s.dao.symbol} is the voting token of {s.dao.name}. Each wallet can mint up to {formatUnits(MINT_AMOUNT, 18)}.
      </p>
      <Action
        label={`Mint 1,000 ${s.dao.symbol}`}
        run={() => writeContractAsync({ address: s.dao.token, abi: tokenAbi, functionName: 'mint', args: [MINT_AMOUNT], chainId: chain.id })}
      />
    </>
  )
}

function VoterStep({ s }: { s: Setup }) {
  const { writeContractAsync } = useWriteContract()
  return (
    <>
      <p className="note">
        Your voter is a small contract that holds your policy and votes for you in {s.dao.name}. One per wallet, you stay the owner. It costs{' '}
        {formatEther(s.fee)} ETH once, which pays for your voter's Reactive callbacks and keeps spam voters out.
      </p>
      <Action
        label="Create my voter"
        run={() =>
          writeContractAsync({ address: HUB, abi: hubAbi, functionName: 'createVoter', args: [s.dao.governor], value: s.fee, chainId: chain.id })
        }
      />
    </>
  )
}

function DelegateStep({ s }: { s: Setup }) {
  const { writeContractAsync } = useWriteContract()
  return (
    <>
      <p className="note">
        Your voter can only vote with tokens delegated to it. Do this before a proposal is posted: votes are counted from the moment a proposal opens.
      </p>
      <Action
        label="Delegate to my voter"
        run={() => writeContractAsync({ address: s.dao.token, abi: tokenAbi, functionName: 'delegate', args: [s.voter!], chainId: chain.id })}
      />
    </>
  )
}

function PolicyEditor({ s, onSaved }: { s: Setup; onSaved?: () => void }) {
  const [text, setText] = useState(s.policy)
  const [conf, setConf] = useState<number>(s.minConf)
  const [veto, setVeto] = useState<number>(s.vetoWindow)
  const { writeContractAsync } = useWriteContract()
  const bytes = new TextEncoder().encode(text).length
  const tooLong = bytes > 1000
  const empty = text.trim().length === 0
  const policyChanged = text.trim() !== s.policy
  const confChanged = conf !== s.minConf
  const vetoChanged = veto !== s.vetoWindow
  const changes = [confChanged, vetoChanged, policyChanged].filter(Boolean).length

  return (
    <div className="editor">
      <label htmlFor="policy">Your voting policy, in plain language</label>
      <textarea
        id="policy"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Example: support spending on security, oppose pay raises for the core team."
      />
      <div className="editor-row">
        <button type="button" className="textbtn" onClick={() => setText(EXAMPLE_POLICY)}>
          Use an example
        </button>
        <span className={tooLong ? 'count over' : 'count'}>{bytes} / 1000 bytes</span>
      </div>
      <label htmlFor="conf">Only vote when the AI is at least this confident</label>
      <div className="conf">
        <input id="conf" type="range" min={50} max={95} step={5} value={conf} onChange={(e) => setConf(Number(e.target.value))} />
        <output htmlFor="conf">{conf}%</output>
      </div>
      <label htmlFor="veto">Veto window: time you get to block each vote</label>
      <div className="conf">
        <input id="veto" type="range" min={0} max={180} step={15} value={veto} onChange={(e) => setVeto(Number(e.target.value))} />
        <output htmlFor="veto">{veto === 0 ? 'off' : `${veto} s`}</output>
      </div>
      <p className="note">Below the confidence, or if you veto in time, your voter does not vote and tells you why.</p>
      <Action
        label={changes > 1 ? `Save ${changes} changes` : policyChanged || !s.policy ? 'Save policy' : 'Save setting'}
        disabled={empty || tooLong || changes === 0}
        run={async () => {
          let last: `0x${string}` | undefined
          if (confChanged) last = await writeContractAsync({ address: s.voter!, abi: voterAbi, functionName: 'setMinConfidence', args: [conf], chainId: chain.id })
          if (vetoChanged) last = await writeContractAsync({ address: s.voter!, abi: voterAbi, functionName: 'setVetoWindow', args: [veto], chainId: chain.id })
          if (policyChanged) last = await writeContractAsync({ address: s.voter!, abi: voterAbi, functionName: 'setPolicy', args: [text.trim()], chainId: chain.id })
          return last ?? NO_HASH
        }}
        onConfirmed={onSaved}
      />
      {changes > 1 && <p className="note">Saving asks for one signature per change.</p>}
    </div>
  )
}
